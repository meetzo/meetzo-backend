import asyncHandler from "../../utils/asyncHandler.js";

import {
  signupService,
  loginService,
  getUserByIdService,
  verifySignupOtpService,
  sendEmailLoginOtpService,
  verifyEmailLoginOtpService,
  createPasswordService,
  googleAuthService,
  googleAndroidAuthService,
  appleLoginService,
  mobileLoginService,
  verifyMobileOtpService,

} from "./auth.service.js";

import ApiError from "../../utils/api.error.js";
import {
  loginSchema,
  signupOtpSchema,
  signupSchema,
  validateAuthBody,
} from "./auth.validation.js";

// =====================================================
// SIGNUP - SEND OTP
// =====================================================

export const signup = asyncHandler(async (req, res) => {
  const signupData = validateAuthBody(signupSchema, req.body);
  const result = await signupService(signupData);

  return res.status(200).json({
    success: true,
    message: result.message,
    token: result.otpToken,
  });
});

// =====================================================
// VERIFY SIGNUP OTP
// =====================================================

export const verifySignupOtp = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "OTP bearer token is required");
  }

  const otpToken = authHeader.slice(7).trim();

  if (!otpToken) {
    throw new ApiError(401, "Invalid OTP bearer token");
  }

  const { otp } = validateAuthBody(signupOtpSchema, req.body);

  const result = await verifySignupOtpService({
    otpToken,
    otp,
  });

  return res.status(201).json({
    success: true,

    message: result.message || "Account verified successfully",

    token: result.token,

    data: result.user,
  });
});

export const login = asyncHandler(async (req, res) => {
  const loginData = validateAuthBody(loginSchema, req.body);
  const result = await loginService(loginData);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token: result.token,
    data: result.user,
  });
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const user = await getUserByIdService(req.user.id);
  return res.status(200).json({
    success: true,
    message: "User profile fetched successfully",
    data: user,
  });
});

// ======================================================
// SEND EMAIL LOGIN OTP
// ======================================================

export const sendEmailLoginOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await sendEmailLoginOtpService({
    email,
  });

  return res.status(200).json({
    success: true,
    message: "Login OTP sent successfully to your email.",
    data: result,
  });
});

// ======================================================
// VERIFY EMAIL LOGIN OTP
// ======================================================

export const verifyEmailLoginOtp = asyncHandler(async (req, res) => {
  // ---------------------------------------
  // GET TEMP ACCESS TOKEN
  // ---------------------------------------

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    throw new ApiError(401, "OTP verification access token is required.");
  }

  const accessToken = authHeader.split(" ")[1]?.trim();

  const { otp } = req.body;

  // ---------------------------------------
  // VERIFY OTP
  // ---------------------------------------

  const result = await verifyEmailLoginOtpService({
    accessToken,
    otp,
  });

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    data: result,
  });
});
export const createPassword = asyncHandler(async (req, res) => {
  const { password, confirmPassword } = req.body || {};

  const result = await createPasswordService({
    userId: req.user.id,
    password,
    confirmPassword,
  });

  return res.status(200).json({
    success: true,
    message: "Password created successfully",
    data: result.user,
  });
});

export const googleAuthController = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    const result = await googleAuthService(idToken);

    return res.status(200).json({
      success: true,
      message: result.message,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error("GOOGLE AUTH ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
};

export const appleLogin = async (req, res) => {
  try {
    const { identityToken, email, fullName } = req.body;

    if (!identityToken) {
      return res.status(400).json({
        success: false,
        message: "Apple identity token is required",
      });
    }

    const result = await appleLoginService({
      identityToken,
      email,
      fullName,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("APPLE LOGIN ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Apple authentication failed",
    });
  }
};

export const mobileLoginController = async (req, res, next) => {
  try {
    const { phone } = req.body;

    const result = await mobileLoginService({
      phone,
    });

    return res.status(200).json({
      success: true,

      message: "OTP sent successfully",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};
export const verifyMobileOtpController = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    const result = await verifyMobileOtpService({
      phone,
      otp,
    });

    return res.status(200).json({
      success: true,

      message: "Mobile login successful",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};
