import mongoose from "mongoose";

const heightSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: {
      type: String,
      enum: ["CM", "FT"],
      required: true,
    },
  },
  {
    _id: false,
  },
);

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // =====================================
    // PROFILE IMAGE
    // =====================================

    profileImage: {
      type: String,
      trim: true,
      default: null,
    },

    profileImageId: {
      type: String,
      trim: true,
      default: null,
    },

    // =====================================
    // PERSONAL DETAILS
    // =====================================

    dateOfBirth: {
      type: Date,
      required: true,
    },

    height: {
      type: heightSchema,
      required: true,
    },

    languages: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one language is required",
      },
    },

    // =====================================
    // GENDER
    // =====================================

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "NON_BINARY", "OTHER"],
      required: true,
    },

    genderDescription: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    showGenderOnProfile: {
      type: Boolean,
      default: true,
    },

    // =====================================
    // PROFESSION
    // =====================================

    profession: {
      type: String,
      enum: [
        "STUDENT",
        "SOFTWARE_DEVELOPER",
        "ENGINEER",
        "ENTREPRENEUR",
        "FASHION_DESIGNER",
        "OTHER",
      ],
      required: true,
    },

    customProfession: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    // =====================================
    // ORIENTATION
    // =====================================

    orientation: {
      type: String,
      enum: ["STRAIGHT", "AROMANTIC", "BISEXUAL", "GAY", "OTHER"],
      required: true,
    },

    customOrientation: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    showOrientationOnProfile: {
      type: Boolean,
      default: true,
    },

    // =====================================
    // CONNECTION PREFERENCES
    // =====================================

    meetzoGoal: {
      type: String,
      enum: [
        "SERIOUS_RELATIONSHIP",
        "REAL_CONNECTION",
        "MEET_NEW_PEOPLE",
        "CASUAL_DATING",
        "NEW_FRIENDSHIP",
        "EXPLORING",
      ],
      required: true,
    },

    relationshipPace: {
      type: String,
      enum: [
        "TAKE_IT_SLOW",
        "GO_WITH_THE_FLOW",
        "CLEAR_AND_SERIOUS",
        "FUN_AND_CASUAL",
        "EMOTIONALLY_AVAILABLE",
        "NO_PRESSURE",
      ],
      required: true,
    },

    // =====================================
    // LIFESTYLE
    // =====================================

    smoking: {
      type: String,
      enum: ["YES", "NO", "OCCASIONALLY", "PREFER_NOT_TO_SAY"],
      required: true,
    },

    drinking: {
      type: String,
      enum: ["YES", "NO", "OCCASIONALLY", "PREFER_NOT_TO_SAY"],
      required: true,
    },

    fitness: {
      type: String,
      enum: [
        "VERY_ACTIVE",
        "SOMETIMES_ACTIVE",
        "NOT_MUCH",
        "PREFER_NOT_TO_SAY",
      ],
      required: true,
    },

    pets: {
      type: String,
      enum: ["YES", "NO", "OCCASIONALLY", "PREFER_NOT_TO_SAY"],
      required: true,
    },

    // =====================================
    // PERSONALITY
    // =====================================

    selfDescription: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: "Select between 1 and 3 personality traits",
      },
    },

    interests: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 5,
        message: "Select between 1 and 5 interests",
      },
    },

    // =====================================
    // RELIGION
    // =====================================

    religion: {
      type: String,
      enum: [
        "HINDUISM",
        "ISLAM",
        "CHRISTIANITY",
        "SIKHISM",
        "BUDDHISM",
        "JAINISM",
        "JUDAISM",
        "OTHER",
        "PREFER_NOT_TO_SAY",
      ],
      required: true,
    },

    customReligion: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    // =====================================
    // WEEKEND AND VALUES
    // =====================================

    idealWeekend: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: "Select between 1 and 3 weekend preferences",
      },
    },

    values: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) && value.length >= 1 && value.length <= 3,
        message: "Select between 1 and 3 values",
      },
    },

    // =====================================
    // OPTIONAL DETAILS
    // =====================================

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    education: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    college: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    company: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    jobTitle: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    hometown: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    // =====================================
    // KYC DOCUMENTS
    // =====================================

    kycDocumentType: {
      type: String,
      enum: ["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID"],
      default: null,
    },

    kycDocumentFront: {
      type: String,
      default: null,
    },

    kycDocumentFrontId: {
      type: String,
      default: null,
    },

    kycDocumentBack: {
      type: String,
      default: null,
    },

    kycDocumentBackId: {
      type: String,
      default: null,
    },

    // =====================================
    // KYC VERIFICATION STATUS
    // =====================================

    kycStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"],
      default: "NOT_STARTED",
    },

    isKycVerified: {
      type: Boolean,
      default: false,
    },

    kycRejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    kycSubmittedAt: {
      type: Date,
      default: null,
    },

    kycVerifiedAt: {
      type: Date,
      default: null,
    },

    // =====================================
    // FACE VERIFICATION
    // =====================================

    faceImage: {
      type: String,
      default: null,
    },

    faceImageId: {
      type: String,
      default: null,
    },

    faceVerificationStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED"],
      default: "NOT_STARTED",
    },

    isFaceVerified: {
      type: Boolean,
      default: false,
    },

    faceVerificationRejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    faceVerificationSubmittedAt: {
      type: Date,
      default: null,
    },

    faceVerifiedAt: {
      type: Date,
      default: null,
    },

    // =====================================
    // PROFILE COMPLETION
    // =====================================

    isProfileCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model("Profile", profileSchema);
