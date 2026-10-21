
import mongoose from "mongoose";

import Subscription from "../../models/subscriptionModel.js";
import Profile from "../../models/profileModel.js";
import User from "../../models/userModel.js";

const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const grantComplimentarySubscriptionService = async (userId) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError(400, "Invalid user id");
  }

  const [user, profile] = await Promise.all([
    User.findById(userId)
      .select("_id isBlocked")
      .lean(),

    Profile.findOne({ userId })
      .select("_id isProfileCompleted")
      .lean(),
  ]);

  if (!user) {
    throw createError(404, "User not found");
  }

  if (user.isBlocked === true) {
    throw createError(403, "Your account has been blocked");
  }

  if (!profile) {
    throw createError(404, "Profile not found");
  }

  if (profile.isProfileCompleted !== true) {
    throw createError(
      403,
      "Complete your profile to activate your subscription"
    );
  }

  const subscription = await Subscription.findOneAndUpdate(
    {
      userId: user._id,
    },
    {
      $setOnInsert: {
        userId: user._id,
        planCode: "COMPLIMENTARY",
        source: "PROMOTIONAL",
        status: "ACTIVE",
        startDate: new Date(),
        endDate: null,
        paymentReference: null,
        autoRenew: false,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    }
  ).lean();

  return {
    isPremium:
      subscription.status === "ACTIVE" &&
      subscription.startDate <= new Date() &&
      (!subscription.endDate ||
        subscription.endDate > new Date()),

    subscription,
  };
};

export const createSubscriptionService = async ({ userId }) => {
  return grantComplimentarySubscriptionService(userId);
};

export const getSubscriptionAccessService = async (userId) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError(400, "Invalid user id");
  }

  const now = new Date();

  const subscription = await Subscription.findOne({
    userId,
    status: "ACTIVE",
    startDate: { $lte: now },
    $or: [
      { endDate: null },
      { endDate: { $gt: now } },
    ],
  }).lean();

  return {
    isPremium: Boolean(subscription),

    subscription: subscription
      ? {
          _id: subscription._id,
          planCode: subscription.planCode,
          source: subscription.source,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
        }
      : null,
  };
};
