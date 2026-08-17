import express from "express";

import { saveProfileDetailsController } from "./profile.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.put("/details", isAuthenticated, saveProfileDetailsController);

export default router;
