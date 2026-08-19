import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

export const verifyGoogleIdToken = async (
  idToken,
) => {
  const allowedClientIds = [
    process.env.CLIENT_ID,
    process.env.ANDROID_CLIENT_ID,
    process.env.ANDROID_RELEASE_CLIENT_ID,
    process.env.IOS_CLIENT_ID,
  ]
    .map((clientId) =>
      String(clientId ?? "").trim(),
    )
    .filter(Boolean);

  if (allowedClientIds.length === 0) {
    throw new Error(
      "Google OAuth client IDs are not configured",
    );
  }

  const ticket =
    await googleClient.verifyIdToken({
      idToken,
      audience: allowedClientIds,
    });

  return ticket.getPayload();
};