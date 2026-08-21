import express from "express";

import {
  saveProfileDetailsController,
  getProfileController,
  updateProfileController,
  addProfilePicture,
  getProfilesByGenderController,
  getProfileCompletionController,
} from "./profile.controller.js";

import { uploadProfilePicture } from "../../middleware/upload.middleware.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/addDetails", isAuthenticated, saveProfileDetailsController);

router.get("/get-profile", isAuthenticated, getProfileController);

router.patch("/update-profile", isAuthenticated, updateProfileController);

router.patch(
  "/add_profile_picture",
  isAuthenticated,
  uploadProfilePicture.single("profileImage"),
  addProfilePicture,
);

router.get(
  "/get-profiles-by-gender",
  isAuthenticated,
  getProfilesByGenderController
);

router.get(
  "/completion",
  isAuthenticated,
  getProfileCompletionController
);

export default router;
