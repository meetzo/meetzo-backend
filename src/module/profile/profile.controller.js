import asyncHandler from "../../utils/asyncHandler.js";

import { saveProfileDetailsService } from "./profile.service.js";

export const saveProfileDetailsController = asyncHandler(async (req, res) => {
  const profile = await saveProfileDetailsService({
    userId: req.user?._id || req.user?.id,
    profileData: req.body || {},
  });

  return res.status(200).json({
    success: true,
    message: "Profile details saved successfully",
    data: profile,
  });
});
