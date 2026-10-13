
import mongoose from "mongoose";

// ==========================================
// AADHAAR VERIFICATION SCHEMA
// ==========================================

const adhaarVerificationSchema = new mongoose.Schema(
  {
    // ======================================
    // USER REFERENCE
    // ======================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      immutable: true,
    },

    // ======================================
    // IDENTITY DETAILS
    // ======================================

    fullName: {
      type: String,
      trim: true,
      default: null,
    },

    maskedAadhaar: {
      type: String,
      trim: true,
      default: null,
      select: false,
    },

    gender: {
      type: String,
      trim: true,
      default: null,
    },

    dob: {
      type: String,
      trim: true,
      default: null,
    },

    state: {
      type: String,
      trim: true,
      default: null,
    },

    mobileLinked: {
      type: Boolean,
      default: false,
    },

    // ======================================
    // VERIFICATION SESSION
    // ======================================

    verificationId: {
      type: String,
      trim: true,
      required: true,
      immutable: true,
    },

    apiProvider: {
      type: String,
      enum: ["IDSPay"],
      default: "IDSPay",
      immutable: true,
    },

    verificationMethod: {
      type: String,
      enum: ["DIGILOCKER"],
      default: "DIGILOCKER",
      immutable: true,
    },

    status: {
      type: String,
      enum: [
        "INITIATED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "FAILED",
        "EXPIRED",
      ],
      default: "INITIATED",
      index: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    // ======================================
    // USER CONSENT
    // ======================================

    consent: {
      accepted: {
        type: Boolean,
        default: false,
      },

      version: {
        type: String,
        default: null,
      },

      acceptedAt: {
        type: Date,
        default: null,
      },
    },

    // ======================================
    // VERIFICATION TRACKING
    // ======================================

    initiatedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    // ======================================
    // RETRY / CALLBACK TRACKING
    // ======================================

    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastCheckedAt: {
      type: Date,
      default: null,
    },

    callbackReceivedAt: {
      type: Date,
      default: null,
    },

    // ======================================
    // PROVIDER METADATA
    // ======================================

    providerStatus: {
      type: String,
      default: null,
    },

    providerErrorCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ==========================================
// INDEXES
// ==========================================

// Find user's latest verification attempt
adhaarVerificationSchema.index({
  userId: 1,
  createdAt: -1,
});

// Prevent reuse of provider session IDs
adhaarVerificationSchema.index(
  {
    apiProvider: 1,
    verificationId: 1,
  },
  {
    unique: true,
  }
);

// Moderation / operational queries
adhaarVerificationSchema.index({
  status: 1,
  createdAt: -1,
});

// ==========================================
// MODEL EXPORT
// ==========================================

export default mongoose.model(
  "AadhaarVerification",
  adhaarVerificationSchema
);
