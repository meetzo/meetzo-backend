import mongoose from "mongoose";
import crypto from "node:crypto";
import messaging from "../../config/firebase.js";
import { deviceToken as DeviceToken } from "../../models/notificationModel.js";

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

// FCM rejects these tokens permanently (app uninstalled / token expired).
const DEAD_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];
const FCM_BATCH_LIMIT = 500;

// Same sha256 hex as auth's getTokenHash; kept local to avoid an auth <-> notifications import cycle.
const hashSession = (jwtToken) => crypto.createHash("sha256").update(jwtToken).digest("hex");

// Upsert by token: if another account used this phone before, the token moves to this user.
// The login session (JWT) is remembered so logout can remove this device.
export const registerTokenService = ({ userId, token, platform, sessionToken }) =>
  DeviceToken.findOneAndUpdate(
    { token },
    { $set: { userId, platform, lastSeenAt: new Date(), sessionHash: sessionToken ? hashSession(sessionToken) : null } },
    { upsert: true, new: true },
  );

export const removeTokenService = ({ userId, token }) => DeviceToken.deleteOne({ userId, token });

// Called from logout: stop pushes to the device(s) registered by this login session.
export const removeSessionDeviceTokensService = ({ userId, sessionToken }) =>
  DeviceToken.deleteMany({ userId, sessionHash: hashSession(sessionToken) });
// Push a notification to every registered device of the given users.
export const sendNotificationService = async ({ userIds, title, body = "", data = {} }) => {
  const ids = [...new Set([].concat(userIds).filter(Boolean).map(String))];
  if (!ids.length) throw fail("userIds is required", 400);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw fail("Invalid user ID in userIds", 400);
  if (typeof title !== "string" || !title.trim()) throw fail("title is required", 400);

  if (!messaging) {
    // No Firebase credentials (e.g. local dev): skip quietly instead of failing the caller.
    console.warn("Push skipped: Firebase is not configured");
    return { sent: 0, failed: 0, removedTokens: 0 };
  }

  const tokens = (await DeviceToken.find({ userId: { $in: ids } }).select("token").lean())
    .map((t) => t.token);
  if (!tokens.length) return { sent: 0, failed: 0, removedTokens: 0 };

  // FCM data values must be strings.
  const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

  let sent = 0;
  let failed = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
    const batch = tokens.slice(i, i + FCM_BATCH_LIMIT);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: title.trim(), body },
      data: stringData,
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    sent += res.successCount;
    failed += res.failureCount;
    res.responses.forEach((r, j) => {
      if (!r.success && DEAD_TOKEN_ERRORS.includes(r.error?.code)) dead.push(batch[j]);
    });
  }

  // Remove tokens of uninstalled apps / expired registrations.
  if (dead.length) await DeviceToken.deleteMany({ token: { $in: dead } });
  return { sent, failed, removedTokens: dead.length };
};

// For backend events (new message, like, invite...). Never throws, so a failed
// push can't fail the action that triggered it. Call it without await.
export const notifyUser = (userId, { title, body, data }) =>
  sendNotificationService({ userIds: [userId], title, body, data })
    .catch((error) => console.error("Push notification failed:", error.message));

