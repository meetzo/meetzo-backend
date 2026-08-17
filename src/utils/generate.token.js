import jwt from "jsonwebtoken";


// ======================================================
// NORMALIZE USER ID
// Supports:
// generateToken("userId")
// generateToken({ userId: "userId" })
// generateToken({ id: "userId" })
// ======================================================

const getUserId = (value) => {
  let userId;

  if (typeof value === "string") {
    userId = value;
  } else if (value && typeof value === "object") {
    userId = value.userId || value.id;
  }

  if (!userId) {
    throw new Error("userId is required to generate token.");
  }

  return userId.toString();
};


// ======================================================
// FINAL AUTHENTICATION TOKEN
// ======================================================

export const generateToken = (data) => {
  const userId = getUserId(data);

  return jwt.sign(
    {
      id: userId,
      userId: userId,
      purpose: "AUTH",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};


// ======================================================
// TEMPORARY EMAIL LOGIN OTP TOKEN
// ======================================================

export const generateLoginOtpToken = (data) => {
  const userId = getUserId(data);

  return jwt.sign(
    {
      id: userId,
      userId: userId,
      purpose: "EMAIL_LOGIN_OTP",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "10m",
    }
  );
};