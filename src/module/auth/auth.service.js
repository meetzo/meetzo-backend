import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { generateToken } from "../../utils/generate.token.js";
import ApiError from "../../utils/api.error.js";
import { generateOtp } from "../../utils/generate.otp.js";
import { sendOtpEmail } from "../../utils/sendEmail.js";
import jwt from "jsonwebtoken";

// Helper function for safe user response
const sanitizeUser = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
};

// Signup service

const OTP_EXPIRY_MINUTES = 10;

const generateOtpToken = (email) => {
  return jwt.sign({ email }, process.env.OTP_TOKEN_SECRET, {
    expiresIn: "10m",
  });
};

export const signupService = async ({ name, email, phone }) =>{
  if (!name || !email || !phone) {
    throw new ApiError(400, "Name, email and phone are required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();
  const trimmedName = name.trim();

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this email or phone");
  }

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      otp,
      otpExpiry,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  await sendOtpEmail(normalizedEmail, otp);

  const otpToken = generateOtpToken(normalizedEmail);

  return {
    message: "OTP sent to your email. Please verify to complete signup.",
    otpToken,
    user,
  };
};

export const verifyOtpService = async ({ otpToken, otp }) => {
  if (!otpToken || !otp) {
    throw new ApiError(400, "OTP token and OTP are required");
  }

  let payload;
  try {
    payload = jwt.verify(otpToken, process.env.OTP_TOKEN_SECRET);
  } catch (err) {
    throw new ApiError(
      400,
      "OTP session expired or invalid. Please request a new OTP",
    );
  }

  const normalizedEmail = payload.email;

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (user.isBlocked) throw new ApiError(403, "Your account has been blocked");

  if (!user.otp || !user.otpExpiry) {
    throw new ApiError(400, "No OTP requested. Please request a new OTP");
  }

  if (String(otp) !== user.otp) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (new Date() > user.otpExpiry) {
    throw new ApiError(400, "OTP has expired. Please request a new one");
  }

  const updatedUser = await prisma.user.update({
    where: { email: normalizedEmail },
    data: { isVerified: true, otp: null, otpExpiry: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  const token = generateToken(updatedUser.id);

  return { token, user: updatedUser };
};
// Login service
export const loginService = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = generateToken(user.id);

  return {
    token,
    user: sanitizeUser(user),
  };
};

export const getUserByIdService = async (userId) => {
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isVerified: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};
