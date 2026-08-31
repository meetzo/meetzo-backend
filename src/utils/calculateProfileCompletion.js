const isFilled = (value) => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  // Numbers and booleans are valid values
  return true;
};

const calculateSectionPercentage = ({
  profile,
  fields,
  weight,
}) => {
  const completedFields = fields.filter((field) =>
    isFilled(profile[field])
  );

  const percentage =
    fields.length > 0
      ? (completedFields.length / fields.length) * weight
      : 0;

  const missingFields = fields.filter(
    (field) => !isFilled(profile[field])
  );

  return {
    percentage,
    completedFields: completedFields.length,
    totalFields: fields.length,
    missingFields,
  };
};

export const calculateProfileCompletion = (profileData) => {
  const profile =
    typeof profileData.toObject === "function"
      ? profileData.toObject()
      : profileData;

  // =====================================
  // REQUIRED DETAILS — 40%
  // =====================================

  const requiredFields = [
    "dateOfBirth",
    "height",
    "languages",
    "gender",
    "profession",
    "orientation",
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
  ];

  const detailsSection = calculateSectionPercentage({
    profile,
    fields: requiredFields,
    weight: 40,
  });

  // =====================================
  // PROFILE PHOTO — 15%
  // =====================================

  const hasProfilePhoto = isFilled(profile.profileImage);

  const photoPercentage = hasProfilePhoto ? 15 : 0;

  // =====================================
  // KYC VERIFIED — 15%
  // =====================================

  const isKycComplete =
    profile.isKycVerified === true &&
    profile.kycStatus === "VERIFIED";

  const kycPercentage = isKycComplete ? 15 : 0;

  // =====================================
  // FACE VERIFIED — 15%
  // =====================================

  const isFaceVerificationComplete =
    profile.isFaceVerified === true &&
    profile.faceVerificationStatus === "VERIFIED";

  const faceVerificationPercentage =
    isFaceVerificationComplete ? 15 : 0;

  // =====================================
  // OPTIONAL DETAILS — 15%
  // =====================================

  const optionalFields = [
    "bio",
    "education",
    "college",
    "company",
    "jobTitle",
    "city",
    "hometown",
  ];

  const optionalSection = calculateSectionPercentage({
    profile,
    fields: optionalFields,
    weight: 15,
  });

  // =====================================
  // TOTAL
  // =====================================

  const rawPercentage =
    detailsSection.percentage +
    photoPercentage +
    kycPercentage +
    faceVerificationPercentage +
    optionalSection.percentage;

  const completionPercentage = Math.min(
    100,
    Math.round(rawPercentage)
  );

  const missingSections = [];

  if (detailsSection.percentage < 40) {
    missingSections.push("DETAILS");
  }

  if (!hasProfilePhoto) {
    missingSections.push("PROFILE_PHOTO");
  }

  if (!isKycComplete) {
    missingSections.push("KYC");
  }

  if (!isFaceVerificationComplete) {
    missingSections.push("FACE_VERIFICATION");
  }

  if (optionalSection.percentage < 15) {
    missingSections.push("OPTIONAL_DETAILS");
  }

  return {
    completionPercentage,
    isProfileCompleted: completionPercentage === 100,

    breakdown: {
      details: {
        earned: Number(detailsSection.percentage.toFixed(2)),
        total: 40,
        completedFields: detailsSection.completedFields,
        totalFields: detailsSection.totalFields,
        missingFields: detailsSection.missingFields,
      },

      profilePhoto: {
        earned: photoPercentage,
        total: 15,
        completed: hasProfilePhoto,
      },

      kyc: {
        earned: kycPercentage,
        total: 15,
        completed: isKycComplete,
        status: profile.kycStatus,
      },

      faceVerification: {
        earned: faceVerificationPercentage,
        total: 15,
        completed: isFaceVerificationComplete,
        status: profile.faceVerificationStatus,
      },

      optionalDetails: {
        earned: Number(
          optionalSection.percentage.toFixed(2)
        ),
        total: 15,
        completedFields: optionalSection.completedFields,
        totalFields: optionalSection.totalFields,
        missingFields: optionalSection.missingFields,
      },
    },

    missingSections,
  };
};