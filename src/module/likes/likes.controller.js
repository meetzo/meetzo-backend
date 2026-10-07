import {
  likeUserService,
  unlikeUserService,
  getSentLikesService,
  getReceivedLikesService,
  getLikeStatusService,
  getReceivedLikesCountService,
  getSentLikesCountService,
  getLikedProfilesService,
} from "./likes.service.js";

/**
 * LIKE USER
 */
export const likeUserController = async (req, res, next) => {
  try {
    const fromUserId = req.user._id;

    const { userId: toUserId } = req.params;

    const like = await likeUserService({
      fromUserId,
      toUserId,
    });

    return res.status(200).json({
      success: true,
      message: "User liked successfully",
      data: like,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * UNLIKE USER
 */
export const unlikeUserController = async (req, res, next) => {
  try {
    const fromUserId = req.user._id;

    const { userId: toUserId } = req.params;

    const like = await unlikeUserService({
      fromUserId,
      toUserId,
    });

    return res.status(200).json({
      success: true,
      message: "Like removed successfully",
      data: like,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET SENT LIKES
 */
export const getSentLikesController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { page = 1, limit = 20 } = req.query;

    const result = await getSentLikesService({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,

      message: "Sent likes fetched successfully",

      data: result.data,

      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET RECEIVED LIKES
 */
export const getReceivedLikesController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { page = 1, limit = 20 } = req.query;

    const result = await getReceivedLikesService({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,

      message: "Received likes fetched successfully",
      count: result.data.length,

      data: result.data,

      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CHECK LIKE STATUS
 */
export const getLikeStatusController = async (req, res, next) => {
  try {
    const fromUserId = req.user._id;

    const { userId: toUserId } = req.params;

    const result = await getLikeStatusService({
      fromUserId,
      toUserId,
    });

    return res.status(200).json({
      success: true,

      message: "Like status fetched successfully",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * RECEIVED LIKE COUNT
 */
export const getReceivedLikesCountController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await getReceivedLikesCountService({
      userId,
    });

    return res.status(200).json({
      success: true,

      message: "Received likes count fetched successfully",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SENT LIKE COUNT
 */
export const getSentLikesCountController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const result = await getSentLikesCountService({
      userId,
    });

    return res.status(200).json({
      success: true,

      message: "Sent likes count fetched successfully",

      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * -------------------------------------------------------
 * GET LIKED PROFILES
 * -------------------------------------------------------
 *
 * Returns all profiles liked by
 * currently logged-in user.
 */
export const getLikedProfilesController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { page = 1, limit = 20 } = req.query;

    const result = await getLikedProfilesService({
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,

      message: "Liked profiles fetched successfully",
      count: result.data.length,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};
