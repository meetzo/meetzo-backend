import mongoose from "mongoose";

const signupAttemptSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // OTP should be hashed
    otpHash: {
      type: String,
      required: true,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);


// Automatically delete abandoned signup attempts
signupAttemptSchema.index(
  {
    createdAt: 1,
  },
  {
    expireAfterSeconds: 15 * 60,
  }
);


const signupAttemptModel =
  mongoose.model(
    "SignupAttempt",
    signupAttemptSchema
  );

export default signupAttemptModel;