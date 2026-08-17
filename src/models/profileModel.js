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
  }
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

    // Personal details
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
        validator: (value) =>
          Array.isArray(value) &&
          value.length > 0,
        message:
          "At least one language is required",
      },
    },

    // Gender
    gender: {
  type: String,
  enum: [
    "MALE",
    "FEMALE",
    "NON_BINARY",
    "OTHER",
  ],
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

    // Profession
  profession: {
  type: String,
  enum: [
    "STUDENT",
    "SOFTWARE_DEVELOPER",
    "ENGINEER",
    "ENTREPRENEUR",
    "FASHION_DESIGNER",
    "OTHER"
  ],
  required: true,
},

    customProfession: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    // Orientation
    orientation: {
      type: String,
      enum: [
        "STRAIGHT",
        "AROMANTIC",
        "BISEXUAL",
        "GAY",
        "OTHER",
      ],
      required: true,
    },

    customOrientation: {
      type: String,
      default: null,
      trim: true,
    },

    showOrientationOnProfile: {
      type: Boolean,
      default: true,
    },

    // Connection preferences
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

    // Lifestyle
    smoking: {
      type: String,
      enum: [
        "YES",
        "NO",
        "OCCASIONALLY",
        "PREFER_NOT_TO_SAY",
      ],
      required: true,
    },

    drinking: {
      type: String,
      enum: [
        "YES",
        "NO",
        "OCCASIONALLY",
        "PREFER_NOT_TO_SAY",
      ],
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
      enum: [
        "YES",
        "NO",
        "OCCASIONALLY",
        "PREFER_NOT_TO_SAY",
      ],
      required: true,
    },

    // Personality
    selfDescription: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          value.length >= 1 &&
          value.length <= 3,
        message:
          "Select between 1 and 3 personality traits",
      },
    },

    interests: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          value.length >= 1 &&
          value.length <= 5,
        message:
          "Select between 1 and 5 interests",
      },
    },

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
      default: null,
      trim: true,
    },

    idealWeekend: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          value.length >= 1 &&
          value.length <= 3,
        message:
          "Select between 1 and 3 weekend preferences",
      },
    },

    values: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          value.length >= 1 &&
          value.length <= 3,
        message:
          "Select between 1 and 3 values",
      },
    },

    isProfileCompleted: {
      type: Boolean,
      default: true,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default mongoose.model(
  "Profile",
  profileSchema
);