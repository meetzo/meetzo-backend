import express from "express";
import {
  getMatchesController,
  getMatchStatusController,
  getMatchCountController,
  getMatchUserDetailsController
} from "./matches.controller.js";

import { isAuthenticated } from "../../middleware/auth.middleware.js"
const router = express.Router();


router.get("/", isAuthenticated, getMatchesController);
router.get("/count", isAuthenticated, getMatchCountController);
router.get("/:userId/status", isAuthenticated, getMatchStatusController);
router.get("/get_match_details", isAuthenticated, getMatchUserDetailsController);


export default router;
