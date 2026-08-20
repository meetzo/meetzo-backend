import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      default: null,
      select: false,
    },

    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "apple"],
      default: "local",
    },

    // ---------------------------------------
    // GOOGLE LOGIN
    // ---------------------------------------

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },

    // ---------------------------------------
    // APPLE LOGIN
    // ---------------------------------------

    appleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },

    profileImage: {
      type: String,
      default: null,
    },

    // ---------------------------------------
    // OTP
    // ---------------------------------------

    otp: {
      type: String,
      default: null,
      select: false,
    },

    otpExpiry: {
      type: Date,
      default: null,
      select: false,
    },

    otpPurpose: {
      type: String,
      enum: ["SIGNUP", "LOGIN"],
      default: null,
      select: false,
    },

    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // ---------------------------------------
    // ACCOUNT STATUS
    // ---------------------------------------

    isVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ createdAt: -1 });

userSchema.index({
  role: 1,
  isBlocked: 1,
});

export default mongoose.model("User", userSchema);