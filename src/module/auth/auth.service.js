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

const LOGIN_OTP_EXPIRY_MINUTES = 10;

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

export const sendLoginOtpService = async ({
  loginType,
  identifier,
}) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!loginType || !identifier) {
    throw new ApiError(
      400,
      "Login type and phone/email are required"
    );
  }

  const normalizedLoginType = String(loginType)
    .trim()
    .toUpperCase();

  if (
    !["PHONE", "EMAIL"].includes(
      normalizedLoginType
    )
  ) {
    throw new ApiError(
      400,
      "Login type must be PHONE or EMAIL"
    );
  }

  // ---------------------------------------
  // PREPARE USER QUERY
  // ---------------------------------------

  let query;

  if (normalizedLoginType === "EMAIL") {
    const normalizedEmail = String(identifier)
      .trim()
      .toLowerCase();

    query = {
      email: normalizedEmail,
    };
  } else {
    const normalizedPhone = String(identifier)
      .replace(/\s+/g, "")
      .trim();

    query = {
      phone: normalizedPhone,
    };
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findOne(query)
    .select("+otp +otpExpiry");

  if (!user) {
    throw new ApiError(
      404,
      "No account found with these details"
    );
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
      "Please verify your account before login"
    );
  }

  // ---------------------------------------
  // GENERATE AND SAVE OTP
  // ---------------------------------------

  const otp = generateOtp();

  user.otp = String(otp);

  user.otpExpiry = new Date(
    Date.now() +
      LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await user.save();

  // ---------------------------------------
  // SEND OTP
  // ---------------------------------------

  try {
    if (normalizedLoginType === "EMAIL") {
      await sendOtpEmail(user.email, otp);
    } else {
      /*
       * Abhi local testing ke liye phone OTP
       * terminal mein show hoga.
       */
      console.log(
        `PHONE LOGIN OTP for ${user.phone}: ${otp}`
      );
    }
  } catch (error) {
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    throw new ApiError(
      500,
      "Unable to send OTP. Please try again"
    );
  }

  // ---------------------------------------
  // TEMPORARY OTP TOKEN
  // ---------------------------------------

  const otpToken = generateLoginOtpToken({
    userId: user._id.toString(),
    loginType: normalizedLoginType,
  });

  return {
    otpToken,
    loginType: normalizedLoginType,
    expiresIn:
      LOGIN_OTP_EXPIRY_MINUTES * 60,
    destination:
      normalizedLoginType === "EMAIL"
        ? user.email
        : `******${user.phone.slice(-4)}`,
  };
};

export const verifyLoginOtpService = async ({
  otpToken,
  otp,
}) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!otpToken) {
    throw new ApiError(
      401,
      "OTP bearer token is required"
    );
  }

  if (
    otp === undefined ||
    otp === null ||
    String(otp).trim() === ""
  ) {
    throw new ApiError(
      400,
      "OTP is required"
    );
  }

  // ---------------------------------------
  // VERIFY TEMPORARY OTP TOKEN
  // ---------------------------------------

  let payload;

  try {
    payload = jwt.verify(
      otpToken,
      process.env.OTP_TOKEN_SECRET
    );
  } catch (error) {
    throw new ApiError(
      401,
      "OTP session is invalid or expired"
    );
  }

  if (payload.purpose !== "LOGIN_OTP") {
    throw new ApiError(
      401,
      "Invalid login OTP token"
    );
  }

  if (!payload.userId) {
    throw new ApiError(
      401,
      "Invalid OTP token payload"
    );
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findById(payload.userId)
    .select("+otp +otpExpiry");

  if (!user) {
    throw new ApiError(
      404,
      "User not found"
    );
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

  // ---------------------------------------
  // CHECK OTP EXISTS
  // ---------------------------------------

  if (!user.otp || !user.otpExpiry) {
    throw new ApiError(
      400,
      "No login OTP was requested"
    );
  }

  // ---------------------------------------
  // CHECK OTP EXPIRY
  // ---------------------------------------

  if (new Date() > user.otpExpiry) {
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    throw new ApiError(
      400,
      "OTP has expired. Please request a new OTP"
    );
  }

  // ---------------------------------------
  // CHECK OTP VALUE
  // ---------------------------------------

  if (
    String(user.otp) !==
    String(otp).trim()
  ) {
    throw new ApiError(
      400,
      "Invalid OTP"
    );
  }

  // ---------------------------------------
  // CLEAR USED OTP
  // ---------------------------------------

  user.otp = null;
  user.otpExpiry = null;

  await user.save();

  // ---------------------------------------
  // GENERATE FINAL LOGIN TOKEN
  // ---------------------------------------

  const token = generateToken(
    user._id.toString()
  );

  return {
    token,
    user: sanitizeUser(user),
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