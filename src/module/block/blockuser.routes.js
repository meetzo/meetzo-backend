import express from "express";
import { isadmin } from "../reports/report.auth.js";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import{
    blockUserController,
    getBlockedUsersController,
    unblockUserController,
    restrictUserController
} from "./blockuser.controller.js";

const router = express.Router();

//block user
router.post("/:blockedId", isAuthenticated, blockUserController);

//get blocked users
router.get("/", isAuthenticated, isadmin, getBlockedUsersController);

//unblock user
router.patch("/:blockedId", isAuthenticated, unblockUserController); 

//restrict a user from the entire application
router.patch("/restrict/:userId", isAuthenticated, isadmin, restrictUserController);

export default router;