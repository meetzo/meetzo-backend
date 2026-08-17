import asyncHandler from "../../utils/asyncHandler.js";
import {
  signupService,
  loginService,
  getUserByIdService,
  verifyOtpService,
  sendEmailLoginOtpService,
  verifyEmailLoginOtpService,
  createPasswordService,
} from "./auth.service.js";
import ApiError from "../../utils/api.error.js";

export const signup = asyncHandler(async (req, res) => {
  const result = await signupService(req.body || {});

  return res.status(201).json({
    success: true,
    message: result.message,
    data: result.user,
    token: result.otpToken,
  });
});

export const verifySignupOtp = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "OTP bearer token is required");
  }

  const otpToken = authHeader.split(" ")[1]?.trim();
  const { otp } = req.body || {};

  if (!otpToken) {
    throw new ApiError(401, "Invalid OTP bearer token");
  }

  if (otp === undefined || otp === null || String(otp).trim() === "") {
    throw new ApiError(400, "OTP is required");
  }

  const result = await verifyOtpService({
    otpToken,
    otp,
  });

  return res.status(200).json({
    success: true,
    message: "Account verified successfully",
    token: result.token,
    data: result.user,
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginService(req.body || {});

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

export const sendEmailLoginOtp = asyncHandler(
  async (req, res) => {
    const { email } = req.body;

    const result = await sendEmailLoginOtpService({
      email,
    });

    return res.status(200).json({
      success: true,
      message:
        "Login OTP sent successfully to your email.",
      data: result,
    });
  },
);


// ======================================================
// VERIFY EMAIL LOGIN OTP
// ======================================================

export const verifyEmailLoginOtp = asyncHandler(
  async (req, res) => {
    // ---------------------------------------
    // GET TEMP ACCESS TOKEN
    // ---------------------------------------

    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer")
    ) {
      throw new ApiError(
        401,
        "OTP verification access token is required.",
      );
    }

    const accessToken = authHeader
      .split(" ")[1]
      ?.trim();

    const { otp } = req.body;

    // ---------------------------------------
    // VERIFY OTP
    // ---------------------------------------

    const result =
      await verifyEmailLoginOtpService({
        accessToken,
        otp,
      });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  },
);
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
