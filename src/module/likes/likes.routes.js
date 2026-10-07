import express from "express";

import {
  likeUserController,
  unlikeUserController,
  getSentLikesController,
  getReceivedLikesController,
  getLikeStatusController,
  getReceivedLikesCountController,
  getSentLikesCountController,
  getLikedProfilesController
} from "./likes.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * All like routes require authentication
 */
router.use(isAuthenticated);


/**
 * LIKE USER
 *
 * Example:
 * POST /api/like/USER_ID
 */
router.post("/:userId", likeUserController);

/**
 * GET RECEIVED LIKES COUNT
 */
router.get("/received/count", getReceivedLikesCountController);

/**
 * GET SENT LIKES COUNT
 */
router.get("/sent/like", getSentLikesCountController);

/**
 * GET RECEIVED LIKES
 *
 * Example:
 * GET /api/likes/received?page=1&limit=20
 */
router.get("/received", getReceivedLikesController);

/**
 * GET SENT LIKES
 *
 * Example:
 * GET /api/likes/sent?page=1&limit=20
 */
router.get("/sent", getSentLikesController);

/**
 * CHECK LIKE STATUS
 *
 * Example:
 * GET /api/likes/status/USER_ID
 */
router.get("/status/:userId", getLikeStatusController);


/**
 * UNLIKE USER
 *
 * Example:
 * DELETE /api/likes/USER_ID
 */
router.delete("/cancel/:userId", unlikeUserController);


router.get("/getLikedUsers",getLikedProfilesController);

export default router;