import express from "express";

import { isAuthenticated } from
  "../../middleware/auth.middleware.js";

import { authorizeAdmin } from
  "../../middleware/admin.middleware.js";

import {
  exclusiveDocumentUpload,
} from "./exclusiveApplication.upload.js";

import {
  createExclusiveApplication,
  getMyExclusiveApplication,
  getAllExclusiveApplications,
  updateExclusiveApplicationStatus,
  resubmitExclusiveApplication,
} from "./exclusiveApplication.controller.js";

const router = express.Router();

router.post(
  "/",
  isAuthenticated,
  exclusiveDocumentUpload.single(
    "verificationDocument",
  ),
  createExclusiveApplication,
);

router.get(
  "/me",
  isAuthenticated,
  getMyExclusiveApplication,
);

router.get(
  "/admin/all",
  isAuthenticated,
  authorizeAdmin,
  getAllExclusiveApplications,
);

router.patch(
  "/admin/status/:applicationId",
  isAuthenticated,
  authorizeAdmin,
  updateExclusiveApplicationStatus,
);

router.patch(
  "/me/resubmit",
  isAuthenticated,
  exclusiveDocumentUpload.single(
    "verificationDocument",
  ),
  resubmitExclusiveApplication,
);

export default router;