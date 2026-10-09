import express from "express";

import {
  saveProfileDetailsController,
  getProfileController,
  updateProfileController,
  addProfilePicture,
  getProfilesByGenderController,
  getProfileCompletionController,
  addProfilePhotos,
  updateAboutMe,
  getMyProfilePhotos,
  deleteProfilePhoto,
  updateUserLocationController
} from "./profile.controller.js";

import { uploadProfilePicture } from "../../middleware/upload.middleware.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

// =====================================
// SAVE PROFILE DETAILS
// =====================================

router.post("/addDetails", isAuthenticated, saveProfileDetailsController);

// =====================================
// GET MY PROFILE
// =====================================

router.get("/get-profile", isAuthenticated, getProfileController);

// =====================================
// UPDATE PROFILE
// =====================================

router.patch("/update-profile", isAuthenticated, updateProfileController);

// =====================================
// OLD SINGLE PROFILE PICTURE ENDPOINT
// =====================================

router.patch(
  "/add_profile_pictures",
  isAuthenticated,
  uploadProfilePicture.array("profileImage", 6),
  addProfilePicture,
);

// ==================================
// GET PROFILES BY GENDER
// ==================================

router.get(
  "/get-profiles-by-gender",
  isAuthenticated,
  getProfilesByGenderController,
);

// =====================================
// PROFILE COMPLETION
// =====================================

router.get("/completion", isAuthenticated, getProfileCompletionController);

// =====================================
// ADD PUBLIC AND PRIVATE PHOTOS
// Public: minimum 2, maximum 6
// Private: minimum 0, maximum 6
// =====================================

router.post(
  "/add-photos",
  isAuthenticated,

  uploadProfilePicture.fields([
    {
      name: "publicPhotos",
      maxCount: 6,
    },
    {
      name: "privatePhotos",
      maxCount: 6,
    },
  ]),

  addProfilePhotos,
);

router.get("/my-photos", isAuthenticated, getMyProfilePhotos);

router.delete(
  "/delete-my-photos/:photoId",
  isAuthenticated,
  deleteProfilePhoto,
);

// =====================================
// UPDATE ABOUT ME
// =====================================

router.post("/about-me", isAuthenticated, updateAboutMe);

//PATCH /api/profile/update_location
router.patch("/update_location", isAuthenticated,updateUserLocationController )



export default router;
