import mongoose from "mongoose";

import userModel from "../../models/userModel.js";
import LikeModel from "../../models/like.Model.js";
import ApiError from "../../utils/api.error.js";
import profileModel from "../../models/profileModel.js";
import MatchModel from "../../models/chatModel.js";
import { notifyUser } from "../notifications/notifications.service.js";

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
// export const likeUserService = async ({ fromUserId, toUserId }) => {
//   // Validate target user id
//   if (!mongoose.Types.ObjectId.isValid(toUserId)) {
//     throw new ApiError(400, "Invalid user id");
//   }

//   // User cannot like themselves
//   if (fromUserId.toString() === toUserId.toString()) {
//     throw new ApiError(400, "You cannot like yourself");
//   }

//   /**
//    * Check target user exists
//    * and is not blocked
//    */
//   const targetUser = await userModel.exists({
//     _id: toUserId,

//     isBlocked: {
//       $ne: true,
//     },
//   });

//   if (!targetUser) {
//     throw new ApiError(404, "User not found");
//   }

//   /**
//    * We already have unique index:
//    *
//    * fromUserId + toUserId
//    *
//    * So:
//    *
//    * No existing like
//    *      ↓
//    * Create ACTIVE like
//    *
//    * Existing REMOVED like
//    *      ↓
//    * Change back to ACTIVE
//    *
//    * Existing ACTIVE like
//    *      ↓
//    * Keep ACTIVE
//    */
//   try {
//     const like = await LikeModel.findOneAndUpdate(
//       {
//         fromUserId,
//         toUserId,
//       },

//       {
//         $set: {
//           status: "ACTIVE",
//         },
//       },

//       {
//         new: true,
//         upsert: true,
//         setDefaultsOnInsert: true,
//       },
//     ).lean();

//     return like;
//   } catch (error) {
//     /**
//      * Rare race condition:
//      *
//      * Two like requests may arrive at
//      * almost exactly the same time.
//      *
//      * Unique index could cause E11000.
//      */
//     if (error?.code === 11000) {
//       const existingLike = await LikeModel.findOneAndUpdate(
//         {
//           fromUserId,
//           toUserId,
//         },
//         {
//           $set: {
//             status: "ACTIVE",
//           },
//         },
//         {
//           new: true,
//         },
//       ).lean();

//       if (existingLike) {
//         return existingLike;
//       }
//     }

//     throw error;
//   }
// };


export const likeUserService = async ({ fromUserId, toUserId }) => {
  // ========================================
  // VALIDATE USER IDS
  // ========================================

  if (
    !mongoose.Types.ObjectId.isValid(fromUserId) ||
    !mongoose.Types.ObjectId.isValid(toUserId)
  ) {
    throw new ApiError(400, "Invalid user id");
  }

  const fromId = new mongoose.Types.ObjectId(fromUserId);
  const toId = new mongoose.Types.ObjectId(toUserId);

  if (fromId.equals(toId)) {
    throw new ApiError(400, "You cannot like yourself");
  }

  // ========================================
  // CHECK TARGET USER
  // ========================================

  const targetUser = await userModel.exists({
    _id: toId,
    isBlocked: { $ne: true },
  });

  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  // Remember whether the like was already active, so repeated taps don't re-notify.
  const wasActive = await LikeModel.exists({
    fromUserId: fromId,
    toUserId: toId,
    status: "ACTIVE",
  });

  // ========================================
  // CREATE OR REACTIVATE LIKE
  // ========================================

  let like;

  try {
    like = await LikeModel.findOneAndUpdate(
      {
        fromUserId: fromId,
        toUserId: toId,
      },
      {
        $set: {
          status: "ACTIVE",
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    like = await LikeModel.findOneAndUpdate(
      {
        fromUserId: fromId,
        toUserId: toId,
      },
      {
        $set: {
          status: "ACTIVE",
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).lean();

    if (!like) {
      throw new ApiError(409, "Unable to process like");
    }
  }

  // ========================================
  // CHECK REVERSE LIKE
  // ========================================

  const reverseLike = await LikeModel.exists({
    fromUserId: toId,
    toUserId: fromId,
    status: "ACTIVE",
  });

  // ========================================
  // CREATE CHAT WHEN MUTUAL LIKE EXISTS
  // ========================================

  let match = null;

  if (reverseLike) {
    const participants = [fromId, toId].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    const pairKey = participants
      .map((id) => id.toString())
      .join("_");

    try {
      match = await MatchModel.findOneAndUpdate(
        { pairKey },
        {
          $setOnInsert: {
            pairKey,
            participants,
            participantStates: participants.map((id) => ({
              userId: id,
              unreadCount: 0,
              lastReadMessageId: null,
              lastReadAt: null,
              isArchived: false,
              isDeleted: false,
              deletedAt: null,
            })),
            isActive: true,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
          runValidators: true,
        }
      ).lean();
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      // Concurrent request already created the chat.
      match = await MatchModel.findOne({ pairKey }).lean();

      if (!match) {
        throw new ApiError(
          409,
          "Unable to create mutual match"
        );
      }
    }
  }

  // ========================================
  // RESPONSE FOR FLUTTER
  // ========================================

  const isMatch = Boolean(reverseLike && match);

  // Push only for a new (or re-activated) like: a match notifies both users, a like notifies the target.
  if (!wasActive) {
    if (isMatch) {
      notifyUser(fromId, { title: "It's a match!", body: "You have a new match",
        data: { type: "NEW_MATCH", chatId: match._id, userId: toId } });
      notifyUser(toId, { title: "It's a match!", body: "You have a new match",
        data: { type: "NEW_MATCH", chatId: match._id, userId: fromId } });
    } else {
      notifyUser(toId, { title: "New like", body: "Someone liked your profile",
        data: { type: "NEW_LIKE" } });
    }
  }

  return {
    ...like,

    isLiked: true,
    isMatch,

    matchId: isMatch ? match._id : null,
    matchedUserId: isMatch ? toId : null,
  };
};


/**
 * -------------------------------------------------------
 * UNLIKE USER
 * -------------------------------------------------------
 */
export const unlikeUserService = async ({ fromUserId, toUserId }) => {
  if (
    !mongoose.Types.ObjectId.isValid(fromUserId) ||
    !mongoose.Types.ObjectId.isValid(toUserId)
  ) {
    throw new ApiError(400, "Invalid user id");
  }

  if (fromUserId.toString() === toUserId.toString()) {
    throw new ApiError(400, "Invalid operation");
  }

  const like = await LikeModel.findOneAndUpdate(
    {
      fromUserId,
      toUserId,
    },
    {
      $set: {
        status: "REMOVED",
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    },
  ).lean();

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
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const loggedInUserId = new mongoose.Types.ObjectId(userId);

  // Get all active matches of logged-in user
  const matches = await MatchModel.find({
    status: "ACTIVE",
    $or: [{ user1Id: loggedInUserId }, { user2Id: loggedInUserId }],
  })
    .select("user1Id user2Id")
    .lean();

  // Get matched users' IDs
  const matchedUserIds = matches.map((match) => {
    return match.user1Id.toString() === loggedInUserId.toString()
      ? match.user2Id
      : match.user1Id;
  });

  // Count received likes, excluding already matched users
  const count = await LikeModel.countDocuments({
    toUserId: loggedInUserId,
    status: "ACTIVE",
    fromUserId: {
      $nin: matchedUserIds,
    },
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

// export const getLikedProfilesService = async ({
//   userId,
//   page = 1,
//   limit = 20,
// }) => {
//   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//     throw new ApiError(400, "Invalid user id");
//   }

//   const pagination = normalizePagination({
//     page,
//     limit,
//   });

//   const loggedInUserId = new mongoose.Types.ObjectId(userId);

//   // ========================================
//   // GET ALL MATCHES OF LOGGED-IN USER
//   // ========================================

//   const matches = await MatchModel.find({
//     status: "ACTIVE",

//     $or: [
//       {
//         user1Id: loggedInUserId,
//       },
//       {
//         user2Id: loggedInUserId,
//       },
//     ],
//   })
//     .select("user1Id user2Id")
//     .lean();

//   // ========================================
//   // GET MATCHED USER IDS
//   // ========================================

//   const matchedUserIds = matches.map((match) => {
//     const user1Id = match.user1Id.toString();

//     const user2Id = match.user2Id.toString();

//     return user1Id === userId.toString() ? match.user2Id : match.user1Id;
//   });

//   // ========================================
//   // LIKED USERS FILTER
//   // EXCLUDE MATCHED USERS
//   // ========================================

//   const filter = {
//     fromUserId: loggedInUserId,

//     status: "ACTIVE",

//     toUserId: {
//       $nin: matchedUserIds,
//     },
//   };

//   // ========================================
//   // FETCH LIKES
//   // ========================================

//   const [likes, total] = await Promise.all([
//     LikeModel.find(filter)
//       .select("_id toUserId createdAt")
//       .sort({
//         createdAt: -1,
//       })
//       .skip(pagination.skip)
//       .limit(pagination.limit)
//       .lean(),

//     LikeModel.countDocuments(filter),
//   ]);

//   // ========================================
//   // NO LIKES FOUND
//   // ========================================

//   if (likes.length === 0) {
//     return {
//       data: [],

//       pagination: {
//         currentPage: pagination.page,

//         limit: pagination.limit,

//         total: 0,

//         totalPages: 0,

//         hasNextPage: false,

//         hasPreviousPage: pagination.page > 1,

//         nextPage: null,

//         previousPage: pagination.page > 1 ? pagination.page - 1 : null,
//       },
//     };
//   }

//   // ========================================
//   // LIKED USER IDS
//   // ========================================

//   const likedUserIds = likes.map((like) => like.toUserId);

//   // ========================================
//   // FETCH PROFILES
//   // ========================================

//   const profiles = await profileModel
//     .find({
//       userId: {
//         $in: likedUserIds,
//       },
//     })

//     .populate({
//       path: "userId",

//       select: ["_id", "name", "email", "phone", "isBlocked"].join(" "),

//       match: {
//         isBlocked: {
//           $ne: true,
//         },
//       },
//     })

//     .lean();

//   // ========================================
//   // CREATE PROFILE MAP
//   // ========================================

//   const profileMap = new Map();

//   for (const profile of profiles) {
//     if (!profile.userId) {
//       continue;
//     }

//     profileMap.set(profile.userId._id.toString(), profile);
//   }

//   // ========================================
//   // FORMAT RESPONSE
//   // ========================================

//   const data = likes
//     .map((like) => {
//       const profile = profileMap.get(like.toUserId.toString());

//       if (!profile) {
//         return null;
//       }

//       return {
//         likeId: like._id,

//         likedAt: like.createdAt,

//         isLiked: true,

//         user: profile.userId,

//         profile: {
//           ...profile,

//           userId: undefined,
//         },
//       };
//     })
//     .filter(Boolean);

//   // ========================================
//   // PAGINATION
//   // ========================================

//   const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

//   return {
//     data,

//     pagination: {
//       currentPage: pagination.page,

//       limit: pagination.limit,

//       total,

//       totalPages,

//       hasNextPage: pagination.page < totalPages,

//       hasPreviousPage: pagination.page > 1,

//       nextPage: pagination.page < totalPages ? pagination.page + 1 : null,

//       previousPage: pagination.page > 1 ? pagination.page - 1 : null,
//     },
//   };
// };

// recieved like for user

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();

  let age = today.getUTCFullYear() - dob.getUTCFullYear();

  const hasBirthdayPassed =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() &&
      today.getUTCDate() >= dob.getUTCDate());

  if (!hasBirthdayPassed) age--;

  return age >= 0 ? age : null;
};

// ========================================
// CALCULATE DISTANCE IN KM
// ========================================

const calculateDistance = (location1, location2) => {
  const coordinates1 = location1?.coordinates;
  const coordinates2 = location2?.coordinates;

  if (
    !Array.isArray(coordinates1) ||
    !Array.isArray(coordinates2) ||
    coordinates1.length !== 2 ||
    coordinates2.length !== 2
  ) {
    return null;
  }

  const [lon1, lat1] = coordinates1;
  const [lon2, lat2] = coordinates2;

  if (
    ![lon1, lat1, lon2, lat2].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) ||
    Math.abs(lon1) > 180 ||
    Math.abs(lon2) > 180 ||
    Math.abs(lat1) > 90 ||
    Math.abs(lat2) > 90
  ) {
    return null;
  }

  const earthRadiusKm = 6371;

  const toRadians = (degree) => (degree * Math.PI) / 180;

  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(Math.max(0, Math.min(1, a))),
      Math.sqrt(Math.max(0, 1 - a)),
    );

  const distance = earthRadiusKm * c;

  return Math.round(distance * 10) / 10;
};

// ========================================
// RECEIVED LIKED PROFILES SERVICE
// ========================================

// export const getLikedProfilesService = async ({
//   userId,
//   page = 1,
//   limit = 20,
// }) => {
//   // ========================================
//   // VALIDATION
//   // ========================================

//   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//     throw new ApiError(400, "Invalid user id");
//   }

//   const currentPage = Math.max(1, parseInt(page, 10) || 1);

//   const pageLimit = Math.min(
//     100,
//     Math.max(1, parseInt(limit, 10) || 20)
//   );

//   const skip = (currentPage - 1) * pageLimit;

//   const loggedInUserId = new mongoose.Types.ObjectId(userId);

//   // ========================================
//   // GET LOGGED-IN USER LOCATION
//   // ========================================

//   const loggedInProfile = await profileModel
//     .findOne({ userId: loggedInUserId })
//     .select("location")
//     .lean();

//   if (!loggedInProfile) {
//     throw new ApiError(404, "Logged-in user profile not found");
//   }

//   const loggedInLocation = loggedInProfile.location;

//   // ========================================
//   // GET ACTIVE MATCHES
//   // ========================================

//   const matches = await MatchModel.find({
//     status: "ACTIVE",
//     $or: [
//       { user1Id: loggedInUserId },
//       { user2Id: loggedInUserId },
//     ],
//   })
//     .select("user1Id user2Id")
//     .lean();

//   const matchedUserIds = matches.map((match) =>
//     match.user1Id.toString() === loggedInUserId.toString()
//       ? match.user2Id
//       : match.user1Id
//   );

//   // ========================================
//   // RECEIVED LIKES FILTER
//   // ========================================

//   const baseFilter = {
//     toUserId: loggedInUserId,
//     status: "ACTIVE",
//     fromUserId: {
//       $nin: matchedUserIds,
//     },
//   };

//   // ========================================
//   // FIND ELIGIBLE SENDERS
//   // ========================================

//   const senderIds = await LikeModel.distinct(
//     "fromUserId",
//     baseFilter
//   );

//   const availableUsers = await userModel
//     .find({
//       _id: { $in: senderIds },
//       isBlocked: { $ne: true },
//     })
//     .select("_id")
//     .lean();

//   const availableUserIds = availableUsers.map(
//     (user) => user._id
//   );

//   const availableProfiles = await profileModel
//     .find({
//       userId: { $in: availableUserIds },
//       isProfileCompleted: true,
//     })
//     .select("userId")
//     .lean();

//   const eligibleSenderIds = availableProfiles.map(
//     (profile) => profile.userId
//   );

//   const finalFilter = {
//     ...baseFilter,
//     fromUserId: {
//       $in: eligibleSenderIds,
//     },
//   };

//   // ========================================
//   // FETCH LIKES WITH PAGINATION
//   // ========================================

//   const [likes, total] = await Promise.all([
//     LikeModel.find(finalFilter)
//       .select("_id fromUserId createdAt")
//       .sort({ createdAt: -1, _id: -1 })
//       .skip(skip)
//       .limit(pageLimit)
//       .lean(),

//     LikeModel.countDocuments(finalFilter),
//   ]);

//   const totalPages = Math.ceil(total / pageLimit);

//   const pagination = {
//     currentPage,
//     limit: pageLimit,
//     total,
//     totalPages,
//     hasNextPage: currentPage < totalPages,
//     hasPreviousPage: currentPage > 1,
//     nextPage:
//       currentPage < totalPages
//         ? currentPage + 1
//         : null,
//     previousPage:
//       currentPage > 1
//         ? currentPage - 1
//         : null,
//   };

//   if (likes.length === 0) {
//     return {
//       data: [],
//       pagination,
//     };
//   }

//   // ========================================
//   // FETCH USERS WHO LIKED ME
//   // ========================================

//   const likedByUserIds = likes.map(
//     (like) => like.fromUserId
//   );

//   const [users, profiles] = await Promise.all([
//     userModel
//       .find({
//         _id: { $in: likedByUserIds },
//         isBlocked: { $ne: true },
//       })
//       .select("_id name")
//       .lean(),

//     profileModel
//       .find({
//         userId: { $in: likedByUserIds },
//         isProfileCompleted: true,
//       })
//       .select(
//         [
//           "_id",
//           "userId",
//           "profileImage",
//           "photos",
//           "dateOfBirth",
//           "height",
//           "languages",
//           "gender",
//           "genderDescription",
//           "showGenderOnProfile",
//           "profession",
//           "customProfession",
//           "orientation",
//           "customOrientation",
//           "showOrientationOnProfile",
//           "meetzoGoal",
//           "relationshipPace",
//           "smoking",
//           "drinking",
//           "fitness",
//           "pets",
//           "selfDescription",
//           "interests",
//           "religion",
//           "customReligion",
//           "idealWeekend",
//           "values",
//           "bio",
//           "showBioOnProfile",
//           "education",
//           "college",
//           "company",
//           "jobTitle",
//           "city",
//           "hometown",
//           "location",
//           "isKycVerified",
//           "isFaceVerified",
//           "isProfileCompleted",
//         ].join(" ")
//       )
//       .lean(),
//   ]);

//   // ========================================
//   // CREATE USER MAP
//   // ========================================

//   const userMap = new Map();

//   for (const user of users) {
//     userMap.set(user._id.toString(), user);
//   }

//   // ========================================
//   // CREATE PROFILE MAP WITH DISTANCE
//   // ========================================

//   const profileMap = new Map();

//   for (const profile of profiles) {
//     const userKey = profile.userId.toString();

//     const publicPhotos = (profile.photos || [])
//       .filter((photo) => photo.visibility === "PUBLIC")
//       .sort((a, b) => a.order - b.order)
//       .map((photo) => ({
//         _id: photo._id,
//         url: photo.url,
//         visibility: photo.visibility,
//         isMain: photo.isMain,
//         order: photo.order,
//       }));

//     const mainPhoto =
//       publicPhotos.find((photo) => photo.isMain) ||
//       publicPhotos[0] ||
//       null;

//     // Calculate distance between both users.
//     const distanceKm = calculateDistance(
//       loggedInLocation,
//       profile.location
//     );

//     const formattedProfile = {
//       _id: profile._id,

//       profileImage: mainPhoto?.url || null,
//       photos: publicPhotos,

//       age: calculateAge(profile.dateOfBirth),

//       // New distance fields
//       distanceKm,

//       height: profile.height || null,
//       languages: profile.languages || [],

//       gender: profile.showGenderOnProfile
//         ? profile.gender
//         : null,

//       genderDescription: profile.showGenderOnProfile
//         ? profile.genderDescription
//         : null,

//       showGenderOnProfile:
//         profile.showGenderOnProfile ?? true,

//       profession: profile.profession,
//       customProfession: profile.customProfession,

//       orientation: profile.showOrientationOnProfile
//         ? profile.orientation
//         : null,

//       customOrientation:
//         profile.showOrientationOnProfile
//           ? profile.customOrientation
//           : null,

//       showOrientationOnProfile:
//         profile.showOrientationOnProfile ?? true,

//       meetzoGoal: profile.meetzoGoal,
//       relationshipPace: profile.relationshipPace,

//       smoking: profile.smoking,
//       drinking: profile.drinking,
//       fitness: profile.fitness,
//       pets: profile.pets,

//       selfDescription: profile.selfDescription || [],
//       interests: profile.interests || [],

//       religion: profile.religion,
//       customReligion: profile.customReligion,

//       idealWeekend: profile.idealWeekend || [],
//       values: profile.values || [],

//       bio: profile.showBioOnProfile
//         ? profile.bio
//         : null,

//       showBioOnProfile:
//         profile.showBioOnProfile ?? true,

//       education: profile.education,
//       college: profile.college,
//       company: profile.company,
//       jobTitle: profile.jobTitle,

//       city: profile.city,
//       hometown: profile.hometown,

//       isKycVerified:
//         profile.isKycVerified === true,

//       isFaceVerified:
//         profile.isFaceVerified === true,

//       isProfileCompleted:
//         profile.isProfileCompleted === true,
//     };

//     profileMap.set(userKey, formattedProfile);
//   }

//   // ========================================
//   // FORMAT RESPONSE
//   // ========================================

//   const data = likes
//     .map((like) => {
//       const senderId = like.fromUserId.toString();

//       const user = userMap.get(senderId);
//       const profile = profileMap.get(senderId);

//       if (!user || !profile) return null;

//       return {
//         likeId: like._id,
//         likedAt: like.createdAt,
//         isLiked: true,

//         user,
//         profile,
//       };
//     })
//     .filter(Boolean);

//   return {
//     data,
//     pagination,
//   };
// };

export const getLikedProfilesService = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  // ========================================
  // VALIDATION
  // ========================================

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const skip = (currentPage - 1) * pageLimit;

  const loggedInUserId = new mongoose.Types.ObjectId(userId);

  // ========================================
  // GET LOGGED-IN USER LOCATION
  // ========================================

  const loggedInProfile = await profileModel
    .findOne({ userId: loggedInUserId })
    .select("location")
    .lean();

  if (!loggedInProfile) {
    throw new ApiError(404, "Logged-in user profile not found");
  }

  const loggedInLocation = loggedInProfile.location;

  // ========================================
  // GET ACTIVE MATCHES
  // ========================================

  const matches = await MatchModel.find({
    status: "ACTIVE",
    $or: [{ user1Id: loggedInUserId }, { user2Id: loggedInUserId }],
  })
    .select("user1Id user2Id")
    .lean();

  const matchedUserIds = matches.map((match) =>
    match.user1Id.toString() === loggedInUserId.toString()
      ? match.user2Id
      : match.user1Id,
  );

  // ========================================
  // GET USERS LIKED BY LOGGED-IN USER
  // ========================================

  const outgoingLikes = await LikeModel.find({
    fromUserId: loggedInUserId,
    status: "ACTIVE",
  })
    .select("toUserId")
    .lean();

  const outgoingLikedUserIds = outgoingLikes.map((like) => like.toUserId);

  // ========================================
  // EXCLUDE MATCHED + MUTUALLY LIKED USERS
  // ========================================

  const excludedUserIds = [...matchedUserIds, ...outgoingLikedUserIds];

  // ========================================
  // RECEIVED LIKES FILTER
  // ONLY ONE-SIDED LIKES
  // ========================================

  const baseFilter = {
    toUserId: loggedInUserId,
    status: "ACTIVE",
    fromUserId: {
      $nin: excludedUserIds,
    },
  };

  // ========================================
  // FIND ELIGIBLE SENDERS
  // ========================================

  const senderIds = await LikeModel.distinct("fromUserId", baseFilter);

  const availableUsers = await userModel
    .find({
      _id: { $in: senderIds },
      isBlocked: { $ne: true },
    })
    .select("_id")
    .lean();

  const availableUserIds = availableUsers.map((user) => user._id);

  const availableProfiles = await profileModel
    .find({
      userId: { $in: availableUserIds },
      isProfileCompleted: true,
    })
    .select("userId")
    .lean();

  const eligibleSenderIds = availableProfiles.map((profile) => profile.userId);

  const finalFilter = {
    ...baseFilter,
    fromUserId: {
      $in: eligibleSenderIds,
      $nin: excludedUserIds,
    },
  };

  // ========================================
  // FETCH LIKES WITH PAGINATION
  // ========================================

  const [likes, total] = await Promise.all([
    LikeModel.find(finalFilter)
      .select("_id fromUserId createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean(),

    LikeModel.countDocuments(finalFilter),
  ]);

  const totalPages = Math.ceil(total / pageLimit);

  const pagination = {
    currentPage,
    limit: pageLimit,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    previousPage: currentPage > 1 ? currentPage - 1 : null,
  };

  if (likes.length === 0) {
    return {
      data: [],
      pagination,
    };
  }

  // ========================================
  // FETCH USERS WHO LIKED ME
  // ========================================

  const likedByUserIds = likes.map((like) => like.fromUserId);

  const [users, profiles] = await Promise.all([
    userModel
      .find({
        _id: { $in: likedByUserIds },
        isBlocked: { $ne: true },
      })
      .select("_id name")
      .lean(),

    profileModel
      .find({
        userId: { $in: likedByUserIds },
        isProfileCompleted: true,
      })
      .select(
        [
          "_id",
          "userId",
          "profileImage",
          "photos",
          "dateOfBirth",
          "height",
          "languages",
          "gender",
          "genderDescription",
          "showGenderOnProfile",
          "profession",
          "customProfession",
          "orientation",
          "customOrientation",
          "showOrientationOnProfile",
          "meetzoGoal",
          "relationshipPace",
          "smoking",
          "drinking",
          "fitness",
          "pets",
          "selfDescription",
          "interests",
          "religion",
          "customReligion",
          "idealWeekend",
          "values",
          "bio",
          "showBioOnProfile",
          "education",
          "college",
          "company",
          "jobTitle",
          "city",
          "hometown",
          "location",
          "isKycVerified",
          "isFaceVerified",
          "isProfileCompleted",
        ].join(" "),
      )
      .lean(),
  ]);

  // ========================================
  // CREATE USER MAP
  // ========================================

  const userMap = new Map();

  for (const user of users) {
    userMap.set(user._id.toString(), user);
  }

  // ========================================
  // CREATE PROFILE MAP WITH DISTANCE
  // ========================================

  const profileMap = new Map();

  for (const profile of profiles) {
    const userKey = profile.userId.toString();

    const publicPhotos = (profile.photos || [])
      .filter((photo) => photo.visibility === "PUBLIC")
      .sort((a, b) => a.order - b.order)
      .map((photo) => ({
        _id: photo._id,
        url: photo.url,
        visibility: photo.visibility,
        isMain: photo.isMain,
        order: photo.order,
      }));

    const mainPhoto =
      publicPhotos.find((photo) => photo.isMain) || publicPhotos[0] || null;

    // ========================================
    // CALCULATE DISTANCE
    // ========================================

    const distanceKm = calculateDistance(loggedInLocation, profile.location);

    const formattedProfile = {
      _id: profile._id,

      profileImage: mainPhoto?.url || null,
      photos: publicPhotos,

      age: calculateAge(profile.dateOfBirth),

      distanceKm,

      height: profile.height || null,
      languages: profile.languages || [],

      gender: profile.showGenderOnProfile ? profile.gender : null,

      genderDescription: profile.showGenderOnProfile
        ? profile.genderDescription
        : null,

      showGenderOnProfile: profile.showGenderOnProfile ?? true,

      profession: profile.profession,
      customProfession: profile.customProfession,

      orientation: profile.showOrientationOnProfile
        ? profile.orientation
        : null,

      customOrientation: profile.showOrientationOnProfile
        ? profile.customOrientation
        : null,

      showOrientationOnProfile: profile.showOrientationOnProfile ?? true,

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

      bio: profile.showBioOnProfile ? profile.bio : null,

      showBioOnProfile: profile.showBioOnProfile ?? true,

      education: profile.education,
      college: profile.college,
      company: profile.company,
      jobTitle: profile.jobTitle,

      city: profile.city,
      hometown: profile.hometown,

      isKycVerified: profile.isKycVerified === true,

      isFaceVerified: profile.isFaceVerified === true,

      isProfileCompleted: profile.isProfileCompleted === true,
    };

    profileMap.set(userKey, formattedProfile);
  }

  // ========================================
  // FORMAT RESPONSE
  // ========================================

  const data = likes
    .map((like) => {
      const senderId = like.fromUserId.toString();

      const user = userMap.get(senderId);
      const profile = profileMap.get(senderId);

      if (!user || !profile) return null;

      return {
        likeId: like._id,
        likedAt: like.createdAt,
        isLiked: true,

        user,
        profile,
      };
    })
    .filter(Boolean);

  return {
    data,
    pagination,
  };
};
