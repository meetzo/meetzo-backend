import express from "express";
import {
  signup,
  login,
  getMyProfile,
  verifySignupOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
  createPassword,
} from "./auth.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", isAuthenticated, getMyProfile);
router.post("/verify-signup-otp", verifySignupOtp);

//email login routes
router.post("/email_login", sendEmailLoginOtp);
router.post("/verify_email", verifyEmailLoginOtp);

router.post("/create-password", isAuthenticated, createPassword);

export default router;
