import express from "express";
import {
  signup,
  getMyProfile,
  verifySignupOtp,
  sendEmailLoginOtp,
  verifyEmailLoginOtp,
  createPassword,
  googleAuthController,
  appleLogin,
  mobileLoginController,
  verifyMobileOtpController

} from "./auth.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.get("/me", isAuthenticated, getMyProfile);
router.post("/verify-signup-otp", verifySignupOtp);

//email login routes
router.post("/email_login", sendEmailLoginOtp);
router.post("/verify_email", verifyEmailLoginOtp);

router.post("/create-password", isAuthenticated, createPassword);

//sso routes

router.post("/google_login", googleAuthController);
router.post("/apple_login", appleLogin);

//mobile login routes

router.post("/mobile_login", mobileLoginController);
router.post("/verify_mobile_otp", verifyMobileOtpController);


export default router;
