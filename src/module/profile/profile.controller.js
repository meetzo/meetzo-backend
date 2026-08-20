import asyncHandler from "../../utils/asyncHandler.js";
import imageKit from "./imageKit.service.js";
import profileModel from "../../models/profileModel.js";
import ApiError from "../../utils/api.error.js";

import {
  saveProfileDetailsService,
  getProfileService,
  updateProfileService,
  addProfilePictureService,
  getProfilesByGenderService,
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

export const addProfilePicture = asyncHandler(
  async (req, res) => {
    const userId = req.user?._id || req.user?.id;

    const result = await addProfilePictureService({
      userId,
      file: req.file,
    });

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      data: result,
    });
  }
);

export const getProfilesByGenderController = asyncHandler(
  async (req, res) => {
    const currentUserId =
      req.user?._id || req.user?.id;

    const result = await getProfilesByGenderService({
      currentUserId,
      genders: req.query.genders,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Discovery profiles fetched successfully",
      data: result.profiles,
      pagination: result.pagination,
    });
  }
);