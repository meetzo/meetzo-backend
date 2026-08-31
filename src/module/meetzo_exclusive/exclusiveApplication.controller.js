import asyncHandler from "../../utils/asyncHandler.js";

import {
  createExclusiveApplicationService,
  getMyExclusiveApplicationService,
  getAllExclusiveApplicationsService,
  updateExclusiveApplicationStatusService,
  resubmitExclusiveApplicationService,
} from "./exclusiveApplication.service.js";

const getLoggedInUserId = (req) => {
  if (typeof req.user === "string") {
    return req.user;
  }

  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.userId ||
    req.adminId ||
    null
  );
};

// USER: Submit exclusive application
export const createExclusiveApplication =
  asyncHandler(async (req, res) => {
    const application =
      await createExclusiveApplicationService({
        userId: getLoggedInUserId(req),
        body: req.body || {},
        file: req.file,
      });

    return res.status(201).json({
      success: true,
      message:
        "Exclusive application submitted successfully",
      data: application,
    });
  });

// USER: Get own application
export const getMyExclusiveApplication =
  asyncHandler(async (req, res) => {
    const application =
      await getMyExclusiveApplicationService(
        getLoggedInUserId(req),
      );

    return res.status(200).json({
      success: true,
      message: application
        ? "Application fetched successfully"
        : "No exclusive application found",
      data: application,
    });
  });

// ADMIN: Get all applications
export const getAllExclusiveApplications =
  asyncHandler(async (req, res) => {
    const {
      page,
      limit,
      status,
      search,
    } = req.query || {};

    const result =
      await getAllExclusiveApplicationsService({
        page,
        limit,
        status,
        search,
      });

    return res.status(200).json({
      success: true,
      message:
        "Exclusive applications fetched successfully",
      data: result.applications,
      pagination: result.pagination,
    });
  });

// ADMIN: Approve or reject application
export const updateExclusiveApplicationStatus =
  asyncHandler(async (req, res) => {
    const { status, remark } = req.body || {};

    const application =
      await updateExclusiveApplicationStatusService({
        applicationId:
          req.params.applicationId,

        adminId: getLoggedInUserId(req),

        status,
        remark,
      });

    return res.status(200).json({
      success: true,
      message: `Application ${application.status.toLowerCase()} successfully`,
      data: application,
    });
  });

  export const resubmitExclusiveApplication =
  asyncHandler(async (req, res) => {
    const application =
      await resubmitExclusiveApplicationService({
        userId: getLoggedInUserId(req),
        body: req.body || {},
        file: req.file,
      });

    return res.status(200).json({
      success: true,
      message:
        "Exclusive application resubmitted successfully",
      data: application,
    });
  });