import bcrypt from "bcryptjs";
import userModel from "../../models/userModel.js";
import signupAttemptModel from "../../models/signupAttemptModel.js";
import mongoose from "mongoose";
import { verifyGoogleIdToken } from "../../utils/googleClient.js";
import { verifyAppleIdToken } from "../../utils/appleClient.js";
import {
  generateToken,
  generateLoginOtpToken,
} from "../../utils/generate.token.js";
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
const SIGNUP_OTP_EXPIRY_MINUTES = 10;
const DUMMY_MOBILE_OTP = "1234";

const ensureAuthConfiguration = (...names) => {
  const missing = names.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new ApiError(
      500,
      `Missing required authentication configuration: ${missing.join(", ")}`,
    );
  }
};

const generateOtpToken = (email) => {
  return jwt.sign({ email }, process.env.OTP_TOKEN_SECRET, {
    expiresIn: "10m",
  });
};

// =====================================================
// TEMP OTP TOKEN
// =====================================================

const generateSignupOtpToken = ({ signupAttemptId }) => {
  return jwt.sign(
    {
      signupAttemptId,
      purpose: "SIGNUP_OTP",
    },
    process.env.OTP_TOKEN_SECRET,
    {
      expiresIn: "10m",
    },
  );
};

// =====================================================
// SIGNUP SERVICE
// =====================================================

export const signupService = async ({ name, email, phone, password }) => {
  ensureAuthConfiguration(
    "JWT_SECRET",
    "OTP_TOKEN_SECRET",
    "EMAIL_USER",
    "APP_PASSWORD",
  );

  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!name || !email || !phone) {
    throw new ApiError(400, "Name, email and phone are required");
  }

  const trimmedName = String(name).trim();

  const normalizedEmail = String(email).trim().toLowerCase();

  const normalizedPhone = String(phone).trim();

  if (!trimmedName) {
    throw new ApiError(400, "Name is required");
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw new ApiError(400, "Please enter a valid email address");
  }

  if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) {
    throw new ApiError(400, "Phone number must contain 10 to 15 digits");
  }

  // ---------------------------------------
  // CHECK ACTUAL USER
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

  const passwordHash = await bcrypt.hash(password, 12);

  // ---------------------------------------
  // GENERATE OTP
  // ---------------------------------------

  const otp = String(generateOtp());

  const otpHash = await bcrypt.hash(otp, 10);

  const otpExpiresAt = new Date(
    Date.now() + SIGNUP_OTP_EXPIRY_MINUTES * 60 * 1000,
  );

  // ---------------------------------------
  // REMOVE PREVIOUS ATTEMPTS
  // ---------------------------------------

  await signupAttemptModel.deleteMany({
    $or: [
      {
        email: normalizedEmail,
      },
      {
        phone: normalizedPhone,
      },
    ],
  });

  // ---------------------------------------
  // CREATE TEMP SIGNUP
  // ---------------------------------------

  const signupAttempt = await signupAttemptModel.create({
    name: trimmedName,

    email: normalizedEmail,

    phone: normalizedPhone,

    otpHash,

    passwordHash,

    otpExpiresAt,

    attempts: 0,
  });

  // ---------------------------------------
  // SEND OTP
  // ---------------------------------------

  try {
    await sendOtpEmail(normalizedEmail, otp);
  } catch (error) {
    await signupAttemptModel.deleteOne({
      _id: signupAttempt._id,
    });

    throw new ApiError(500, "Unable to send OTP. Please try again.");
  }

  // ---------------------------------------
  // OTP TOKEN
  // ---------------------------------------

  const otpToken = generateSignupOtpToken({
    signupAttemptId: signupAttempt._id.toString(),
  });

  return {
    success: true,

    message: "OTP sent to your email. Please verify to complete signup.",

    otpToken,

    user: {
      name: trimmedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      isVerified: false,
    },
  };
};

// =====================================================
// VERIFY SIGNUP OTP SERVICE
// =====================================================

// export const verifySignupOtpService = async ({ otpToken, otp }) => {
//   // ---------------------------------------
//   // VALIDATION
//   // ---------------------------------------

//   if (!otpToken) {
//     throw new ApiError(401, "OTP token is required");
//   }

//   const cleanOtp = String(otp ?? "").trim();

//   if (!cleanOtp) {
//     throw new ApiError(400, "OTP is required");
//   }

//   if (!/^\d{4}$/.test(cleanOtp)) {
//     throw new ApiError(400, "Please enter a valid 4-digit OTP");
//   }

//   // ---------------------------------------
//   // VERIFY OTP SESSION TOKEN
//   // ---------------------------------------

//   let payload;

//   try {
//     payload = jwt.verify(otpToken, process.env.OTP_TOKEN_SECRET);
//   } catch (error) {
//     if (error?.name === "TokenExpiredError") {
//       throw new ApiError(401, "OTP session has expired. Please signup again.");
//     }

//     throw new ApiError(401, "Invalid OTP session");
//   }

//   // ---------------------------------------
//   // CHECK TOKEN PURPOSE
//   // ---------------------------------------

//   if (payload.purpose !== "SIGNUP_OTP") {
//     throw new ApiError(401, "Invalid signup OTP token");
//   }

//   // ---------------------------------------
//   // CHECK SIGNUP ATTEMPT ID
//   // ---------------------------------------

//   if (!payload.signupAttemptId) {
//     throw new ApiError(401, "Invalid signup session");
//   }

//   // ---------------------------------------
//   // FIND SIGNUP ATTEMPT
//   // ---------------------------------------

//   const signupAttempt = await signupAttemptModel
//     .findById(payload.signupAttemptId)
//     .select("+otpHash");

//   if (!signupAttempt) {
//     throw new ApiError(
//       404,
//       "Signup session not found or expired. Please signup again.",
//     );
//   }

//   // ---------------------------------------
//   // CHECK OTP EXPIRY
//   // ---------------------------------------

//   if (
//     !signupAttempt.otpExpiresAt ||
//     signupAttempt.otpExpiresAt.getTime() <= Date.now()
//   ) {
//     await signupAttemptModel.deleteOne({
//       _id: signupAttempt._id,
//     });

//     throw new ApiError(400, "OTP has expired. Please signup again.");
//   }

//   // ---------------------------------------
//   // CHECK MAX OTP ATTEMPTS
//   // ---------------------------------------

//   if (signupAttempt.attempts >= MAX_OTP_ATTEMPTS) {
//     await signupAttemptModel.deleteOne({
//       _id: signupAttempt._id,
//     });

//     throw new ApiError(
//       429,
//       "Too many incorrect OTP attempts. Please signup again.",
//     );
//   }

//   // ---------------------------------------
//   // VERIFY OTP
//   // ---------------------------------------

//   const isOtpValid = await bcrypt.compare(cleanOtp, signupAttempt.otpHash);

//   if (!isOtpValid) {
//     signupAttempt.attempts += 1;

//     await signupAttempt.save();

//     const attemptsLeft = MAX_OTP_ATTEMPTS - signupAttempt.attempts;

//     throw new ApiError(
//       400,
//       attemptsLeft > 0
//         ? `Invalid OTP. ${attemptsLeft} attempts remaining.`
//         : "Too many incorrect OTP attempts. Please signup again.",
//     );
//   }

//   // ---------------------------------------
//   // CHECK USER AGAIN
//   // ---------------------------------------
//   // Important because another request might
//   // have created the account meanwhile.
//   // ---------------------------------------

//   const existingUser = await userModel.findOne({
//     $or: [
//       {
//         email: signupAttempt.email,
//       },
//       {
//         phone: signupAttempt.phone,
//       },
//     ],
//   });

//   if (existingUser) {
//     await signupAttemptModel.deleteOne({
//       _id: signupAttempt._id,
//     });

//     throw new ApiError(409, "User already registered with this email or phone");
//   }

//   // ---------------------------------------
//   // CREATE ACTUAL USER
//   // ONLY AFTER OTP VERIFIED ✅
//   // ---------------------------------------

//   let user;

//   try {
//     user = await userModel.create({
//       name: signupAttempt.name,

//       email: signupAttempt.email,

//       phone: signupAttempt.phone,

//       isVerified: true,

//       isBlocked: false,
//     });
//   } catch (error) {
//     // Mongo unique index race-condition protection
//     if (error?.code === 11000) {
//       throw new ApiError(409, "User already registered");
//     }

//     throw error;
//   }

//   // ---------------------------------------
//   // DELETE SIGNUP ATTEMPT
//   // ---------------------------------------

//   await signupAttemptModel.deleteOne({
//     _id: signupAttempt._id,
//   });

//   // ---------------------------------------
//   // GENERATE LOGIN JWT
//   // ---------------------------------------

//   const token = generateToken(user._id.toString());

//   // ---------------------------------------
//   // SAFE USER RESPONSE
//   // ---------------------------------------

//   const safeUser = {
//     id: user._id,

//     name: user.name,

//     email: user.email,

//     phone: user.phone,

//     role: user.role,

//     isVerified: user.isVerified,

//     isBlocked: user.isBlocked,

//     profileImage: user.profileImage ?? null,

//     kycStatus: user.kycStatus,

//     isKycVerified: user.isKycVerified,

//     createdAt: user.createdAt,
//   };

//   return {
//     success: true,

//     message: "Account verified and registered successfully",

//     token,

//     user: safeUser,
//   };
// };

export const verifySignupOtpService = async ({ otpToken, otp }) => {
  ensureAuthConfiguration("OTP_TOKEN_SECRET", "JWT_SECRET");

  // ==========================================
  // 1. VALIDATION
  // ==========================================

  if (!otpToken) {
    throw new ApiError(401, "OTP token is required");
  }

  const cleanOtp = String(otp ?? "").trim();

  if (!cleanOtp) {
    throw new ApiError(400, "OTP is required");
  }

  if (!/^\d{4}$/.test(cleanOtp)) {
    throw new ApiError(400, "Please enter a valid 4-digit OTP");
  }

  // ==========================================
  // 2. VERIFY OTP SESSION TOKEN
  // ==========================================

  let payload;

  try {
    payload = jwt.verify(otpToken, process.env.OTP_TOKEN_SECRET);
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      throw new ApiError(401, "OTP session has expired. Please signup again.");
    }

    throw new ApiError(401, "Invalid OTP session");
  }

  // ==========================================
  // 3. CHECK TOKEN PURPOSE
  // ==========================================

  if (payload?.purpose !== "SIGNUP_OTP") {
    throw new ApiError(401, "Invalid signup OTP token");
  }

  // ==========================================
  // 4. CHECK SIGNUP ATTEMPT ID
  // ==========================================

  if (!payload?.signupAttemptId) {
    throw new ApiError(401, "Invalid signup session");
  }

  // ==========================================
  // 5. FIND SIGNUP ATTEMPT
  // ==========================================

  const signupAttempt = await signupAttemptModel
    .findById(payload.signupAttemptId)
    .select("+otpHash +passwordHash");

  if (!signupAttempt) {
    throw new ApiError(
      404,
      "Signup session not found or expired. Please signup again.",
    );
  }

  if (!signupAttempt.passwordHash) {
    await signupAttemptModel.deleteOne({ _id: signupAttempt._id });
    throw new ApiError(400, "Signup session is outdated. Please sign up again.");
  }

  // ==========================================
  // 6. NORMALIZE SIGNUP DATA
  // ==========================================

  const normalizedEmail = String(signupAttempt.email ?? "")
    .trim()
    .toLowerCase();

  const normalizedPhone = String(signupAttempt.phone ?? "").trim();

  const normalizedName = String(signupAttempt.name ?? "").trim();

  if (!normalizedEmail) {
    throw new ApiError(400, "Signup email is missing");
  }

  if (!normalizedPhone) {
    throw new ApiError(400, "Signup phone number is missing");
  }

  if (!normalizedName) {
    throw new ApiError(400, "Signup name is missing");
  }

  // ==========================================
  // 7. CHECK OTP EXPIRY
  // ==========================================

  if (
    !signupAttempt.otpExpiresAt ||
    signupAttempt.otpExpiresAt.getTime() <= Date.now()
  ) {
    await signupAttemptModel.deleteOne({
      _id: signupAttempt._id,
    });

    throw new ApiError(400, "OTP has expired. Please signup again.");
  }

  // ==========================================
  // 8. CHECK MAX OTP ATTEMPTS
  // ==========================================

  if (Number(signupAttempt.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    await signupAttemptModel.deleteOne({
      _id: signupAttempt._id,
    });

    throw new ApiError(
      429,
      "Too many incorrect OTP attempts. Please signup again.",
    );
  }

  // ==========================================
  // 9. VERIFY OTP
  // ==========================================

  const isOtpValid = await bcrypt.compare(cleanOtp, signupAttempt.otpHash);

  if (!isOtpValid) {
    signupAttempt.attempts = Number(signupAttempt.attempts ?? 0) + 1;

    const attemptsLeft = MAX_OTP_ATTEMPTS - signupAttempt.attempts;

    if (attemptsLeft <= 0) {
      await signupAttemptModel.deleteOne({
        _id: signupAttempt._id,
      });

      throw new ApiError(
        429,
        "Too many incorrect OTP attempts. Please signup again.",
      );
    }

    await signupAttempt.save();

    throw new ApiError(400, `Invalid OTP. ${attemptsLeft} attempts remaining.`);
  }

  // ==========================================
  // 10. CHECK USER AGAIN
  // ==========================================

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
    await signupAttemptModel.deleteOne({
      _id: signupAttempt._id,
    });

    if (existingUser.email && existingUser.email === normalizedEmail) {
      throw new ApiError(409, "User already registered with this email");
    }

    if (existingUser.phone && existingUser.phone === normalizedPhone) {
      throw new ApiError(409, "User already registered with this phone number");
    }

    throw new ApiError(409, "User already registered");
  }

  // ==========================================
  // 11. CREATE ACTUAL USER
  // ==========================================

  let user;

  try {
    user = await userModel.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password: signupAttempt.passwordHash,

      // Explicitly local signup
      authProvider: "local",

      isVerified: true,
      isBlocked: false,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField =
        Object.keys(error?.keyPattern ?? {})[0] ||
        Object.keys(error?.keyValue ?? {})[0];

      if (duplicateField === "email") {
        throw new ApiError(409, "User already registered with this email");
      }

      if (duplicateField === "phone" || duplicateField === "fullPhone") {
        throw new ApiError(
          409,
          "User already registered with this phone number",
        );
      }

      throw new ApiError(409, "User data is already registered");
    }

    throw error;
  }

  // ==========================================
  // 12. DELETE SIGNUP ATTEMPT
  // ==========================================

  await signupAttemptModel.deleteOne({
    _id: signupAttempt._id,
  });

  // ==========================================
  // 13. GENERATE LOGIN TOKEN
  // ==========================================

  const token = generateToken(user._id.toString());

  // ==========================================
  // 14. SAFE USER RESPONSE
  // ==========================================

  const safeUser = {
    id: user._id,

    name: user.name,

    email: user.email,

    phone: user.phone,

    role: user.role ?? user.type,

    isVerified: user.isVerified,

    isBlocked: user.isBlocked,

    profileImage: user.profileImage ?? null,

    kycStatus: user.kycStatus ?? null,

    isKycVerified: user.isKycVerified ?? false,

    createdAt: user.createdAt,
  };

  // ==========================================
  // 15. RESPONSE
  // ==========================================

  return {
    success: true,

    message: "Account verified and registered successfully",

    token,

    user: safeUser,
  };
};

// Login service
export const loginService = async ({ email, password }) => {
  ensureAuthConfiguration("JWT_SECRET");

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
    throw new ApiError(400, "Please enter a valid email address.");
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel.findOne({
    email: cleanEmail,
  });

  if (!user) {
    throw new ApiError(404, "No account found with this email address.");
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
    throw new ApiError(403, "Please verify your account before logging in.");
  }

  // ---------------------------------------
  // GENERATE OTP
  // ---------------------------------------

  const otp = String(generateOtp());

  const hashedOtp = await bcrypt.hash(otp, 10);

  const otpExpiry = new Date(Date.now() + LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000);

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

    throw new ApiError(500, "Unable to send OTP. Please try again.");
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

export const verifyEmailLoginOtpService = async ({ accessToken, otp }) => {
  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!accessToken) {
    throw new ApiError(401, "OTP verification access token is required.");
  }

  if (otp === undefined || otp === null || otp === "") {
    throw new ApiError(400, "OTP is required.");
  }

  const cleanOtp = String(otp).trim();

  if (!/^\d{4}$/.test(cleanOtp)) {
    throw new ApiError(400, "Please enter a valid 4-digit OTP.");
  }

  // ---------------------------------------
  // VERIFY TEMP ACCESS TOKEN
  // ---------------------------------------

  let decoded;

  try {
    decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(
        401,
        "OTP verification session has expired. Please request a new OTP.",
      );
    }

    throw new ApiError(401, "Invalid OTP verification access token.");
  }

  // ---------------------------------------
  // TOKEN PURPOSE CHECK
  // ---------------------------------------

  if (decoded.purpose !== "EMAIL_LOGIN_OTP") {
    throw new ApiError(401, "Invalid token purpose.");
  }

  if (!decoded.userId) {
    throw new ApiError(401, "Invalid OTP verification token.");
  }

  // ---------------------------------------
  // FIND USER
  // ---------------------------------------

  const user = await userModel
    .findById(decoded.userId)
    .select("+otp +otpExpiry +otpPurpose +otpAttempts");

  if (!user) {
    throw new ApiError(404, "User account not found.");
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

  if (!user.otp || !user.otpExpiry || user.otpPurpose !== "LOGIN") {
    throw new ApiError(400, "Login OTP not found. Please request a new OTP.");
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

    throw new ApiError(400, "OTP has expired. Please request a new OTP.");
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

  const isOtpCorrect = await bcrypt.compare(cleanOtp, user.otp);

  if (!isOtpCorrect) {
    user.otpAttempts += 1;

    const remainingAttempts = MAX_OTP_ATTEMPTS - user.otpAttempts;

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
    throw new ApiError(401, "Authentication is required");
  }

  if (!password || !confirmPassword) {
    throw new ApiError(400, "Password and confirm password are required");
  }

  if (String(password).length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  if (password !== confirmPassword) {
    throw new ApiError(400, "Password and confirm password do not match");
  }

  const user = await userModel.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your account first");
  }

  if (user.password) {
    throw new ApiError(409, "Password is already created");
  }

  user.password = await bcrypt.hash(password, 12);

  await user.save();

  return {
    user: sanitizeUser(user),
  };
};

// =======================================
// GOOGLE AUTH SERVICE
// =======================================

export const googleAuthService = async (idToken) => {
  // ---------------------------------------
  // VALIDATE ID TOKEN
  // ---------------------------------------

  const cleanIdToken = String(idToken ?? "").trim();

  if (!cleanIdToken) {
    throw new ApiError(400, "Google ID token is required");
  }

  // ---------------------------------------
  // VERIFY ID TOKEN
  // ---------------------------------------

  let payload;

  try {
    payload = await verifyGoogleIdToken(cleanIdToken);
  } catch (error) {
    console.error("GOOGLE TOKEN VERIFY ERROR:", error.message);

    throw new ApiError(401, "Invalid or expired Google ID token");
  }

  // ---------------------------------------
  // VALIDATE GOOGLE PAYLOAD
  // ---------------------------------------

  if (!payload) {
    throw new ApiError(401, "Unable to read Google user information");
  }

  const { sub, email, name, picture, email_verified: emailVerified } = payload;

  const googleId = String(sub ?? "").trim();

  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  const normalizedName = String(name ?? "").trim();

  const profileImage = String(picture ?? "").trim();

  if (!googleId || !normalizedEmail) {
    throw new ApiError(
      400,
      "Google account did not provide the required information",
    );
  }

  if (emailVerified !== true) {
    throw new ApiError(401, "Google email is not verified");
  }

  // ---------------------------------------
  // FIND EXISTING USER
  // ---------------------------------------

  let user = await userModel.findOne({
    $or: [
      {
        googleId,
      },
      {
        email: normalizedEmail,
      },
    ],
  });

  // ---------------------------------------
  // EXISTING USER
  // ---------------------------------------

  if (user) {
    if (user.isBlocked) {
      throw new ApiError(403, "Your account has been blocked");
    }

    if (user.googleId && String(user.googleId) !== googleId) {
      throw new ApiError(
        409,
        "This email is connected to another Google account",
      );
    }

    let shouldSave = false;

    if (!user.googleId) {
      user.googleId = googleId;
      shouldSave = true;
    }

    if (!user.profileImage && profileImage) {
      user.profileImage = profileImage;

      shouldSave = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      shouldSave = true;
    }

    /*
     * Agar existing user local account hai,
     * authProvider ko change nahi karenge.
     * Isse password login bhi available rahega.
     */

    if (shouldSave) {
      await user.save();
    }
  } else {
    // ---------------------------------------
    // CREATE NEW GOOGLE USER
    // ---------------------------------------

    user = await userModel.create({
      name: normalizedName || normalizedEmail.split("@")[0],

      email: normalizedEmail,

      googleId,

      profileImage: profileImage || null,

      authProvider: "google",

      isVerified: true,
    });
  }

  // ---------------------------------------
  // GENERATE APPLICATION JWT
  // ---------------------------------------

  const token = generateToken(user._id.toString());

  // ---------------------------------------
  // RESPONSE
  // ---------------------------------------

  return {
    message: "Google authentication successful",

    token,

    user: {
      id: user._id,
      name: user.name,
      email: user.email,

      profileImage: user.profileImage ?? null,

      authProvider: user.authProvider,

      isVerified: user.isVerified,
    },
  };
};
// =======================================
// GOOGLE ANDROID AUTH SERVICE
// =======================================

export const googleAndroidAuthService = async ({ idToken }) => {
  const cleanIdToken = String(idToken ?? "").trim();

  if (!cleanIdToken) {
    const error = new Error("Google ID token is required");

    error.statusCode = 400;
    throw error;
  }

  const allowedClientIds = [
    process.env.CLIENT_ID,
    process.env.ANDROID_CLIENT_ID,
    process.env.ANDROID_RELEASE_CLIENT_ID,
  ]
    .map((clientId) => String(clientId ?? "").trim())
    .filter(Boolean);

  if (allowedClientIds.length === 0) {
    const error = new Error(
      "Google Android OAuth client IDs are not configured",
    );

    error.statusCode = 500;
    throw error;
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken: cleanIdToken,
      audience: allowedClientIds,
    });
  } catch (error) {
    console.error("GOOGLE ANDROID TOKEN VERIFY ERROR:", error.message);

    const authError = new Error("Invalid or expired Google ID token");

    authError.statusCode = 401;
    throw authError;
  }

  const payload = ticket.getPayload();

  if (!payload) {
    const error = new Error("Unable to read Google account information");

    error.statusCode = 401;
    throw error;
  }

  const { sub, email, name, picture, email_verified: emailVerified } = payload;

  const googleId = String(sub ?? "").trim();

  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  const normalizedName = String(name ?? "").trim();

  const profileImage = String(picture ?? "").trim();

  if (!googleId || !normalizedEmail) {
    const error = new Error("Google account information is incomplete");

    error.statusCode = 400;
    throw error;
  }

  if (emailVerified !== true) {
    const error = new Error("Google email is not verified");

    error.statusCode = 401;
    throw error;
  }

  let user = await userModel.findOne({
    $or: [
      {
        googleId,
      },
      {
        email: normalizedEmail,
      },
    ],
  });

  if (user) {
    if (user.isBlocked) {
      const error = new Error("Your account has been blocked");

      error.statusCode = 403;
      throw error;
    }

    if (user.googleId && String(user.googleId) !== googleId) {
      const error = new Error(
        "This email is connected to another Google account",
      );

      error.statusCode = 409;
      throw error;
    }

    let shouldSave = false;

    if (!user.googleId) {
      user.googleId = googleId;
      shouldSave = true;
    }

    if (!user.profileImage && profileImage) {
      user.profileImage = profileImage;

      shouldSave = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
    }
  } else {
    user = await userModel.create({
      name: normalizedName || normalizedEmail.split("@")[0],

      email: normalizedEmail,

      googleId,

      profileImage: profileImage || null,

      authProvider: "google",

      isVerified: true,
    });
  }

  const token = generateToken(user._id.toString());

  return {
    message: "Google Android authentication successful",

    token,

    user: {
      id: user._id,
      name: user.name,
      email: user.email,

      profileImage: user.profileImage ?? null,

      authProvider: user.authProvider,

      isVerified: user.isVerified,
    },
  };
};

const getAppleFullName = (fullName) => {
  if (!fullName) {
    return null;
  }

  // Flutter may send a normal string
  if (typeof fullName === "string") {
    const name = fullName.trim();

    return name || null;
  }

  // Or an object:
  // {
  //   givenName: "Chandan",
  //   familyName: "Singh"
  // }

  if (typeof fullName === "object") {
    const givenName = String(fullName.givenName ?? "").trim();

    const familyName = String(fullName.familyName ?? "").trim();

    const name = `${givenName} ${familyName}`.trim();

    return name || null;
  }

  return null;
};
export const appleLoginService = async ({ identityToken, email, fullName }) => {
  // =======================================
  // VALIDATE IDENTITY TOKEN
  // =======================================

  const cleanIdentityToken = String(identityToken ?? "").trim();

  if (!cleanIdentityToken) {
    throw new ApiError(400, "Apple identity token is required");
  }

  // =======================================
  // VERIFY APPLE IDENTITY TOKEN
  // =======================================

  let appleData;

  try {
    appleData = await verifyAppleIdToken(cleanIdentityToken);
  } catch (error) {
    console.error("APPLE ID TOKEN VERIFICATION ERROR:", error);

    throw new ApiError(401, "Invalid Apple identity token");
  }

  /*
    Apple standard JWT claims:

    sub            = unique Apple user ID
    email          = Apple verified email
    email_verified = true / "true"
    aud            = bundle ID / client ID
    iss            = https://appleid.apple.com
  */

  const appleId =
    typeof appleData?.sub === "string" ? appleData.sub.trim() : null;

  if (!appleId) {
    throw new ApiError(401, "Invalid Apple identity token");
  }

  // =======================================
  // NORMALIZE EMAIL VERIFIED
  // =======================================

  const emailVerified =
    appleData.email_verified === true || appleData.email_verified === "true";

  // =======================================
  // VERIFIED APPLE EMAIL
  // =======================================

  const appleEmail =
    typeof appleData.email === "string"
      ? appleData.email.trim().toLowerCase()
      : null;

  // =======================================
  // FRONTEND EMAIL
  // =======================================
  // Do NOT trust this for account linking.
  // Apple token email is the trusted source.
  // =======================================

  const normalizedRequestEmail =
    typeof email === "string" ? email.trim().toLowerCase() : null;

  // Can be used as fallback for display/new
  // account only if your product requires it,
  // but it is NOT Apple-verified.
  const resolvedEmail = appleEmail || normalizedRequestEmail;

  // =======================================
  // NORMALIZE NAME
  // =======================================

  const normalizedName = getAppleFullName(fullName);

  // =======================================
  // FIND USER BY APPLE ID
  // =======================================

  let user = await userModel.findOne({
    appleId,
  });

  // =======================================
  // LINK EXISTING ACCOUNT BY VERIFIED EMAIL
  // =======================================
  // Never link based only on frontend email.
  // =======================================

  if (!user && appleEmail && emailVerified) {
    user = await userModel.findOne({
      email: appleEmail,
    });
  }

  // =======================================
  // EXISTING USER
  // =======================================

  if (user) {
    if (user.isBlocked) {
      throw new ApiError(403, "Your account has been blocked");
    }

    let shouldSave = false;

    // ---------------------------------------
    // LINK APPLE ID
    // ---------------------------------------

    if (!user.appleId) {
      user.appleId = appleId;
      shouldSave = true;
    }

    // ---------------------------------------
    // SAVE NAME
    // Apple normally returns fullName only
    // on the first authorization.
    // ---------------------------------------

    if (normalizedName && (!user.name || user.name.trim() === "")) {
      user.name = normalizedName;
      shouldSave = true;
    }

    // ---------------------------------------
    // SAVE VERIFIED APPLE EMAIL
    // ---------------------------------------

    if (!user.email && appleEmail && emailVerified) {
      user.email = appleEmail;
      shouldSave = true;
    }

    // ---------------------------------------
    // AUTH PROVIDER
    // ---------------------------------------

    if (user.authProvider !== "apple") {
      user.authProvider = "apple";
      shouldSave = true;
    }

    // ---------------------------------------
    // USER VERIFICATION
    // ---------------------------------------

    if (!user.isVerified && emailVerified) {
      user.isVerified = true;
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
    }
  }

  // =======================================
  // NEW USER
  // =======================================
  else {
    /*
      For security:
      Prefer email coming from Apple token.

      Frontend-provided email should not make
      the account verified.
    */

    user = await userModel.create({
      name: normalizedName || appleEmail?.split("@")[0] || "Apple User",

      email: appleEmail || undefined,

      appleId,

      authProvider: "apple",

      isVerified: Boolean(appleEmail && emailVerified),
    });
  }

  // =======================================
  // GENERATE YOUR APPLICATION JWT
  // =======================================
  //
  // Your generateToken function:
  //
  // generateToken(userId)
  //
  // therefore pass ONLY user ID.
  // =======================================

  const token = generateToken(user._id.toString());

  // =======================================
  // RESPONSE
  // =======================================

  return {
    message: "Apple authentication successful",

    token,

    user: {
      id: user._id,

      name: user.name,

      email: user.email || null,

      phone: user.phone || null,

      profileImage: user.profileImage || null,

      authProvider: user.authProvider,

      isVerified: user.isVerified,
    },
  };
};
// ======================================================
// DUMMY MOBILE OTP
// ======================================================

// ======================================================
// SEND MOBILE LOGIN OTP
// ======================================================

// ======================================================
// DUMMY MOBILE OTP
// ======================================================

// ======================================================
// SEND MOBILE LOGIN OTP
// EXISTING USERS ONLY
// ======================================================

export const mobileLoginService = async ({ phone }) => {
  // ---------------------------------------
  // NORMALIZE PHONE
  // ---------------------------------------

  const cleanPhone = String(phone ?? "").trim();

  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!cleanPhone) {
    throw new ApiError(400, "Phone number is required");
  }

  if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
    throw new ApiError(400, "Please enter a valid phone number");
  }

  // ---------------------------------------
  // FIND EXISTING USER
  // ---------------------------------------

  const user = await userModel.findOne({
    phone: cleanPhone,
  });

  // ---------------------------------------
  // USER MUST ALREADY EXIST
  // ---------------------------------------

  if (!user) {
    throw new ApiError(404, "No account found with this phone number");
  }

  // ---------------------------------------
  // BLOCK CHECK
  // ---------------------------------------

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // ---------------------------------------
  // SAVE DUMMY OTP
  // ---------------------------------------

  await userModel.updateOne(
    {
      _id: user._id,
    },
    {
      $set: {
        otp: DUMMY_MOBILE_OTP,

        otpExpiry: new Date(Date.now() + 5 * 60 * 1000),

        otpPurpose: "LOGIN",

        otpAttempts: 0,
      },
    },
  );

  // ---------------------------------------
  // RESPONSE
  // ---------------------------------------

  return {
    phone: cleanPhone,

    // Development/testing only
    otp: DUMMY_MOBILE_OTP,
  };
};
// ======================================================
// VERIFY MOBILE LOGIN OTP
// ======================================================

// ======================================================
// VERIFY MOBILE LOGIN OTP
// ======================================================

export const verifyMobileOtpService = async ({ phone, otp }) => {
  // ---------------------------------------
  // NORMALIZE INPUT
  // ---------------------------------------

  const cleanPhone = String(phone ?? "").trim();

  const cleanOtp = String(otp ?? "").trim();

  // ---------------------------------------
  // VALIDATION
  // ---------------------------------------

  if (!cleanPhone) {
    throw new ApiError(400, "Phone number is required");
  }

  if (!cleanOtp) {
    throw new ApiError(400, "OTP is required");
  }

  if (!/^\d{4}$/.test(cleanOtp)) {
    throw new ApiError(400, "Please enter a valid 4-digit OTP");
  }

  // ---------------------------------------
  // FIND EXISTING USER
  // INCLUDING HIDDEN OTP FIELDS
  // ---------------------------------------

  const user = await userModel
    .findOne({
      phone: cleanPhone,
    })
    .select("+otp +otpExpiry +otpPurpose +otpAttempts");

  // ---------------------------------------
  // USER MUST EXIST
  // ---------------------------------------

  if (!user) {
    throw new ApiError(404, "No account found with this phone number");
  }

  // ---------------------------------------
  // BLOCK CHECK
  // ---------------------------------------

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // ---------------------------------------
  // CHECK OTP PURPOSE
  // ---------------------------------------

  if (user.otpPurpose !== "LOGIN") {
    throw new ApiError(400, "Please request a new login OTP");
  }

  // ---------------------------------------
  // CHECK OTP EXISTS
  // ---------------------------------------

  if (!user.otp) {
    throw new ApiError(400, "OTP not found. Please request a new OTP");
  }

  // ---------------------------------------
  // CHECK OTP EXPIRY
  // ---------------------------------------

  if (!user.otpExpiry || user.otpExpiry.getTime() <= Date.now()) {
    await userModel.updateOne(
      {
        _id: user._id,
      },
      {
        $set: {
          otp: null,
          otpExpiry: null,
          otpPurpose: null,
          otpAttempts: 0,
        },
      },
    );

    throw new ApiError(400, "OTP has expired. Please request a new OTP");
  }

  // ---------------------------------------
  // ATTEMPT LIMIT
  // ---------------------------------------

  if (Number(user.otpAttempts || 0) >= 5) {
    throw new ApiError(
      429,
      "Too many invalid OTP attempts. Please request a new OTP",
    );
  }

  // ---------------------------------------
  // VERIFY OTP
  // ---------------------------------------

  if (String(user.otp) !== cleanOtp) {
    user.otpAttempts = Number(user.otpAttempts || 0) + 1;

    await user.save();

    throw new ApiError(400, "Invalid OTP");
  }

  // ---------------------------------------
  // OTP SUCCESS
  // ---------------------------------------

  user.otp = null;
  user.otpExpiry = null;
  user.otpPurpose = null;
  user.otpAttempts = 0;

  await user.save();

  // ---------------------------------------
  // GENERATE FINAL AUTH TOKEN
  // ---------------------------------------

  const token = generateToken({
    userId: user._id,
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

      authProvider: user.authProvider,

      profileImage: user.profileImage,

      isVerified: user.isVerified,
    },
  };
};
