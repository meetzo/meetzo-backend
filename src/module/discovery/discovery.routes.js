import express from "express";
import {getDiscoveryProfilesController} from "./discovery.controller.js";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
const router = express.Router();


router.get(
  "/profiles",
  isAuthenticated,
  getDiscoveryProfilesController
);
export default router;