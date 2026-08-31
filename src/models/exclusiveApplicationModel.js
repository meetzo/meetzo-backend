import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    fileId: {
      type: String,
      required: true,
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    mimeType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "application/pdf"],
    },
  },
  {
    _id: false,
  },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    remark: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const exclusiveApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    eligibilityCategory: {
      type: String,
      enum: [
        "PUBLIC_OFFICIAL",
        "BUSINESS_EXECUTIVE",
        "ENTREPRENEUR",
        "CELEBRITY",
        "ATHLETE",
        "CREATOR",
      ],
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    profession: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    organization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    socialProfiles: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length <= 5,
        message: "Maximum 5 social profiles are allowed",
      },
    },

    verificationDocument: {
      type: documentSchema,
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    adminRemark: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: () => [
        {
          status: "PENDING",
          changedBy: null,
          remark: null,
          changedAt: new Date(),
        },
      ],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

exclusiveApplicationSchema.index({
  status: 1,
  createdAt: -1,
});

export default mongoose.model(
  "ExclusiveApplication",
  exclusiveApplicationSchema,
);
