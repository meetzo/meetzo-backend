import bcrypt from "bcryptjs";
import userModel from "../../models/userModel.js";
import mongoose from "mongoose";
import {  
  generateToken,
  generateLoginOtpToken, } from "../../utils/generate.token.js";
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

const LOGIN_OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

const generateOtpToken = (email) => {
  return jwt.sign({ email }, process.env.OTP_TOKEN_SECRET, {
    expiresIn: "10m",
  });
};

export const signupService = async ({ name, email, phone }) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!name || !email || !phone) {
    throw new ApiError(400, "Name, email and phone are required");
  }

  const trimmedName = name.trim();

  const normalizedEmail = email.trim().toLowerCase();

  const normalizedPhone = phone.trim();

  // ---------------------------------------
  // CHECK EXISTING USER
  // ---------------------------------------

  const existingUser = await userModel.findOne({
    $or: [
      {
        email: normalizedEmail,
      },
      {
        phone: normalizedPhone,
      },
    ],
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this email or phone");
  }

  // ---------------------------------------
  // GENERATE OTP
  // ---------------------------------------

  const otp = generateOtp();

  const otpExpiry = new Date(Date.now() + LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000);

  // ---------------------------------------
  // CREATE USER
  // ---------------------------------------

  const user = await userModel.create({
    name: trimmedName,

    email: normalizedEmail,

    phone: normalizedPhone,

    otp,

    otpExpiry,

    isVerified: false,

    isBlocked: false,
  });

  try {
    // ---------------------------------------
    // SEND OTP EMAIL
    // ---------------------------------------

    await sendOtpEmail(normalizedEmail, otp);
  } catch (error) {
    /*
     * If email sending fails,
     * remove the newly created unverified user.
     *
     * Otherwise next signup attempt would say
     * "User already exists".
     */

    await userModel.findByIdAndDelete(user._id);

    throw new ApiError(500, "Unable to send OTP. Please try again.");
  }

  // ---------------------------------------
  // OTP SESSION TOKEN
  // ---------------------------------------

  const otpToken = generateOtpToken(normalizedEmail);

  // ---------------------------------------
  // RESPONSE
  // ---------------------------------------

  return {
    success: true,

    message: "OTP sent to your email. Please verify to complete signup.",

    otpToken,

    user: {
      id: user._id,

      name: user.name,

      email: user.email,

      phone: user.phone,

      role: user.role,

      isVerified: user.isVerified,

      isBlocked: user.isBlocked,

      createdAt: user.createdAt,
    },
  };
};

export const verifyOtpService = async ({ otpToken, otp }) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!otpToken || !otp) {
    throw new ApiError(400, "OTP token and OTP are required");
  }

  // ---------------------------------------
  // VERIFY OTP TOKEN
  // ---------------------------------------

  let payload;

  try {
    payload = jwt.verify(otpToken, process.env.OTP_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(
      400,
      "OTP session expired or invalid. Please request a new OTP",
    );
  }

  const normalizedEmail = payload.email.trim().toLowerCase();

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findOne({
      email: normalizedEmail,
    })
    .select("+otp +otpExpiry");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // ---------------------------------------
  // CHECK OTP EXISTS
  // ---------------------------------------

  if (!user.otp || !user.otpExpiry) {
    throw new ApiError(400, "No OTP requested. Please request a new OTP");
  }

  // ---------------------------------------
  // VERIFY OTP
  // ---------------------------------------

  if (String(otp) !== String(user.otp)) {
    throw new ApiError(400, "Invalid OTP");
  }

  // ---------------------------------------
  // CHECK OTP EXPIRY
  // ---------------------------------------

  if (new Date() > user.otpExpiry) {
    throw new ApiError(400, "OTP has expired. Please request a new one");
  }

  // ---------------------------------------
  // UPDATE USER
  // ---------------------------------------

  user.isVerified = true;

  user.otp = undefined;
  user.otpExpiry = undefined;

  await user.save();

  // ---------------------------------------
  // GENERATE LOGIN TOKEN
  // ---------------------------------------

  const token = generateToken(user._id.toString());

  // ---------------------------------------
  // SAFE RESPONSE
  // ---------------------------------------

  const safeUser = {
    id: user._id,

    name: user.name,

    email: user.email,

    phone: user.phone,

    role: user.role,

    isVerified: user.isVerified,

    isBlocked: user.isBlocked,

    createdAt: user.createdAt,
  };

  return {
    success: true,

    message: "OTP verified successfully.",

    token,

    user: safeUser,
  };
};
// Login service
export const loginService = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findOne({
      email: normalizedEmail,
    })
    .select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // ---------------------------------------
  // BLOCK CHECK
  // ---------------------------------------

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // ---------------------------------------
  // VERIFIED CHECK
  // ---------------------------------------

  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your account before login");
  }

  // ---------------------------------------
  // PASSWORD CHECK
  // ---------------------------------------

  if (!user.password) {
    throw new ApiError(400, "Password is not set for this account");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  // ---------------------------------------
  // GENERATE TOKEN
  // ---------------------------------------

  const token = generateToken(user._id.toString());

  return {
    success: true,

    message: "Login successful",

    token,

    user: sanitizeUser(user),
  };
};
export const getUserByIdService = async (userId) => {
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  // ---------------------------------------
  // VALIDATE MONGODB ID
  // ---------------------------------------

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid User ID");
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findById(userId)
    .select("name email phone role isVerified isBlocked createdAt");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return {
    success: true,

    user: sanitizeUser(user),
  };
};




// ======================================================
// SEND EMAIL LOGIN OTP
// ======================================================

export const sendEmailLoginOtpService = async ({ email }) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!email || typeof email !== "string") {
    throw new ApiError(400, "Email is required.");
  }

  const cleanEmail = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    throw new ApiError(
      400,
      "Please enter a valid email address.",
    );
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel.findOne({
    email: cleanEmail,
  });

  if (!user) {
    throw new ApiError(
      404,
      "No account found with this email address.",
    );
  }

  // ---------------------------------------
  // BLOCK CHECK
  // ---------------------------------------

  if (user.isBlocked) {
    throw new ApiError(
      403,
      "Your account has been blocked. Please contact support.",
    );
  }

  // ---------------------------------------
  // VERIFIED CHECK
  // ---------------------------------------

  if (!user.isVerified) {
    throw new ApiError(
      403,
      "Please verify your account before logging in.",
    );
  }

  // ---------------------------------------
  // GENERATE OTP
  // ---------------------------------------

  const otp = String(generateOtp());

  const hashedOtp = await bcrypt.hash(otp, 10);

  const otpExpiry = new Date(
    Date.now() + LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000,
  );

  // ---------------------------------------
  // SAVE OTP
  // ---------------------------------------

  user.otp = hashedOtp;
  user.otpExpiry = otpExpiry;
  user.otpPurpose = "LOGIN";
  user.otpAttempts = 0;

  await user.save();

  // ---------------------------------------
  // SEND OTP EMAIL
  // ---------------------------------------

  try {
    await sendOtpEmail(cleanEmail, otp);
  } catch (error) {
    console.error("SEND LOGIN OTP EMAIL ERROR:", error);

    await userModel.findByIdAndUpdate(user._id, {
      $set: {
        otp: null,
        otpExpiry: null,
        otpPurpose: null,
        otpAttempts: 0,
      },
    });

    throw new ApiError(
      500,
      "Unable to send OTP. Please try again.",
    );
  }

  // ---------------------------------------
  // GENERATE TEMPORARY OTP ACCESS TOKEN
  // ---------------------------------------

  const accessToken = generateLoginOtpToken({
    userId: user._id.toString(),
    purpose: "EMAIL_LOGIN_OTP",
  });

  // ---------------------------------------
  // RESPONSE
  // ---------------------------------------

  return {
    accessToken,
    expiresInMinutes: LOGIN_OTP_EXPIRY_MINUTES,
  };
};


// ======================================================
// VERIFY EMAIL LOGIN OTP
// ======================================================

export const verifyEmailLoginOtpService = async ({
  accessToken,
  otp,
}) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!accessToken) {
    throw new ApiError(
      401,
      "OTP verification access token is required.",
    );
  }

  if (otp === undefined || otp === null || otp === "") {
    throw new ApiError(400, "OTP is required.");
  }

  const cleanOtp = String(otp).trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new ApiError(
      400,
      "Please enter a valid 6-digit OTP.",
    );
  }

  // ---------------------------------------
  // VERIFY TEMP ACCESS TOKEN
  // ---------------------------------------

  let decoded;

  try {
    decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET,
    );
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(
        401,
        "OTP verification session has expired. Please request a new OTP.",
      );
    }

    throw new ApiError(
      401,
      "Invalid OTP verification access token.",
    );
  }

  // ---------------------------------------
  // TOKEN PURPOSE CHECK
  // ---------------------------------------

  if (decoded.purpose !== "EMAIL_LOGIN_OTP") {
    throw new ApiError(
      401,
      "Invalid token purpose.",
    );
  }

  if (!decoded.userId) {
    throw new ApiError(
      401,
      "Invalid OTP verification token.",
    );
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findById(decoded.userId)
    .select(
      "+otp +otpExpiry +otpPurpose +otpAttempts",
    );

  if (!user) {
    throw new ApiError(
      404,
      "User account not found.",
    );
  }

  // ---------------------------------------
  // BLOCK CHECK
  // ---------------------------------------

  if (user.isBlocked) {
    throw new ApiError(
      403,
      "Your account has been blocked. Please contact support.",
    );
  }

  // ---------------------------------------
  // OTP CHECK
  // ---------------------------------------

  if (
    !user.otp ||
    !user.otpExpiry ||
    user.otpPurpose !== "LOGIN"
  ) {
    throw new ApiError(
      400,
      "Login OTP not found. Please request a new OTP.",
    );
  }

  // ---------------------------------------
  // OTP EXPIRY CHECK
  // ---------------------------------------

  if (user.otpExpiry.getTime() <= Date.now()) {
    user.otp = null;
    user.otpExpiry = null;
    user.otpPurpose = null;
    user.otpAttempts = 0;

    await user.save();

    throw new ApiError(
      400,
      "OTP has expired. Please request a new OTP.",
    );
  }

  // ---------------------------------------
  // MAX ATTEMPTS CHECK
  // ---------------------------------------

  if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
    user.otp = null;
    user.otpExpiry = null;
    user.otpPurpose = null;
    user.otpAttempts = 0;

    await user.save();

    throw new ApiError(
      429,
      "Too many incorrect OTP attempts. Please request a new OTP.",
    );
  }

  // ---------------------------------------
  // VERIFY OTP
  // ---------------------------------------

  const isOtpCorrect = await bcrypt.compare(
    cleanOtp,
    user.otp,
  );

  if (!isOtpCorrect) {
    user.otpAttempts += 1;

    const remainingAttempts =
      MAX_OTP_ATTEMPTS - user.otpAttempts;

    if (remainingAttempts <= 0) {
      user.otp = null;
      user.otpExpiry = null;
      user.otpPurpose = null;
      user.otpAttempts = 0;

      await user.save();

      throw new ApiError(
        429,
        "Too many incorrect OTP attempts. Please request a new OTP.",
      );
    }

    await user.save();

    throw new ApiError(
      400,
      `Incorrect OTP. ${remainingAttempts} attempt${
        remainingAttempts === 1 ? "" : "s"
      } remaining.`,
    );
  }

  // ---------------------------------------
  // OTP VERIFIED
  // CLEAR OTP
  // ---------------------------------------

  user.otp = null;
  user.otpExpiry = null;
  user.otpPurpose = null;
  user.otpAttempts = 0;

  await user.save();

  // ---------------------------------------
  // GENERATE ACTUAL LOGIN TOKEN
  // ---------------------------------------

  const token = generateToken({
    userId: user._id.toString(),
  });

  // ---------------------------------------
  // RESPONSE
  // ---------------------------------------

  return {
    token,

    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
    },
  };
};

export const createPasswordService = async ({
  userId,
  password,
  confirmPassword,
}) => {
  if (!userId) {
    throw new ApiError(
      401,
      "Authentication is required"
    );
  }

  if (!password || !confirmPassword) {
    throw new ApiError(
      400,
      "Password and confirm password are required"
    );
  }

  if (String(password).length < 8) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters"
    );
  }

  if (password !== confirmPassword) {
    throw new ApiError(
      400,
      "Password and confirm password do not match"
    );
  }

  const user = await userModel
    .findById(userId)
    .select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(
      403,
      "Your account has been blocked"
    );
  }

  if (!user.isVerified) {
    throw new ApiError(
      403,
      "Please verify your account first"
    );
  }

  if (user.password) {
    throw new ApiError(
      409,
      "Password is already created"
    );
  }

  user.password = await bcrypt.hash(
    password,
    12
  );

  await user.save();

  return {
    user: sanitizeUser(user),
  };
};