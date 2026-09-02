import {
  createRemoteJWKSet,
  jwtVerify,
} from "jose";

const appleJWKS = createRemoteJWKSet(
  new URL(
    "https://appleid.apple.com/auth/keys"
  )
);

export const verifyAppleIdToken = async (
  identityToken
) => {
  if (!identityToken) {
    throw new Error(
      "Apple identity token is required"
    );
  }

  if (!process.env.APPLE_AUDIENCE) {
    throw new Error(
      "APPLE_AUDIENCE is not configured"
    );
  }

  try {
    const { payload } = await jwtVerify(
      identityToken,
      appleJWKS,
      {
        issuer:
          "https://appleid.apple.com",

        // Your iOS Bundle ID / Apple client ID
        audience:
          process.env.APPLE_AUDIENCE,
      }
    );

    return payload;
  } catch (error) {
    console.error(
      "APPLE TOKEN VERIFY ERROR:",
      error
    );

    throw new Error(
      "Invalid Apple identity token"
    );
  }
};