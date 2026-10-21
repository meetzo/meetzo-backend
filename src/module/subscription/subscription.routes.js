import express from "express";

import { isAuthenticated } from "../../middleware/auth.middleware.js";

import {
  getMySubscriptionController,
  createSubscriptionController,
} from "./subscription.controller.js";

const router = express.Router();

router.post("/create", isAuthenticated, createSubscriptionController);

router.get("/me", isAuthenticated, getMySubscriptionController);

export default router;
