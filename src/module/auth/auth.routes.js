import express from "express";
import {
  signup,
  login,
  getMyProfile,
  verifySignupOtp,
  sendLoginOtp,
  verifyLoginOtp,
  createPassword,
} from "./auth.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", isAuthenticated, getMyProfile);
router.post("/verify-otp", verifySignupOtp);

router.post("/login/send-otp", sendLoginOtp);

router.post("/login/verify-otp", verifyLoginOtp);

router.post("/create-password", isAuthenticated, createPassword);

export default router;
