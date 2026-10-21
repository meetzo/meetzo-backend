
import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    planCode: {
      type: String,
      enum: [
        "COMPLIMENTARY",
        "DAILY",
        "WEEKLY",
        "MONTHLY",
        "QUARTERLY",
        "YEARLY",
      ],
      default: "COMPLIMENTARY",
    },

    source: {
      type: String,
      enum: [
        "PROMOTIONAL",
        "GOOGLE_PLAY",
        "APP_STORE",
        "ADMIN",
      ],
      default: "PROMOTIONAL",
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "EXPIRED",
        "CANCELLED",
        "PENDING",
      ],
      default: "ACTIVE",
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },

    // Reserved for future verified payment integrations.
    paymentReference: {
      type: String,
      default: null,
    },

    autoRenew: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export default mongoose.model(
  "Subscription",
  subscriptionSchema,
);
