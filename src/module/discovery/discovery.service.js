import mongoose from "mongoose";

import profileModel from "../../models/profileModel.js";
import LikeModel from "../../models/like.Model.js";
import MatchModel from "../../models/matchModel.js";
import ApiError from "../../utils/api.error.js";

export const getDiscoveryProfilesService = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  page = Number(page) || 1;
  limit = Number(limit) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  const skip = (page - 1) * limit;

  const loggedInUserId = new mongoose.Types.ObjectId(userId);

  const filter = {
    userId: {
      $ne: loggedInUserId,
    },
  };

  const [profiles, total] = await Promise.all([
    profileModel
      .find(filter)
      .populate({
        path: "userId",
        select: "_id name email phone isBlocked",
      })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    profileModel.countDocuments(filter),
  ]);

  const data = profiles
    .filter((profile) => profile.userId)
    .map((profile) => ({
      user: profile.userId,

      profile: {
        ...profile,
        userId: undefined,
      },
    }));

  const totalPages =
    total === 0
      ? 0
      : Math.ceil(total / limit);

  return {
    data,

    pagination: {
      currentPage: page,
      limit,
      total,
      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,

      nextPage:
        page < totalPages
          ? page + 1
          : null,

      previousPage:
        page > 1
          ? page - 1
          : null,
    },
  };
};