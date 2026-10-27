import {
  registerTokenService, removeTokenService, sendNotificationService,
} from "./notifications.service.js";

const PLATFORMS = ["android", "ios", "web"];

// register device token (call after login and whenever FCM refreshes the token)
export const registerTokenController = async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    if (typeof token !== "string" || !token.trim() || token.length > 4096) {
      return res.status(400).json({ message: "token is required" });
    }
     if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ message: "platform must be android, ios or web" });
    }
    const authorization = req.headers.authorization;
    const sessionToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
    await registerTokenService({ userId: req.user._id, token: token.trim(), platform, sessionToken });
    res.status(200).json({ success: true, message: "Device registered" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to register device" });
  }
};

// send notification controller (admin only: test pushes / announcements)
export const sendNotificationController = async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 1000) {
      return res.status(400).json({ message: "userIds must be an array of 1 to 1000 user IDs" });
    }
    if (body !== undefined && (typeof body !== "string" || body.length > 1000)) {
      return res.status(400).json({ message: "body must be a string of at most 1000 characters" });
    }
    if (data !== undefined && (typeof data !== "object" || data === null || Array.isArray(data))) {
      return res.status(400).json({ message: "data must be an object" });
    }
    const result = await sendNotificationService({ userIds, title, body, data });
    res.status(200).json({ success: true, message: "Notification sent", data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to send notification" });
  }
};

// remove device token (call on logout)
export const logoutController = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (typeof token !== "string" || !token.trim()) return res.status(400).json({ message: "token is required" });
    await removeTokenService({ userId: req.user._id, token: token.trim() });
    res.status(200).json({ success: true, message: "Device removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove device" });
  }
};

