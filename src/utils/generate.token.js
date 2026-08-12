import jwt from "jsonwebtoken";

// Final authentication token
export const generateToken = (userId) => {
  return jwt.sign(
    {
      id: userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// Temporary login OTP token
export const generateLoginOtpToken = ({
  userId,
  loginType,
}) => {
  return jwt.sign(
    {
      userId,
      loginType,
      purpose: "LOGIN_OTP",
    },
    process.env.OTP_TOKEN_SECRET,
    {
      expiresIn: "10m",
    }
  );
};