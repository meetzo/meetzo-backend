import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/api.error.js";

import {
  saveProfileDetailsService,
  getProfileService,
  updateProfileService,
  addProfilePictureService,
  getProfilesByGenderService,
  getProfileCompletionService,
  addProfilePhotosService,
  updateAboutMeService,
  getMyProfilePhotosService,
  deleteProfilePhotoService,
  updateUserLocationService,
} from "./profile.service.js";

// export const saveProfileDetailsController = asyncHandler(async (req, res) => {
//   const profile = await saveProfileDetailsService({
//     userId: req.user?._id || req.user?.id,
//     profileData: req.body || {},
//   });

//   return res.status(201).json({
//     success: true,
//     message: "Profile details saved successfully",
//     data: profile,
//   });
// });

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

export const addProfilePicture = asyncHandler(async (req, res) => {
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
});

export const getProfilesByGenderController = asyncHandler(async (req, res) => {
  const currentUserId = req.user?._id || req.user?.id;

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
});

export const getProfileCompletionController = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id || req.userId;

  const result = await getProfileCompletionService({
    userId,
  });

  return res.status(200).json({
    success: true,
    message: "Profile completion fetched successfully",
    data: result,
  });
});

// =====================================
// ADD PROFILE PHOTOS
// Public: minimum 2, maximum 6
// Private: minimum 0, maximum 6
// =====================================
export const addProfilePhotos = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const publicPhotos = req.files?.publicPhotos || [];

  const privatePhotos = req.files?.privatePhotos || [];

  const hasPublicPhotos = publicPhotos.length > 0;

  const hasPrivatePhotos = privatePhotos.length > 0;

  // =====================================
  // AT LEAST ONE PHOTO TYPE REQUIRED
  // =====================================

  if (!hasPublicPhotos && !hasPrivatePhotos) {
    throw new ApiError(400, "Please upload public photos or private photos");
  }

  // =====================================
  // PUBLIC PHOTOS: MINIMUM 2
  // =====================================

  if (hasPublicPhotos && publicPhotos.length < 2) {
    throw new ApiError(400, "Please upload at least 2 public photos");
  }

  // =====================================
  // PRIVATE PHOTOS: MINIMUM 1
  // =====================================

  if (hasPrivatePhotos && privatePhotos.length < 1) {
    throw new ApiError(400, "Please upload at least 1 private photo");
  }

  const result = await addProfilePhotosService({
    userId,
    publicPhotos,
    privatePhotos,
  });

  return res.status(200).json({
    success: true,
    message: "Profile photos added successfully",
    data: result,
  });
});
export const getMyProfilePhotos = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id || req.userId;

  const result = await getMyProfilePhotosService({
    userId,
  });

  return res.status(200).json({
    success: true,
    message: "Profile photos fetched successfully",
    data: result,
  });
});

// =====================================
// UPDATE ABOUT ME
// =====================================

export const updateAboutMe = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const { bio, showBioOnProfile } = req.body || {};

  const cleanBio = String(bio ?? "").trim();

  if (!cleanBio) {
    throw new ApiError(400, "About me is required");
  }

  if (cleanBio.length > 500) {
    throw new ApiError(400, "About me cannot exceed 500 characters");
  }

  if (showBioOnProfile !== undefined && typeof showBioOnProfile !== "boolean") {
    throw new ApiError(400, "showBioOnProfile must be true or false");
  }

  const result = await updateAboutMeService({
    userId,
    bio: cleanBio,
    showBioOnProfile,
  });

  return res.status(200).json({
    success: true,
    message: "About me updated successfully",
    data: result,
  });
});

// export const deleteProfilePhoto = asyncHandler(async (req, res) => {
//   const userId = req.user?._id || req.user?.id || req.userId;

//   const { photoId } = req.params;
//   console.log({ photoId });

//   const result = await deleteProfilePhotoService({
//     userId,
//    fieldId: photoId,
//   });

//   return res.status(200).json({
//     success: true,
//     message: "Profile photo deleted successfully",
//     data: result,
//   });
// });


export const deleteProfilePhoto = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id || req.userId;
  const { photoId } = req.params;

  const result = await deleteProfilePhotoService({
    userId,
    fieldId: photoId,
  });

  return res.status(200).json({
    success: true,
    message: "Photo deleted successfully",
    data: result,
  });
});

export const updateUserLocationController = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user._id;

    const {
      latitude,
      longitude,
    } = req.body;

    const result =
      await updateUserLocationService({
        userId,
        latitude,
        longitude,
      });

    return res.status(200).json({
      success: true,
      message:
        "Location updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};