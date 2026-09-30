import mongoose from "mongoose";

import LikeModel from "../../models/like.Model.js";
import profileModel from "../../models/profileModel.js";
import ApiError from "../../utils/api.error.js";

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
 * GET MATCHES
 * -------------------------------------------------------
 *
 * Current user liked another user
 * AND
 * that user liked current user
 */
export const getMatchesService = async ({ userId, page = 1, limit = 20 }) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const pagination = normalizePagination({
    page,
    limit,
  });

  const currentUserId = new mongoose.Types.ObjectId(userId);

  /**
   * Step 1:
   * Users liked by current user
   */
  const sentLikes = await LikeModel.find({
    fromUserId: currentUserId,
    status: "ACTIVE",
  })
    .select("_id toUserId createdAt")
    .lean();

  if (!sentLikes.length) {
    return {
      data: [],
      pagination: {
        currentPage: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        nextPage: null,
        previousPage: null,
      },
    };
  }

  const likedUserIds = sentLikes.map((like) => like.toUserId);

  /**
   * Step 2:
   * Find reciprocal likes
   */
  const receivedLikes = await LikeModel.find({
    fromUserId: {
      $in: likedUserIds,
    },
    toUserId: currentUserId,
    status: "ACTIVE",
  })
    .select("_id fromUserId createdAt")
    .lean();

  if (!receivedLikes.length) {
    return {
      data: [],
      pagination: {
        currentPage: pagination.page,
        limit: pagination.limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        nextPage: null,
        previousPage: null,
      },
    };
  }

  /**
   * Actual matched users
   */
  const matchedUserIds = receivedLikes.map((like) => like.fromUserId);

  const total = matchedUserIds.length;

  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  const paginatedMatchedUserIds = matchedUserIds.slice(
    pagination.skip,
    pagination.skip + pagination.limit,
  );

  /**
   * Step 3:
   * Fetch matched profiles
   */
  const profiles = await profileModel
    .find({
      userId: {
        $in: paginatedMatchedUserIds,
      },
    })
    .populate({
      path: "userId",
      select: "_id name",
      match: {
        isBlocked: {
          $ne: true,
        },
      },
    })
    .lean();

  /**
   * Profile map
   */
  const profileMap = new Map();

  profiles.forEach((profile) => {
    if (!profile.userId) {
      return;
    }

    profileMap.set(profile.userId._id.toString(), profile);
  });

  /**
   * Sent like map
   */
  const sentLikeMap = new Map();

  sentLikes.forEach((like) => {
    sentLikeMap.set(like.toUserId.toString(), like);
  });

  /**
   * Received like map
   */
  const receivedLikeMap = new Map();

  receivedLikes.forEach((like) => {
    receivedLikeMap.set(like.fromUserId.toString(), like);
  });

  /**
   * Final response
   */
  const data = paginatedMatchedUserIds.map((matchedUserId) => {
    const id = matchedUserId.toString();

    const profile = profileMap.get(id) || null;

    const sentLike = sentLikeMap.get(id);

    const receivedLike = receivedLikeMap.get(id);

    /**
     * Match time =
     * whichever like happened later
     */
    let matchedAt = null;

    if (sentLike?.createdAt && receivedLike?.createdAt) {
      matchedAt = new Date(
        Math.max(
          new Date(sentLike.createdAt).getTime(),

          new Date(receivedLike.createdAt).getTime(),
        ),
      );
    }

    return {
      matchedUserId,

      isMatched: true,

      matchedAt,

      sentLikeId: sentLike?._id || null,

      receivedLikeId: receivedLike?._id || null,

      user: profile?.userId || null,

      profile: profile
        ? {
            _id: profile._id,

            profileImage: profile.profileImage,

            photos: profile.photos || [],

            dateOfBirth: profile.dateOfBirth,

            height: profile.height,

            languages: profile.languages || [],

            gender: profile.gender,

            genderDescription: profile.genderDescription,

            showGenderOnProfile: profile.showGenderOnProfile,

            profession: profile.profession,

            customProfession: profile.customProfession,

            orientation: profile.orientation,

            customOrientation: profile.customOrientation,

            showOrientationOnProfile: profile.showOrientationOnProfile,

            meetzoGoal: profile.meetzoGoal,

            relationshipPace: profile.relationshipPace,

            smoking: profile.smoking,

            drinking: profile.drinking,

            fitness: profile.fitness,

            pets: profile.pets,

            selfDescription: profile.selfDescription || [],

            interests: profile.interests || [],

            religion: profile.religion,

            customReligion: profile.customReligion,

            idealWeekend: profile.idealWeekend || [],

            values: profile.values || [],

            bio: profile.bio,

            showBioOnProfile: profile.showBioOnProfile,

            education: profile.education,

            college: profile.college,

            company: profile.company,

            jobTitle: profile.jobTitle,

            city: profile.city,

            hometown: profile.hometown,

            kycStatus: profile.kycStatus,

            isKycVerified: profile.isKycVerified,

            faceVerificationStatus: profile.faceVerificationStatus,

            isFaceVerified: profile.isFaceVerified,

            isProfileCompleted: profile.isProfileCompleted,

            createdAt: profile.createdAt,

            updatedAt: profile.updatedAt,
          }
        : null,
    };
  });

  /**
   * Newest match first
   */
  data.sort((a, b) => {
    if (!a.matchedAt) return 1;
    if (!b.matchedAt) return -1;

    return new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime();
  });

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

/**
 * -------------------------------------------------------
 * CHECK MATCH STATUS
 * -------------------------------------------------------
 */
export const getMatchStatusService = async ({ userId, targetUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new ApiError(400, "Invalid user id");
  }

  if (userId.toString() === targetUserId.toString()) {
    throw new ApiError(400, "Invalid operation");
  }

  const [sentLike, receivedLike] = await Promise.all([
    LikeModel.findOne({
      fromUserId: userId,
      toUserId: targetUserId,
      status: "ACTIVE",
    })
      .select("_id createdAt")
      .lean(),

    LikeModel.findOne({
      fromUserId: targetUserId,
      toUserId: userId,
      status: "ACTIVE",
    })
      .select("_id createdAt")
      .lean(),
  ]);

  const isMatched = Boolean(sentLike && receivedLike);

  let matchedAt = null;

  if (isMatched) {
    matchedAt = new Date(
      Math.max(
        new Date(sentLike.createdAt).getTime(),

        new Date(receivedLike.createdAt).getTime(),
      ),
    );
  }

  return {
    isMatched,

    hasLiked: Boolean(sentLike),

    likedByUser: Boolean(receivedLike),

    sentLikeId: sentLike?._id || null,

    receivedLikeId: receivedLike?._id || null,

    matchedAt,
  };
};

/**
 * -------------------------------------------------------
 * GET MATCH COUNT
 * -------------------------------------------------------
 */
export const getMatchCountService = async ({ userId }) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const sentLikes = await LikeModel.find({
    fromUserId: userId,
    status: "ACTIVE",
  })
    .select("toUserId")
    .lean();

  if (!sentLikes.length) {
    return {
      count: 0,
    };
  }

  const likedUserIds = sentLikes.map((like) => like.toUserId);

  const count = await LikeModel.countDocuments({
    fromUserId: {
      $in: likedUserIds,
    },
    toUserId: userId,
    status: "ACTIVE",
  });

  return {
    count,
  };
};

// likes.service.js

export const getMatchUserDetailsService = async ({
  fromUserId,
  toUserId,
}) => {
  if (
    !mongoose.Types.ObjectId.isValid(fromUserId) ||
    !mongoose.Types.ObjectId.isValid(toUserId)
  ) {
    throw new ApiError(400, "Invalid user id");
  }

  if (fromUserId.toString() === toUserId.toString()) {
    throw new ApiError(400, "Invalid operation");
  }

  /**
   * Check mutual likes
   */
  const [sentLike, receivedLike] = await Promise.all([
    LikeModel.findOne({
      fromUserId,
      toUserId,
      status: "ACTIVE",
    }).lean(),

    LikeModel.findOne({
      fromUserId: toUserId,
      toUserId: fromUserId,
      status: "ACTIVE",
    }).lean(),
  ]);

  /**
   * Match exists only if both likes are ACTIVE
   */
  if (!sentLike || !receivedLike) {
    throw new ApiError(404, "Match not found");
  }

  /**
   * Fetch matched user's profile
   */
  const profile = await profileModel
    .findOne({
      userId: toUserId,
    })
    .populate({
      path: "userId",
      select: "_id name",
      match: {
        isBlocked: {
          $ne: true,
        },
      },
    })
    .lean();

  if (!profile || !profile.userId) {
    throw new ApiError(404, "Matched user profile not found");
  }

  /**
   * Match time = later like time
   */
  const matchedAt = new Date(
    Math.max(
      new Date(sentLike.createdAt).getTime(),
      new Date(receivedLike.createdAt).getTime()
    )
  );

  return {
    matchedUserId: toUserId,

    isMatched: true,

    matchedAt,

    sentLikeId: sentLike._id,

    receivedLikeId: receivedLike._id,

    user: profile.userId,

    profile: {
      _id: profile._id,

      profileImage: profile.profileImage,

      photos: profile.photos || [],

      dateOfBirth: profile.dateOfBirth,

      height: profile.height,

      languages: profile.languages || [],

      gender: profile.gender,

      genderDescription: profile.genderDescription,

      showGenderOnProfile: profile.showGenderOnProfile,

      profession: profile.profession,

      customProfession: profile.customProfession,

      orientation: profile.orientation,

      customOrientation: profile.customOrientation,

      showOrientationOnProfile: profile.showOrientationOnProfile,

      meetzoGoal: profile.meetzoGoal,

      relationshipPace: profile.relationshipPace,

      smoking: profile.smoking,

      drinking: profile.drinking,

      fitness: profile.fitness,

      pets: profile.pets,

      selfDescription: profile.selfDescription || [],

      interests: profile.interests || [],

      religion: profile.religion,

      customReligion: profile.customReligion,

      idealWeekend: profile.idealWeekend || [],

      values: profile.values || [],

      bio: profile.bio,

      showBioOnProfile: profile.showBioOnProfile,

      education: profile.education,

      college: profile.college,

      company: profile.company,

      jobTitle: profile.jobTitle,

      city: profile.city,

      hometown: profile.hometown,

      kycStatus: profile.kycStatus,

      isKycVerified: profile.isKycVerified,

      faceVerificationStatus: profile.faceVerificationStatus,

      isFaceVerified: profile.isFaceVerified,

      isProfileCompleted: profile.isProfileCompleted,

      createdAt: profile.createdAt,

      updatedAt: profile.updatedAt,
    },
  };
};