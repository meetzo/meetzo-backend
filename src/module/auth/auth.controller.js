import asyncHandler from "../../utils/asyncHandler.js";
import { signupService, loginService, getUserByIdService } from "./auth.service.js";

export const signup = asyncHandler(async (req, res) => {
  const result = await signupService(req.body || {});

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
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