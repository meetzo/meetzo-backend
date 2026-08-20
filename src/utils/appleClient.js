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

  const { payload } = await jwtVerify(
    identityToken,
    appleJWKS,
    {
      issuer: "https://appleid.apple.com",

      // Your iOS Bundle ID
      audience:
        process.env.APPLE_CLIENT_ID,
    }
  );

  return payload;
};