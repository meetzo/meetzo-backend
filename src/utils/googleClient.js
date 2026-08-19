import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

export const verifyGoogleIdToken = async (
  idToken,
) => {
  // Token ko safe string mein convert karo
  const cleanIdToken = String(
    idToken ?? "",
  ).trim();

  if (!cleanIdToken) {
    const error = new Error(
      "Google ID token is required",
    );

    error.statusCode = 400;
    throw error;
  }

  // Existing .env ke client IDs
  const allowedClientIds = [
    process.env.CLIENT_ID,
    process.env.ANDROID_CLIENT_ID,
    process.env.ANDROID_RELEASE_CLIENT_ID,
    process.env.IOS_CLIENT_ID,
  ].filter(
    (clientId) =>
      typeof clientId === "string" &&
      clientId.trim() !== "",
  );

  if (allowedClientIds.length === 0) {
    const error = new Error(
      "Google OAuth client IDs are not configured",
    );

    error.statusCode = 500;
    throw error;
  }

  try {
    const ticket =
      await googleClient.verifyIdToken({
        idToken: cleanIdToken,
        audience: allowedClientIds,
      });

    const payload = ticket.getPayload();

    if (!payload) {
      const error = new Error(
        "Google token payload not found",
      );

      error.statusCode = 401;
      throw error;
    }

    return payload;
  } catch (error) {
    console.error(
      "Google token verification failed:",
      error.message,
    );

    const verificationError = new Error(
      "Invalid or expired Google ID token",
    );

    verificationError.statusCode = 401;
    throw verificationError;
  }
};