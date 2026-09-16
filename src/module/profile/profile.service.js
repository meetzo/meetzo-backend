import profileModel from "../../models/profileModel.js";
import mongoose from "mongoose";
import userModel from "../../models/userModel.js";
import ApiError from "../../utils/api.error.js";
import imageKit from "./imageKit.service.js";
import { calculateProfileCompletion } from "../../utils/calculateProfileCompletion.js";

/**
 * Calculate age from date of birth.
 */

// =====================================
// IMAGEKIT UPLOAD HELPER
// =====================================

const uploadPhotoToImageKit = async ({ file, folder }) => {
  const result = await imageKit.upload({
    file: file.buffer,
    fileName: `${Date.now()}-${file.originalname}`,
    folder,
    useUniqueFileName: true,
  });

  return {
    url: result.url,
    fileId: result.fileId,
  };
};

// =====================================
// IMAGEKIT DELETE HELPER
// =====================================

const deletePhotoFromImageKit = async (fileId) => {
  if (!fileId) {
    return;
  }

  await imageKit.deleteFile(fileId);
};

const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    throw new ApiError(400, "Invalid date of birth");
  }
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age;
};

const normalizeArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
  ];
};

/**
 * Convert optional value to a trimmed string.
 */
const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
};

export const saveProfileDetailsService = async ({
  userId,
  profileData = {},
}) => {
  // Authentication validation
  if (!userId) {
    throw new ApiError(401, "Authentication is required");
  }

  // Check whether user exists
  const user = await userModel.findById(userId).select("_id isBlocked");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  const {
    dateOfBirth,
    height,
    languages,

    gender,
    genderDescription,
    showGenderOnProfile,

    profession,
    customProfession,

    orientation,
    customOrientation,
    showOrientationOnProfile,

    meetzoGoal,
    relationshipPace,

    smoking,
    drinking,
    fitness,
    pets,

    selfDescription,
    interests,

    religion,
    customReligion,

    idealWeekend,
    values,
  } = profileData;

  // Basic required-field validation
  const requiredFields = {
    dateOfBirth,
    height,
    languages,
    gender,
    profession,
    orientation,
    meetzoGoal,
    relationshipPace,
    smoking,
    drinking,
    fitness,
    pets,
    selfDescription,
    interests,
    religion,
    idealWeekend,
    values,
  };

  const missingField = Object.entries(requiredFields).find(
    ([, value]) =>
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0),
  );

  if (missingField) {
    throw new ApiError(400, `${missingField[0]} is required`);
  }

  // Date-of-birth and age validation
  const age = calculateAge(dateOfBirth);

  if (age < 18) {
    throw new ApiError(400, "You must be at least 18 years old");
  }

  // Height object validation
  if (typeof height !== "object" || height === null || Array.isArray(height)) {
    throw new ApiError(400, "Height must contain value and unit");
  }

  const heightValue = Number(height.value);

  const heightUnit = String(height.unit || "")
    .trim()
    .toUpperCase();

  if (
    !Number.isFinite(heightValue) ||
    heightValue <= 0 ||
    !["CM", "FT", "IN"].includes(heightUnit)
  ) {
    throw new ApiError(400, "Valid height value and unit are required");
  }

  // Normalize array fields
  const normalizedLanguages = normalizeArray(languages);

  const normalizedSelfDescription = normalizeArray(selfDescription);

  const normalizedInterests = normalizeArray(interests);

  const normalizedIdealWeekend = normalizeArray(idealWeekend);

  const normalizedValues = normalizeArray(values);

  // Validate arrays
  if (normalizedLanguages.length === 0) {
    throw new ApiError(400, "At least one language is required");
  }

  if (normalizedSelfDescription.length < 1) {
    throw new ApiError(400, "Select more than 1 personality traits");
  }

  if (normalizedInterests.length < 1 || normalizedInterests.length > 6) {
    throw new ApiError(400, "Select between 1 and 6 interests");
  }

  if (normalizedIdealWeekend.length < 1 || normalizedIdealWeekend.length > 6) {
    throw new ApiError(400, "Select between 1 and 6 weekend preferences");
  }

  if (normalizedValues.length < 1 || normalizedValues.length > 6) {
    throw new ApiError(400, "Select between 1 and 6 values");
  }

  // Normalize optional/manual fields
  const normalizedGenderDescription =
    normalizeOptionalString(genderDescription);

  const normalizedCustomProfession = normalizeOptionalString(customProfession);

  const normalizedCustomOrientation =
    normalizeOptionalString(customOrientation);

  const normalizedCustomReligion = normalizeOptionalString(customReligion);

  // Gender description validation
  if (normalizedGenderDescription && normalizedGenderDescription.length > 200) {
    throw new ApiError(400, "Gender description cannot exceed 200 characters");
  }

  // Manual profession validation
  if (profession === "OTHER" && !normalizedCustomProfession) {
    throw new ApiError(400, "Custom profession is required");
  }

  if (normalizedCustomProfession && normalizedCustomProfession.length > 100) {
    throw new ApiError(400, "Custom profession cannot exceed 100 characters");
  }

  // Manual orientation validation
  if (orientation === "OTHER" && !normalizedCustomOrientation) {
    throw new ApiError(400, "Custom orientation is required");
  }

  // Manual religion validation
  if (religion === "OTHER" && !normalizedCustomReligion) {
    throw new ApiError(400, "Custom religion is required");
  }

  const normalizedData = {
    dateOfBirth: new Date(dateOfBirth),

    height: {
      value: heightValue,
      unit: heightUnit,
    },

    languages: normalizedLanguages,

    gender,

    genderDescription: normalizedGenderDescription,

    showGenderOnProfile: showGenderOnProfile ?? true,

    profession,

    customProfession:
      profession === "OTHER" ? normalizedCustomProfession : null,

    orientation,

    customOrientation:
      orientation === "OTHER" ? normalizedCustomOrientation : null,

    showOrientationOnProfile: showOrientationOnProfile ?? true,

    meetzoGoal,
    relationshipPace,

    smoking,
    drinking,
    fitness,
    pets,

    selfDescription: normalizedSelfDescription,

    interests: normalizedInterests,

    religion,

    customReligion: religion === "OTHER" ? normalizedCustomReligion : null,

    idealWeekend: normalizedIdealWeekend,

    values: normalizedValues,

    isProfileCompleted: true,
    completedAt: new Date(),
  };

  // Create a new profile or update existing profile
  const profile = await profileModel.findOneAndUpdate(
    {
      userId,
    },
    {
      $set: normalizedData,

      $setOnInsert: {
        userId,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return profile;
};

export const getProfileService = async ({ userId }) => {
  if (!userId) {
    throw new ApiError(401, "Authentication is required");
  }

  const user = await userModel
    .findById(userId)
    .select("name email phone role isVerified isBlocked createdAt updatedAt")
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  const profile = await profileModel.findOne({ userId }).lean();

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  return {
    user,
    profile,
  };
};

export const updateProfileService = async ({ userId, profileData = {} }) => {
  // ---------------------------------------
  // AUTHENTICATION
  // ---------------------------------------

  if (!userId) {
    throw new ApiError(401, "Authentication is required");
  }

  // ---------------------------------------
  // CHECK USER
  // ---------------------------------------

  const user = await userModel.findById(userId).select("_id isBlocked");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // ---------------------------------------
  // CHECK PROFILE
  // ---------------------------------------

  const existingProfile = await profileModel.findOne({
    userId,
  });

  if (!existingProfile) {
    throw new ApiError(
      404,
      "Profile not found. Please complete your profile first",
    );
  }

  // ---------------------------------------
  // ALLOWED UPDATE FIELDS
  // ---------------------------------------

  const allowedFields = [
    "dateOfBirth",
    "height",
    "languages",

    "gender",
    "genderDescription",
    "showGenderOnProfile",

    "profession",
    "customProfession",

    "orientation",
    "customOrientation",
    "showOrientationOnProfile",

    "meetzoGoal",
    "relationshipPace",

    "smoking",
    "drinking",
    "fitness",
    "pets",

    "selfDescription",
    "interests",

    "religion",
    "customReligion",

    "idealWeekend",
    "values",

    "bio",
    "education",
    "college",
    "company",
    "jobTitle",
    "city",
    "hometown",
  ];

  const updateData = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(profileData, field)) {
      updateData[field] = profileData[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "No valid profile fields provided");
  }

  // ---------------------------------------
  // DATE OF BIRTH
  // ---------------------------------------

  if (updateData.dateOfBirth !== undefined) {
    const age = calculateAge(updateData.dateOfBirth);

    if (age < 18) {
      throw new ApiError(400, "You must be at least 18 years old");
    }

    updateData.dateOfBirth = new Date(updateData.dateOfBirth);
  }

  // ---------------------------------------
  // HEIGHT
  // ---------------------------------------

  if (updateData.height !== undefined) {
    const height = updateData.height;

    if (
      typeof height !== "object" ||
      height === null ||
      Array.isArray(height)
    ) {
      throw new ApiError(400, "Height must contain value and unit");
    }

    const heightValue = Number(height.value);

    const heightUnit = String(height.unit || "")
      .trim()
      .toUpperCase();

    if (
      !Number.isFinite(heightValue) ||
      heightValue <= 0 ||
      !["CM", "FT"].includes(heightUnit)
    ) {
      throw new ApiError(400, "Valid height value and unit are required");
    }

    updateData.height = {
      value: heightValue,
      unit: heightUnit,
    };
  }

  // ---------------------------------------
  // ARRAY FIELDS
  // ---------------------------------------

  const arrayRules = {
    languages: {
      min: 1,
      max: Infinity,
      message: "At least one language is required",
    },

    selfDescription: {
      min: 1,
      max: 3,
      message: "Select between 1 and 3 personality traits",
    },

    interests: {
      min: 1,
      max: 5,
      message: "Select between 1 and 5 interests",
    },

    idealWeekend: {
      min: 1,
      max: 3,
      message: "Select between 1 and 3 weekend preferences",
    },

    values: {
      min: 1,
      max: 3,
      message: "Select between 1 and 3 values",
    },
  };

  for (const [field, rule] of Object.entries(arrayRules)) {
    if (updateData[field] !== undefined) {
      const normalizedValues = normalizeArray(updateData[field]);

      if (
        normalizedValues.length < rule.min ||
        normalizedValues.length > rule.max
      ) {
        throw new ApiError(400, rule.message);
      }

      updateData[field] = normalizedValues;
    }
  }

  // ---------------------------------------
  // OPTIONAL STRING FIELDS
  // ---------------------------------------

  const optionalStringFields = [
    "genderDescription",
    "customProfession",
    "customOrientation",
    "customReligion",
    "bio",
    "education",
    "college",
    "company",
    "jobTitle",
    "city",
    "hometown",
  ];

  for (const field of optionalStringFields) {
    if (updateData[field] !== undefined) {
      updateData[field] = normalizeOptionalString(updateData[field]);
    }
  }

  // ---------------------------------------
  // BOOLEAN FIELDS
  // ---------------------------------------

  const booleanFields = ["showGenderOnProfile", "showOrientationOnProfile"];

  for (const field of booleanFields) {
    if (
      updateData[field] !== undefined &&
      typeof updateData[field] !== "boolean"
    ) {
      throw new ApiError(400, `${field} must be true or false`);
    }
  }

  // ---------------------------------------
  // FINAL CONDITIONAL VALUES
  // ---------------------------------------

  const finalProfession = updateData.profession ?? existingProfile.profession;

  const finalOrientation =
    updateData.orientation ?? existingProfile.orientation;

  const finalReligion = updateData.religion ?? existingProfile.religion;

  const finalCustomProfession =
    updateData.customProfession !== undefined
      ? updateData.customProfession
      : existingProfile.customProfession;

  const finalCustomOrientation =
    updateData.customOrientation !== undefined
      ? updateData.customOrientation
      : existingProfile.customOrientation;

  const finalCustomReligion =
    updateData.customReligion !== undefined
      ? updateData.customReligion
      : existingProfile.customReligion;

  // ---------------------------------------
  // CUSTOM PROFESSION
  // ---------------------------------------

  if (finalProfession === "OTHER") {
    if (!finalCustomProfession) {
      throw new ApiError(400, "Custom profession is required");
    }
  } else {
    updateData.customProfession = null;
  }

  // ---------------------------------------
  // CUSTOM ORIENTATION
  // ---------------------------------------

  if (finalOrientation === "OTHER") {
    if (!finalCustomOrientation) {
      throw new ApiError(400, "Custom orientation is required");
    }
  } else {
    updateData.customOrientation = null;
  }

  // ---------------------------------------
  // CUSTOM RELIGION
  // ---------------------------------------

  if (finalReligion === "OTHER") {
    if (!finalCustomReligion) {
      throw new ApiError(400, "Custom religion is required");
    }
  } else {
    updateData.customReligion = null;
  }

  // ---------------------------------------
  // UPDATE PROFILE
  // ---------------------------------------

  const updatedProfile = await profileModel.findOneAndUpdate(
    {
      userId,
    },
    {
      $set: updateData,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  return updatedProfile;
};

export const addProfilePictureService = async ({ userId, file }) => {
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!file) {
    throw new ApiError(400, "Profile picture is required");
  }

  const user = await userModel.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const oldProfileImageId = user.profileImageId;

  let uploadedImage;

  try {
    uploadedImage = await imageKit.upload({
      file: file.buffer.toString("base64"),
      fileName: `profile-${userId}-${Date.now()}`,
      folder: "/Meetzo/Profile_Picture",
      useUniqueFileName: true,
      tags: ["profile-picture", String(userId)],
    });
  } catch (error) {
    throw new ApiError(500, `Profile picture upload failed: ${error.message}`);
  }

  try {
    user.profileImage = uploadedImage.url;
    user.profileImageId = uploadedImage.fileId;

    await user.save();
  } catch (error) {
    // Database update failed, remove the newly uploaded image
    try {
      await imageKit.deleteFile(uploadedImage.fileId);
    } catch (deleteError) {
      console.error("New ImageKit file cleanup failed:", deleteError.message);
    }

    throw new ApiError(500, "Unable to update profile picture");
  }

  // Delete the previous ImageKit image after DB update succeeds
  if (oldProfileImageId && oldProfileImageId !== uploadedImage.fileId) {
    try {
      await imageKit.deleteFile(oldProfileImageId);
    } catch (error) {
      console.error("Old profile picture deletion failed:", error.message);
    }
  }

  return {
    profileImage: user.profileImage,
    profileImageId: user.profileImageId,
  };
};

const ALLOWED_GENDERS = ["MALE", "FEMALE", "NON_BINARY", "OTHER"];

const parseGenderQuery = (genders) => {
  if (!genders) {
    throw new ApiError(400, "genders query parameter is required");
  }

  const genderValues = Array.isArray(genders)
    ? genders
    : String(genders).split(",");

  const normalizedGenders = [
    ...new Set(
      genderValues
        .map((gender) => String(gender).trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (normalizedGenders.length === 0) {
    throw new ApiError(400, "At least one gender must be selected");
  }

  const invalidGenders = normalizedGenders.filter(
    (gender) => !ALLOWED_GENDERS.includes(gender),
  );

  if (invalidGenders.length > 0) {
    throw new ApiError(400, `Invalid genders: ${invalidGenders.join(", ")}`);
  }

  return normalizedGenders;
};

export const getProfilesByGenderService = async ({
  currentUserId,
  genders,
  page = 1,
  limit = 10,
}) => {
  // Authentication
  if (!currentUserId) {
    throw new ApiError(401, "Authentication is required");
  }

  // Check current user
  const currentUser = await userModel
    .findById(currentUserId)
    .select("_id isBlocked");

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  if (currentUser.isBlocked) {
    throw new ApiError(403, "Your account has been blocked");
  }

  // Validate genders
  const selectedGenders = parseGenderQuery(genders);

  // Pagination
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);

  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 10, 1),
    50,
  );

  const skip = (normalizedPage - 1) * normalizedLimit;

  // Discovery filter
  const filter = {
    userId: {
      $ne: currentUserId,
    },

    gender: {
      $in: selectedGenders,
    },

    isProfileCompleted: true,
  };

  const [profiles, totalProfiles] = await Promise.all([
    profileModel
      .find(filter)
      .populate({
        path: "userId",
        select: "name email phone isVerified isBlocked",
      })
      .select(
        [
          "userId",
          "profileImage",
          "dateOfBirth",
          "height",
          "languages",
          "gender",
          "genderDescription",
          "showGenderOnProfile",
          "profession",
          "customProfession",
          "orientation",
          "customOrientation",
          "showOrientationOnProfile",
          "meetzoGoal",
          "relationshipPace",
          "smoking",
          "drinking",
          "fitness",
          "pets",
          "selfDescription",
          "interests",
          "religion",
          "idealWeekend",
          "values",
          "bio",
          "education",
          "college",
          "company",
          "jobTitle",
          "city",
          "hometown",
          "isFaceVerified",
          "isKycVerified",
          "createdAt",
        ].join(" "),
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(normalizedLimit)
      .lean(),

    profileModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalProfiles / normalizedLimit);

  return {
    profiles,

    pagination: {
      currentPage: normalizedPage,
      limit: normalizedLimit,
      totalProfiles,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPreviousPage: normalizedPage > 1,
    },
  };
};

export const getProfileCompletionService = async ({ userId }) => {
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const profile = await profileModel.findOne({ userId }).lean();

  if (!profile) {
    return {
      completionPercentage: 0,
      isProfileCompleted: false,

      breakdown: {
        details: {
          earned: 0,
          total: 40,
        },

        profilePhoto: {
          earned: 0,
          total: 15,
          completed: false,
        },

        kyc: {
          earned: 0,
          total: 15,
          completed: false,
          status: "NOT_STARTED",
        },

        faceVerification: {
          earned: 0,
          total: 15,
          completed: false,
          status: "NOT_STARTED",
        },

        optionalDetails: {
          earned: 0,
          total: 15,
        },
      },

      missingSections: [
        "DETAILS",
        "PROFILE_PHOTO",
        "KYC",
        "FACE_VERIFICATION",
        "OPTIONAL_DETAILS",
      ],
    };
  }

  return calculateProfileCompletion(profile);
};

// =====================================
// ADD PROFILE PHOTOS SERVICE
// Public: minimum 2, maximum 6
// Private: minimum 0, maximum 6
// =====================================

export const addProfilePhotosService = async ({
  userId,
  publicPhotos = [],
  privatePhotos = [],
}) => {
  if (!userId) {
    throw new ApiError(
      401,
      "Authentication required",
    );
  }

  // =====================================
  // FIND PROFILE
  // =====================================

  const profile = await profileModel.findOne({
    userId,
  });

  if (!profile) {
    throw new ApiError(
      404,
      "Please complete profile details first",
    );
  }

  // =====================================
  // EXISTING PHOTOS
  // =====================================

  const existingPublicPhotos =
    profile.photos.filter(
      (photo) =>
        photo.visibility === "PUBLIC",
    );

  const existingPrivatePhotos =
    profile.photos.filter(
      (photo) =>
        photo.visibility === "PRIVATE",
    );

  const existingPublicCount =
    existingPublicPhotos.length;

  const existingPrivateCount =
    existingPrivatePhotos.length;

  // =====================================
  // NEW PHOTOS
  // =====================================

  const newPublicCount =
    publicPhotos.length;

  const newPrivateCount =
    privatePhotos.length;

  const hasPublicPhotos =
    newPublicCount > 0;

  const hasPrivatePhotos =
    newPrivateCount > 0;

  // =====================================
  // TOTAL COUNTS
  // =====================================

  const totalPublicCount =
    existingPublicCount +
    newPublicCount;

  const totalPrivateCount =
    existingPrivateCount +
    newPrivateCount;

  // =====================================
  // VALIDATIONS
  // =====================================

  // At least public or private photo required
  if (
    !hasPublicPhotos &&
    !hasPrivatePhotos
  ) {
    throw new ApiError(
      400,
      "Please upload at least one photo",
    );
  }

  // Public photos minimum 2
  if (
    hasPublicPhotos &&
    newPublicCount < 2
  ) {
    throw new ApiError(
      400,
      "Please upload at least 2 public photos",
    );
  }

  // Private photos minimum 1
  if (
    hasPrivatePhotos &&
    newPrivateCount < 1
  ) {
    throw new ApiError(
      400,
      "Please upload at least 1 private photo",
    );
  }

  // Maximum 6 public photos
  if (totalPublicCount > 6) {
    throw new ApiError(
      400,
      `Maximum 6 public photos are allowed. You already have ${existingPublicCount} public photos.`,
    );
  }

  // Maximum 6 private photos
  if (totalPrivateCount > 6) {
    throw new ApiError(
      400,
      `Maximum 6 private photos are allowed. You already have ${existingPrivateCount} private photos.`,
    );
  }

  // =====================================
  // KEEP TRACK OF NEW UPLOADS
  // =====================================

  const newlyUploadedFileIds = [];

  try {
    // =====================================
    // CHECK MAIN PUBLIC PHOTO
    // =====================================

    const hasMainPhoto =
      existingPublicPhotos.some(
        (photo) => photo.isMain,
      );

    // =====================================
    // UPLOAD PUBLIC PHOTOS
    // =====================================

    const uploadedPublicPhotos =
      await Promise.all(
        publicPhotos.map(
          async (file, index) => {
            const uploaded =
              await uploadPhotoToImageKit({
                file,
                folder:
                  "/MeetZo/Profile_Photos/Public",
              });

            newlyUploadedFileIds.push(
              uploaded.fileId,
            );

            return {
              url: uploaded.url,

              fileId:
                uploaded.fileId,

              visibility:
                "PUBLIC",

              // First public photo becomes
              // main if no main photo exists
              isMain:
                !hasMainPhoto &&
                index === 0,

              order:
                existingPublicCount +
                index +
                1,
            };
          },
        ),
      );

    // =====================================
    // UPLOAD PRIVATE PHOTOS
    // =====================================

    const uploadedPrivatePhotos =
      await Promise.all(
        privatePhotos.map(
          async (file, index) => {
            const uploaded =
              await uploadPhotoToImageKit({
                file,
                folder:
                  "/MeetZo/Profile_Photos/Private",
              });

            newlyUploadedFileIds.push(
              uploaded.fileId,
            );

            return {
              url: uploaded.url,

              fileId:
                uploaded.fileId,

              visibility:
                "PRIVATE",

              // Private photo can never
              // become main profile photo
              isMain: false,

              order:
                existingPrivateCount +
                index +
                1,
            };
          },
        ),
      );

    // =====================================
    // APPEND PHOTOS
    // =====================================

    profile.photos.push(
      ...uploadedPublicPhotos,
      ...uploadedPrivatePhotos,
    );

    // =====================================
    // FIND MAIN PROFILE PHOTO
    // =====================================

    const mainPhoto =
      profile.photos.find(
        (photo) =>
          photo.visibility ===
            "PUBLIC" &&
          photo.isMain === true,
      );

    // =====================================
    // UPDATE PROFILE IMAGE
    // =====================================

    if (mainPhoto) {
      profile.profileImage =
        mainPhoto.url;

      profile.profileImageId =
        mainPhoto.fileId;
    }

    // =====================================
    // SAVE PROFILE
    // =====================================

    await profile.save();

    // =====================================
    // FINAL PUBLIC PHOTOS
    // =====================================

    const finalPublicPhotos =
      profile.photos.filter(
        (photo) =>
          photo.visibility === "PUBLIC",
      );

    // =====================================
    // FINAL PRIVATE PHOTOS
    // =====================================

    const finalPrivatePhotos =
      profile.photos.filter(
        (photo) =>
          photo.visibility === "PRIVATE",
      );

    // =====================================
    // RESPONSE
    // =====================================

    return {
      profileImage:
        profile.profileImage,

      profileImageId:
        profile.profileImageId,

      publicPhotos:
        finalPublicPhotos,

      privatePhotos:
        finalPrivatePhotos,

      publicPhotoCount:
        finalPublicPhotos.length,

      privatePhotoCount:
        finalPrivatePhotos.length,

      remainingPublicSlots:
        Math.max(
          0,
          6 -
            finalPublicPhotos.length,
        ),

      remainingPrivateSlots:
        Math.max(
          0,
          6 -
            finalPrivatePhotos.length,
        ),
    };
  } catch (error) {
    // =====================================
    // ROLLBACK IMAGEKIT UPLOADS
    // =====================================

    await Promise.allSettled(
      newlyUploadedFileIds.map(
        (fileId) =>
          deletePhotoFromImageKit(
            fileId,
          ),
      ),
    );

    throw error;
  }
};
export const getMyProfilePhotosService = async ({ userId }) => {
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  const profile = await profileModel
    .findOne({ userId })
    .select("userId profileImage profileImageId photos")
    .lean();

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  const publicPhotos = (profile.photos || [])
    .filter((photo) => photo.visibility === "PUBLIC")
    .sort((a, b) => a.order - b.order);

  const privatePhotos = (profile.photos || [])
    .filter((photo) => photo.visibility === "PRIVATE")
    .sort((a, b) => a.order - b.order);

  return {
    profileImage: profile.profileImage,
    profileImageId: profile.profileImageId,

    publicPhotos,
    privatePhotos,

    publicPhotoCount: publicPhotos.length,
    privatePhotoCount: privatePhotos.length,

    remainingPublicSlots: Math.max(0, 6 - publicPhotos.length),

    remainingPrivateSlots: Math.max(0, 6 - privatePhotos.length),
  };
};

// export const deleteProfilePhotoService = async ({ userId, fieldId }) => {
//   if (!userId) {
//     throw new ApiError(401, "Authentication required");
//   }

//   if (!fieldId || !mongoose.Types.ObjectId.isValid(fieldId)) {
//     throw new ApiError(400, "Invalid photo ID");
//   }

//   const profile = await profileModel.findOne({
//     userId,
//   });

//   if (!profile) {
//     throw new ApiError(404, "Profile not found");
//   }

//   const photo = profile.photos.id(fieldId);

//   if (!photo) {
//     throw new ApiError(404, "Photo not found");
//   }

//   const publicPhotos = profile.photos.filter(
//     (item) => item.visibility === "PUBLIC",
//   );

//   // At least 2 public photos must remain.
//   if (photo.visibility === "PUBLIC" && publicPhotos.length <= 2) {
//     throw new ApiError(400, "At least 2 public photos are required");
//   }

//   // Store values before removing subdocument.
//   const deletedFileId = photo.fileId;
//   const deletedVisibility = photo.visibility;
//   const wasMainPhoto = photo.isMain;

//   // Remove photo from MongoDB array.
//   profile.photos.pull(photo._id);

//   // Remaining public photos.
//   const remainingPublicPhotos = profile.photos
//     .filter((item) => item.visibility === "PUBLIC")
//     .sort((a, b) => a.order - b.order);

//   // Remaining private photos.
//   const remainingPrivatePhotos = profile.photos
//     .filter((item) => item.visibility === "PRIVATE")
//     .sort((a, b) => a.order - b.order);

//   // Reorder public photos.
//   remainingPublicPhotos.forEach((item, index) => {
//     item.order = index + 1;
//   });

//   // Reorder private photos.
//   remainingPrivatePhotos.forEach((item, index) => {
//     item.order = index + 1;
//   });

//   // If main photo was deleted, assign next public
//   // photo as the main profile photo.
//   if (deletedVisibility === "PUBLIC" && wasMainPhoto) {
//     remainingPublicPhotos.forEach((item) => {
//       item.isMain = false;
//     });

//     const newMainPhoto = remainingPublicPhotos[0];

//     if (newMainPhoto) {
//       newMainPhoto.isMain = true;

//       profile.profileImage = newMainPhoto.url;

//       profile.profileImageId = newMainPhoto.fileId;
//     } else {
//       profile.profileImage = null;
//       profile.profileImageId = null;
//     }
//   }

//   // First update MongoDB.
//   await profile.save();

//   // Then remove actual image from ImageKit.
//   // MongoDB deletion should remain successful even if
//   // ImageKit temporarily fails.
//   try {
//     await deletePhotoFromImageKit(deletedFileId);
//   } catch (error) {
//     console.error("ImageKit photo deletion failed:", {
//       fileId: deletedFileId,
//       message: error.message,
//     });
//   }

//   return {
//     deletedPhotoId: photoId,

//     profileImage: profile.profileImage,

//     profileImageId: profile.profileImageId,

//     publicPhotos: remainingPublicPhotos,

//     privatePhotos: remainingPrivatePhotos,

//     publicPhotoCount: remainingPublicPhotos.length,

//     privatePhotoCount: remainingPrivatePhotos.length,

//     remainingPublicSlots: 6 - remainingPublicPhotos.length,

//     remainingPrivateSlots: 6 - remainingPrivatePhotos.length,
//   };
// };

// =====================================
// UPDATE ABOUT ME SERVICE
// =====================================




export const deleteProfilePhotoService = async ({ userId, fieldId }) => {
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!fieldId || !mongoose.Types.ObjectId.isValid(fieldId)) {
    throw new ApiError(400, "Invalid photo ID");
  }

  const profile = await profileModel.findOne({
    userId,
  });

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  const photo = profile.photos.id(fieldId);

  if (!photo) {
    throw new ApiError(404, "Photo not found");
  }

  const publicPhotos = profile.photos.filter(
    (item) => item.visibility === "PUBLIC",
  );

  // At least 2 public photos must remain.
  if (photo.visibility === "PUBLIC" && publicPhotos.length <= 2) {
    throw new ApiError(400, "At least 2 public photos are required");
  }

  // Store values before removing subdocument.
  const deletedFileId = photo.fileId;
  const deletedVisibility = photo.visibility;
  const wasMainPhoto = photo.isMain;

  // Remove photo from MongoDB array.
  profile.photos.pull(photo._id);

  // Remaining public photos.
  const remainingPublicPhotos = profile.photos
    .filter((item) => item.visibility === "PUBLIC")
    .sort((a, b) => a.order - b.order);

  // Remaining private photos.
  const remainingPrivatePhotos = profile.photos
    .filter((item) => item.visibility === "PRIVATE")
    .sort((a, b) => a.order - b.order);

  // Reorder public photos.
  remainingPublicPhotos.forEach((item, index) => {
    item.order = index + 1;
  });

  // Reorder private photos.
  remainingPrivatePhotos.forEach((item, index) => {
    item.order = index + 1;
  });

  // If main photo was deleted, assign next public
  // photo as the main profile photo.
  if (deletedVisibility === "PUBLIC" && wasMainPhoto) {
    remainingPublicPhotos.forEach((item) => {
      item.isMain = false;
    });

    const newMainPhoto = remainingPublicPhotos[0];

    if (newMainPhoto) {
      newMainPhoto.isMain = true;
      profile.profileImage = newMainPhoto.url;
      profile.profileImageId = newMainPhoto.fileId;
    } else {
      profile.profileImage = null;
      profile.profileImageId = null;
    }
  }

  // First update MongoDB.
  await profile.save();

  // Then remove actual image from ImageKit.
  // MongoDB deletion should remain successful even if
  // ImageKit temporarily fails.
  try {
    await deletePhotoFromImageKit(deletedFileId);
  } catch (error) {
    console.error("ImageKit photo deletion failed:", {
      fileId: deletedFileId,
      message: error.message,
    });
  }

  return {
    deletedPhotoId: fieldId,
    profileImage: profile.profileImage,
    profileImageId: profile.profileImageId,
    publicPhotos: remainingPublicPhotos,
    privatePhotos: remainingPrivatePhotos,
    publicPhotoCount: remainingPublicPhotos.length,
    privatePhotoCount: remainingPrivatePhotos.length,
    remainingPublicSlots: 6 - remainingPublicPhotos.length,
    remainingPrivateSlots: 6 - remainingPrivatePhotos.length,
  };
};
export const updateAboutMeService = async ({
  userId,
  bio,
  showBioOnProfile,
}) => {
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

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

  const profile = await profileModel.findOneAndUpdate(
    {
      userId,
    },
    {
      $set: {
        bio: cleanBio,

        showBioOnProfile: showBioOnProfile ?? true,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!profile) {
    throw new ApiError(404, "Profile not found");
  }

  return {
    bio: profile.bio,
    showBioOnProfile: profile.showBioOnProfile,
  };
};
