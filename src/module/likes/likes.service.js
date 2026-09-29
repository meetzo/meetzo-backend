import mongoose from "mongoose";

import userModel from "../../models/userModel.js";
import LikeModel from "../../models/like.Model.js";
import ApiError from "../../utils/api.error.js";
import profileModel from "../../models/profileModel.js";

/**
 * -------------------------------------------------------
 * HELPER: PAGINATION
 * -------------------------------------------------------
 */
const normalizePagination = ({ page = 1, limit = 20 }) => {
  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  // Maximum 50 records per request
  if (limit > 50) {
    limit = 50;
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

/**
 * -------------------------------------------------------
 * LIKE USER
 * -------------------------------------------------------
 */
export const likeUserService = async ({ fromUserId, toUserId }) => {
  // Validate target user id
  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  // User cannot like themselves
  if (fromUserId.toString() === toUserId.toString()) {
    throw new ApiError(400, "You cannot like yourself");
  }

  /**
   * Check target user exists
   * and is not blocked
   */
  const targetUser = await userModel.exists({
    _id: toUserId,

    isBlocked: {
      $ne: true,
    },
  });

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  /**
   * We already have unique index:
   *
   * fromUserId + toUserId
   *
   * So:
   *
   * No existing like
   *      ↓
   * Create ACTIVE like
   *
   * Existing REMOVED like
   *      ↓
   * Change back to ACTIVE
   *
   * Existing ACTIVE like
   *      ↓
   * Keep ACTIVE
   */
  try {
    const like = await LikeModel.findOneAndUpdate(
      {
        fromUserId,
        toUserId,
      },

      {
        $set: {
          status: "ACTIVE",
        },
      },

      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    return like;
  } catch (error) {
    /**
     * Rare race condition:
     *
     * Two like requests may arrive at
     * almost exactly the same time.
     *
     * Unique index could cause E11000.
     */
    if (error?.code === 11000) {
      const existingLike = await LikeModel.findOneAndUpdate(
        {
          fromUserId,
          toUserId,
        },
        {
          $set: {
            status: "ACTIVE",
          },
        },
        {
          new: true,
        },
      ).lean();

      if (existingLike) {
        return existingLike;
      }
    }

    throw error;
  }
};

/**
 * -------------------------------------------------------
 * UNLIKE USER
 * -------------------------------------------------------
 */
export const unlikeUserService = async ({ fromUserId, toUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  if (fromUserId.toString() === toUserId.toString()) {
    throw new ApiError(400, "Invalid operation");
  }

  /**
   * We don't delete the Like document.
   *
   * ACTIVE → REMOVED
   */
  const like = await LikeModel.findOneAndUpdate(
    {
      fromUserId,
      toUserId,
      status: "ACTIVE",
    },

    {
      $set: {
        status: "REMOVED",
      },
    },

    {
      new: true,
    },
  ).lean();

  if (!like) {
    throw new ApiError(404, "Active like not found");
  }

  return like;
};

/**
 * -------------------------------------------------------
 * GET SENT LIKES
 * -------------------------------------------------------
 *
 * Returns users liked by the current user
 */
export const getSentLikesService = async ({ userId, page = 1, limit = 20 }) => {
  const pagination = normalizePagination({
    page,
    limit,
  });

  const filter = {
    fromUserId: userId,
    status: "ACTIVE",
  };

  const [likes, total] = await Promise.all([
    LikeModel.find(filter)
      .populate({
        path: "toUserId",

        select: ["_id", "name", "email", "phone"].join(" "),
      })
      .sort({
        createdAt: -1,
      })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    LikeModel.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    data: likes,

    pagination: {
      currentPage: pagination.page,

      limit: pagination.limit,

      total,

      totalPages,

      hasNextPage: pagination.page < totalPages,

      hasPreviousPage: pagination.page > 1,

      nextPage: pagination.page < totalPages ? pagination.page + 1 : null,

      previousPage: pagination.page > 1 ? pagination.page - 1 : null,
    },
  };
};

/**
 * -------------------------------------------------------
 * GET RECEIVED LIKES
 * -------------------------------------------------------
 *
 * Returns users who liked current user
 */
export const getReceivedLikesService = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  const pagination = normalizePagination({
    page,
    limit,
  });

  const filter = {
    toUserId: userId,
    status: "ACTIVE",
  };

  const [likes, total] = await Promise.all([
    LikeModel.find(filter)
      .populate({
        path: "fromUserId",

        select: ["_id", "name", "email", "phone"].join(" "),
      })
      .sort({
        createdAt: -1,
      })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    LikeModel.countDocuments(filter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    data: likes,

    pagination: {
      currentPage: pagination.page,

      limit: pagination.limit,

      total,

      totalPages,

      hasNextPage: pagination.page < totalPages,

      hasPreviousPage: pagination.page > 1,

      nextPage: pagination.page < totalPages ? pagination.page + 1 : null,

      previousPage: pagination.page > 1 ? pagination.page - 1 : null,
    },
  };
};

/**
 * -------------------------------------------------------
 * CHECK LIKE STATUS
 * -------------------------------------------------------
 *
 * Check whether current user has liked
 * another user
 */
export const getLikeStatusService = async ({ fromUserId, toUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const like = await LikeModel.findOne({
    fromUserId,
    toUserId,
  }).lean();

  if (!like) {
    return {
      isLiked: false,
      status: null,
      likeId: null,
    };
  }

  return {
    isLiked: like.status === "ACTIVE",

    status: like.status,

    likeId: like._id,
  };
};

/**
 * -------------------------------------------------------
 * GET RECEIVED LIKES COUNT
 * -------------------------------------------------------
 */
export const getReceivedLikesCountService = async ({ userId }) => {
  const count = await LikeModel.countDocuments({
    toUserId: userId,
    status: "ACTIVE",
  });

  return {
    count,
  };
};

/**
 * -------------------------------------------------------
 * GET SENT LIKES COUNT
 * -------------------------------------------------------
 */
export const getSentLikesCountService = async ({ userId }) => {
  const count = await LikeModel.countDocuments({
    fromUserId: userId,
    status: "ACTIVE",
  });

  return {
    count,
  };
};

/**
 * -------------------------------------------------------
 * GET LIKED PROFILES
 * -------------------------------------------------------
 *
 * Returns profile details of users liked
 * by the currently logged-in user.
 *
 * Current User
 *      ↓
 * fromUserId
 *      ↓
 * LikeModel
 *      ↓
 * toUserId
 *      ↓
 * Profile
 */
export const getLikedProfilesService = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  /**
   * Validate logged-in user
   */
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  /**
   * Normalize pagination using your existing helper
   */
  const pagination = normalizePagination({
    page,
    limit,
  });

  const filter = {
    fromUserId: userId,
    status: "ACTIVE",
  };

  /**
   * Fetch likes + count in parallel
   */
  const [likes, total] = await Promise.all([
    LikeModel.find(filter)
      .select("_id toUserId createdAt")
      .sort({
        createdAt: -1,
      })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    LikeModel.countDocuments(filter),
  ]);

  /**
   * No likes found
   */
  if (likes.length === 0) {
    return {
      data: [],

      pagination: {
        currentPage: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: pagination.page > 1,
        nextPage: null,
        previousPage: pagination.page > 1 ? pagination.page - 1 : null,
      },
    };
  }

  /**
   * Get IDs of liked users
   */
  const likedUserIds = likes.map((like) => like.toUserId);

  /**
   * Fetch profiles of liked users
   */
  const profiles = await profileModel
    .find({
      userId: {
        $in: likedUserIds,
      },
    })
    .populate({
      path: "userId",

      /**
       * Only return fields that are safe
       * to expose to another user.
       *
       * Add/remove fields according to
       * your user schema.
       */
      select: ["_id", "name", "email", "phone", "isBlocked"].join(" "),

      /**
       * Don't expose blocked users
       */
      match: {
        isBlocked: {
          $ne: true,
        },
      },
    })
    .lean();

  /**
   * Create profile map:
   *
   * userId => profile
   *
   * This avoids nested loops.
   */
  const profileMap = new Map();

  for (const profile of profiles) {
    /**
     * populate match can return null
     * when user is blocked
     */
    if (!profile.userId) {
      continue;
    }

    profileMap.set(profile.userId._id.toString(), profile);
  }

  /**
   * Maintain like order.
   *
   * Most recently liked profile
   * stays first.
   */
  const data = likes
    .map((like) => {
      const profile = profileMap.get(like.toUserId.toString());

      /**
       * Profile missing/deleted/blocked
       */
      if (!profile) {
        return null;
      }

      return {
        likeId: like._id,

        likedAt: like.createdAt,

        isLiked: true,

        /**
         * User basic information
         */
        user: profile.userId,

        /**
         * Complete profile document.
         *
         * userId already exists separately,
         * so remove it from profile object.
         */
        profile: {
          ...profile,
          userId: undefined,
        },
      };
    })
    .filter(Boolean);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    data,

    pagination: {
      currentPage: pagination.page,

      limit: pagination.limit,

      total,

      totalPages,

      hasNextPage: pagination.page < totalPages,

      hasPreviousPage: pagination.page > 1,

      nextPage: pagination.page < totalPages ? pagination.page + 1 : null,

      previousPage: pagination.page > 1 ? pagination.page - 1 : null,
    },
  };
};
