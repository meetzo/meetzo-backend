
import mongoose from "mongoose";

import profileModel from "../../models/profileModel.js";
import ApiError from "../../utils/api.error.js";

// ==========================================
// HELPERS
// ==========================================

const isValidLocation = (location) => {
  if (
    !location ||
    location.type !== "Point" ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    return false;
  }

  const [lng, lat] = location.coordinates;

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
};

// Calculate approximate distance in kilometers.
// Used for the normal discovery feed.
const calculateDistanceKm = (
  sourceLocation,
  targetLocation
) => {
  if (
    !isValidLocation(sourceLocation) ||
    !isValidLocation(targetLocation)
  ) {
    return null;
  }

  const [lng1, lat1] = sourceLocation.coordinates;
  const [lng2, lat2] = targetLocation.coordinates;

  const toRadians = (degrees) =>
    (degrees * Math.PI) / 180;

  const earthRadiusKm = 6371.0088;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  const distance =
    2 *
    earthRadiusKm *
    Math.asin(Math.sqrt(Math.min(1, a)));

  return Math.round(distance * 10) / 10;
};

const buildPagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);

  return {
    currentPage: page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    previousPage: page > 1 ? page - 1 : null,
  };
};

// Never expose another user's exact coordinates.
const sanitizeProfile = (profile) => {
  const {
    userId,
    location,
    locationUpdatedAt,
    distanceMeters,
    ...safeProfile
  } = profile;

  return safeProfile;
};

// ==========================================
// GET DISCOVERY PROFILES SERVICE
// ==========================================

export const getDiscoveryProfilesService = async ({
  userId,
  page = 1,
  limit = 20,
  mode = "all",
  radiusKm = 30,
}) => {
  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new ApiError(400, "Invalid user id");
  }

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1 ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1
  ) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  page = parsedPage;
  limit = Math.min(parsedLimit, 50);

  if (!["all", "nearby"].includes(mode)) {
    throw new ApiError(400, "Invalid discovery mode");
  }

  const radius = Number(radiusKm);

  if (
    mode === "nearby" &&
    (
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 200
    )
  ) {
    throw new ApiError(
      400,
      "Radius must be between 0 and 200 km"
    );
  }

  const skip = (page - 1) * limit;

  const loggedInUserId =
    new mongoose.Types.ObjectId(userId);

  // Get logged-in user's location.
  const myProfile = await profileModel
    .findOne({ userId: loggedInUserId })
    .select("location")
    .lean();

  const hasLocation = isValidLocation(
    myProfile?.location
  );

  // ========================================
  // MODE 1: NEARBY DISCOVERY
  // ========================================

  if (mode === "nearby") {
    if (!hasLocation) {
      return {
        data: [],
        pagination: buildPagination(
          page,
          limit,
          0
        ),
        locationRequired: true,
      };
    }

    const [longitude, latitude] =
      myProfile.location.coordinates;

    // Resolve the actual User collection name
    // from the registered Mongoose model.
    const userCollection = mongoose
      .model("User")
      .collection.name;

    const [result] = await profileModel.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          key: "location",
          distanceField: "distanceMeters",
          maxDistance: radius * 1000,
          spherical: true,
        },
      },

      {
        $match: {
          userId: {
            $ne: loggedInUserId,
          },
        },
      },

      {
        $lookup: {
          from: userCollection,
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },

      {
        $unwind: "$user",
      },

      {
        $facet: {
          metadata: [
            {
              $count: "total",
            },
          ],

          profiles: [
            {
              $sort: {
                distanceMeters: 1,
                _id: 1,
              },
            },

            {
              $skip: skip,
            },

            {
              $limit: limit,
            },

            {
              $project: {
                "user._id": 1,
                "user.name": 1,
                "user.email": 1,
                "user.phone": 1,
                "user.isBlocked": 1,

                profile: {
                  $mergeObjects: [
                    "$$ROOT",
                    {
                      distanceKm: {
                        $round: [
                          {
                            $divide: [
                              "$distanceMeters",
                              1000,
                            ],
                          },
                          1,
                        ],
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    ]);

    const total =
      result?.metadata?.[0]?.total || 0;

    const data = (result?.profiles || []).map(
      (item) => {
        const distanceKm =
          item.profile.distanceKm;

        return {
          user: item.user,
          profile: sanitizeProfile(
            item.profile
          ),
          distanceKm,
        };
      }
    );

    return {
      data,
      pagination: buildPagination(
        page,
        limit,
        total
      ),
      locationRequired: false,
    };
  }

  // ========================================
  // MODE 2: ALL DISCOVERY PROFILES
  // ========================================

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
    .map((profile) => {
      const distanceKm = hasLocation
        ? calculateDistanceKm(
            myProfile.location,
            profile.location
          )
        : null;

      return {
        user: profile.userId,

        profile: sanitizeProfile(profile),

        distanceKm,
      };
    });

  return {
    data,
    pagination: buildPagination(
      page,
      limit,
      total
    ),
    locationRequired: !hasLocation,
  };
};
