import express from "express";

import {isAuthenticated} from "../../middleware/auth.middleware.js";


import {
  generateDigilockerToken,
  fetchDigilockerDetails,
  digilockerCallback,
} from "./ids.controller.js";

const router = express.Router();


// =====================================
// GENERATE DIGILOCKER TOKEN
// =====================================

router.post(
  "/generate-digilocker-token",
  isAuthenticated,
  generateDigilockerToken
);


// =====================================
// FETCH VERIFIED DETAILS
// =====================================

router.post(
  "/fetch-details",
  isAuthenticated,
  fetchDigilockerDetails
);


// =====================================
// DIGILOCKER CALLBACK
// =====================================

router.get(
  "/digilocker-callback",
  digilockerCallback
);


export default router;