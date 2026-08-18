import asyncHandler from "../../utils/asyncHandler.js";

import {
  saveProfileDetailsService,
  getProfileService,
  updateProfileService,
} from "./profile.service.js";

export const saveProfileDetailsController = asyncHandler(async (req, res) => {
  const profile = await saveProfileDetailsService({
    userId: req.user?._id || req.user?.id,
    profileData: req.body || {},
  });

  return res.status(201).json({
    success: true,
    message: "Profile details saved successfully",
    data: profile,
  });
});

export const getProfileController = asyncHandler(async (req, res) => {
  const data = await getProfileService({
    userId: req.user?._id || req.user?.id,
  });

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data,
  });
});

export const updateProfileController = asyncHandler(async (req, res) => {
  const profile = await updateProfileService({
    userId: req.user?._id || req.user?.id,

    profileData: req.body || {},
  });

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile,
  });
});
