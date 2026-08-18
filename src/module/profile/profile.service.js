import profileModel from "../../models/profileModel.js";
import userModel from "../../models/userModel.js";
import ApiError from "../../utils/api.error.js";

/**
 * Calculate age from date of birth.
 */
const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    throw new ApiError(
      400,
      "Invalid date of birth"
    );
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    dob.getFullYear();

  const monthDifference =
    today.getMonth() -
    dob.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() < dob.getDate()
    )
  ) {
    age -= 1;
  }

  return age;
};

/**
 * Trim array values, remove empty values
 * and remove duplicates.
 */
const normalizeArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) =>
          String(value).trim()
        )
        .filter(Boolean)
    ),
  ];
};

/**
 * Convert optional value to a trimmed string.
 */
const normalizeOptionalString = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    String(value).trim();

  return normalizedValue || null;
};

export const saveProfileDetailsService =
  async ({
    userId,
    profileData = {},
  }) => {
    // Authentication validation
    if (!userId) {
      throw new ApiError(
        401,
        "Authentication is required"
      );
    }

    // Check whether user exists
    const user = await userModel
      .findById(userId)
      .select("_id isBlocked");

    if (!user) {
      throw new ApiError(
        404,
        "User not found"
      );
    }

    if (user.isBlocked) {
      throw new ApiError(
        403,
        "Your account has been blocked"
      );
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

    const missingField =
      Object.entries(requiredFields).find(
        ([, value]) =>
          value === undefined ||
          value === null ||
          value === "" ||
          (
            Array.isArray(value) &&
            value.length === 0
          )
      );

    if (missingField) {
      throw new ApiError(
        400,
        `${missingField[0]} is required`
      );
    }

    // Date-of-birth and age validation
    const age =
      calculateAge(dateOfBirth);

    if (age < 18) {
      throw new ApiError(
        400,
        "You must be at least 18 years old"
      );
    }

    // Height object validation
    if (
      typeof height !== "object" ||
      height === null ||
      Array.isArray(height)
    ) {
      throw new ApiError(
        400,
        "Height must contain value and unit"
      );
    }

    const heightValue =
      Number(height.value);

    const heightUnit =
      String(height.unit || "")
        .trim()
        .toUpperCase();

    if (
      !Number.isFinite(heightValue) ||
      heightValue <= 0 ||
      !["CM", "FT"].includes(heightUnit)
    ) {
      throw new ApiError(
        400,
        "Valid height value and unit are required"
      );
    }

    // Normalize array fields
    const normalizedLanguages =
      normalizeArray(languages);

    const normalizedSelfDescription =
      normalizeArray(selfDescription);

    const normalizedInterests =
      normalizeArray(interests);

    const normalizedIdealWeekend =
      normalizeArray(idealWeekend);

    const normalizedValues =
      normalizeArray(values);

    // Validate arrays
    if (
      normalizedLanguages.length === 0
    ) {
      throw new ApiError(
        400,
        "At least one language is required"
      );
    }

    if (
      normalizedSelfDescription.length < 1 ||
      normalizedSelfDescription.length > 3
    ) {
      throw new ApiError(
        400,
        "Select between 1 and 3 personality traits"
      );
    }

    if (
      normalizedInterests.length < 1 ||
      normalizedInterests.length > 5
    ) {
      throw new ApiError(
        400,
        "Select between 1 and 5 interests"
      );
    }

    if (
      normalizedIdealWeekend.length < 1 ||
      normalizedIdealWeekend.length > 3
    ) {
      throw new ApiError(
        400,
        "Select between 1 and 3 weekend preferences"
      );
    }

    if (
      normalizedValues.length < 1 ||
      normalizedValues.length > 3
    ) {
      throw new ApiError(
        400,
        "Select between 1 and 3 values"
      );
    }

    // Normalize optional/manual fields
    const normalizedGenderDescription =
      normalizeOptionalString(
        genderDescription
      );

    const normalizedCustomProfession =
      normalizeOptionalString(
        customProfession
      );

    const normalizedCustomOrientation =
      normalizeOptionalString(
        customOrientation
      );

    const normalizedCustomReligion =
      normalizeOptionalString(
        customReligion
      );

    // Gender description validation
    if (
      normalizedGenderDescription &&
      normalizedGenderDescription.length > 200
    ) {
      throw new ApiError(
        400,
        "Gender description cannot exceed 200 characters"
      );
    }

    // Manual profession validation
    if (
      profession === "OTHER" &&
      !normalizedCustomProfession
    ) {
      throw new ApiError(
        400,
        "Custom profession is required"
      );
    }

    if (
      normalizedCustomProfession &&
      normalizedCustomProfession.length > 100
    ) {
      throw new ApiError(
        400,
        "Custom profession cannot exceed 100 characters"
      );
    }

    // Manual orientation validation
    if (
      orientation === "OTHER" &&
      !normalizedCustomOrientation
    ) {
      throw new ApiError(
        400,
        "Custom orientation is required"
      );
    }

    // Manual religion validation
    if (
      religion === "OTHER" &&
      !normalizedCustomReligion
    ) {
      throw new ApiError(
        400,
        "Custom religion is required"
      );
    }

    const normalizedData = {
      dateOfBirth:
        new Date(dateOfBirth),

      height: {
        value: heightValue,
        unit: heightUnit,
      },

      languages:
        normalizedLanguages,

      gender,

      genderDescription:
        normalizedGenderDescription,

      showGenderOnProfile:
        showGenderOnProfile ?? true,

      profession,

      customProfession:
        profession === "OTHER"
          ? normalizedCustomProfession
          : null,

      orientation,

      customOrientation:
        orientation === "OTHER"
          ? normalizedCustomOrientation
          : null,

      showOrientationOnProfile:
        showOrientationOnProfile ?? true,

      meetzoGoal,
      relationshipPace,

      smoking,
      drinking,
      fitness,
      pets,

      selfDescription:
        normalizedSelfDescription,

      interests:
        normalizedInterests,

      religion,

      customReligion:
        religion === "OTHER"
          ? normalizedCustomReligion
          : null,

      idealWeekend:
        normalizedIdealWeekend,

      values:
        normalizedValues,

      isProfileCompleted: true,
      completedAt: new Date(),
    };

    // Create a new profile or update existing profile
    const profile =
      await profileModel.findOneAndUpdate(
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
        }
      );

    return profile;
  };


  export const getProfileService =
  async ({ userId }) => {
    if (!userId) {
      throw new ApiError(
        401,
        "Authentication is required"
      );
    }

    const user = await userModel
      .findById(userId)
      .select(
        "name email phone role isVerified isBlocked createdAt updatedAt"
      )
      .lean();

    if (!user) {
      throw new ApiError(
        404,
        "User not found"
      );
    }

    if (user.isBlocked) {
      throw new ApiError(
        403,
        "Your account has been blocked"
      );
    }

    const profile = await profileModel
      .findOne({ userId })
      .lean();

    if (!profile) {
      throw new ApiError(
        404,
        "Profile not found"
      );
    }

    return {
      user,
      profile,
    };
  };

  export const updateProfileService =
  async ({
    userId,
    profileData = {},
  }) => {
    // ---------------------------------------
    // AUTHENTICATION
    // ---------------------------------------

    if (!userId) {
      throw new ApiError(
        401,
        "Authentication is required"
      );
    }

    // ---------------------------------------
    // CHECK USER
    // ---------------------------------------

    const user = await userModel
      .findById(userId)
      .select("_id isBlocked");

    if (!user) {
      throw new ApiError(
        404,
        "User not found"
      );
    }

    if (user.isBlocked) {
      throw new ApiError(
        403,
        "Your account has been blocked"
      );
    }

    // ---------------------------------------
    // CHECK PROFILE
    // ---------------------------------------

    const existingProfile =
      await profileModel.findOne({
        userId,
      });

    if (!existingProfile) {
      throw new ApiError(
        404,
        "Profile not found. Please complete your profile first"
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
      if (
        Object.prototype.hasOwnProperty.call(
          profileData,
          field
        )
      ) {
        updateData[field] =
          profileData[field];
      }
    }

    if (
      Object.keys(updateData).length === 0
    ) {
      throw new ApiError(
        400,
        "No valid profile fields provided"
      );
    }

    // ---------------------------------------
    // DATE OF BIRTH
    // ---------------------------------------

    if (
      updateData.dateOfBirth !== undefined
    ) {
      const age = calculateAge(
        updateData.dateOfBirth
      );

      if (age < 18) {
        throw new ApiError(
          400,
          "You must be at least 18 years old"
        );
      }

      updateData.dateOfBirth =
        new Date(updateData.dateOfBirth);
    }

    // ---------------------------------------
    // HEIGHT
    // ---------------------------------------

    if (updateData.height !== undefined) {
      const height =
        updateData.height;

      if (
        typeof height !== "object" ||
        height === null ||
        Array.isArray(height)
      ) {
        throw new ApiError(
          400,
          "Height must contain value and unit"
        );
      }

      const heightValue =
        Number(height.value);

      const heightUnit =
        String(height.unit || "")
          .trim()
          .toUpperCase();

      if (
        !Number.isFinite(heightValue) ||
        heightValue <= 0 ||
        !["CM", "FT"].includes(heightUnit)
      ) {
        throw new ApiError(
          400,
          "Valid height value and unit are required"
        );
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
        message:
          "At least one language is required",
      },

      selfDescription: {
        min: 1,
        max: 3,
        message:
          "Select between 1 and 3 personality traits",
      },

      interests: {
        min: 1,
        max: 5,
        message:
          "Select between 1 and 5 interests",
      },

      idealWeekend: {
        min: 1,
        max: 3,
        message:
          "Select between 1 and 3 weekend preferences",
      },

      values: {
        min: 1,
        max: 3,
        message:
          "Select between 1 and 3 values",
      },
    };

    for (
      const [field, rule] of
      Object.entries(arrayRules)
    ) {
      if (updateData[field] !== undefined) {
        const normalizedValues =
          normalizeArray(
            updateData[field]
          );

        if (
          normalizedValues.length <
            rule.min ||
          normalizedValues.length >
            rule.max
        ) {
          throw new ApiError(
            400,
            rule.message
          );
        }

        updateData[field] =
          normalizedValues;
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
        updateData[field] =
          normalizeOptionalString(
            updateData[field]
          );
      }
    }

    // ---------------------------------------
    // BOOLEAN FIELDS
    // ---------------------------------------

    const booleanFields = [
      "showGenderOnProfile",
      "showOrientationOnProfile",
    ];

    for (const field of booleanFields) {
      if (
        updateData[field] !== undefined &&
        typeof updateData[field] !==
          "boolean"
      ) {
        throw new ApiError(
          400,
          `${field} must be true or false`
        );
      }
    }

    // ---------------------------------------
    // FINAL CONDITIONAL VALUES
    // ---------------------------------------

    const finalProfession =
      updateData.profession ??
      existingProfile.profession;

    const finalOrientation =
      updateData.orientation ??
      existingProfile.orientation;

    const finalReligion =
      updateData.religion ??
      existingProfile.religion;

    const finalCustomProfession =
      updateData.customProfession !==
      undefined
        ? updateData.customProfession
        : existingProfile.customProfession;

    const finalCustomOrientation =
      updateData.customOrientation !==
      undefined
        ? updateData.customOrientation
        : existingProfile.customOrientation;

    const finalCustomReligion =
      updateData.customReligion !==
      undefined
        ? updateData.customReligion
        : existingProfile.customReligion;

    // ---------------------------------------
    // CUSTOM PROFESSION
    // ---------------------------------------

    if (finalProfession === "OTHER") {
      if (!finalCustomProfession) {
        throw new ApiError(
          400,
          "Custom profession is required"
        );
      }
    } else {
      updateData.customProfession = null;
    }

    // ---------------------------------------
    // CUSTOM ORIENTATION
    // ---------------------------------------

    if (finalOrientation === "OTHER") {
      if (!finalCustomOrientation) {
        throw new ApiError(
          400,
          "Custom orientation is required"
        );
      }
    } else {
      updateData.customOrientation = null;
    }

    // ---------------------------------------
    // CUSTOM RELIGION
    // ---------------------------------------

    if (finalReligion === "OTHER") {
      if (!finalCustomReligion) {
        throw new ApiError(
          400,
          "Custom religion is required"
        );
      }
    } else {
      updateData.customReligion = null;
    }

    // ---------------------------------------
    // UPDATE PROFILE
    // ---------------------------------------

    const updatedProfile =
      await profileModel.findOneAndUpdate(
        {
          userId,
        },
        {
          $set: updateData,
        },
        {
          returnDocument: "after",
          runValidators: true,
        }
      );

    return updatedProfile;
  };