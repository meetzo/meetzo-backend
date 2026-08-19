import { OAuth2Client } from "google-auth-library";


const googleClient = new OAuth2Client(config.CLIENT_ID);

export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: [
      process.env.CLIENT_ID,        // Web client
      process.env.ANDROID_CLIENT_ID, // Android client
      process.env.IOS_CLIENT_ID, 
      process.env.ANDROID_RELEASE_CLIENT_ID // Android release client
    ],
  });

  return ticket.getPayload();
};

