import express from "express";
import { signup, login ,getMyProfile ,verifySignupOtp} from "./auth.controller.js";
import {isAuthenticated} from "../../middleware/auth.middleware.js"; 

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", isAuthenticated, getMyProfile);
router.post("/verify-otp", verifySignupOtp);

export default router;