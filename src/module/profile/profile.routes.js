import express from "express";

import {
  saveProfileDetailsController,
  getProfileController,
  updateProfileController,
} from "./profile.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/addDetails", isAuthenticated, saveProfileDetailsController);

router.get("/get-profile", isAuthenticated, getProfileController);

router.patch(
  "/update-profile",
  isAuthenticated,
  updateProfileController
);
export default router;
