import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "UNMATCHED",
        "BLOCKED",
      ],
      default: "ACTIVE",
    },

    matchedAt: {
      type: Date,
      default: Date.now,
    },

    unmatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    unmatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

matchSchema.index(
  {
    user1: 1,
    user2: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model(
  "Match",
  matchSchema
);