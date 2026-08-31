import mongoose from "mongoose";

import exclusiveApplicationModel from
  "../../models/exclusiveApplicationModel.js";

import {
  uploadExclusiveDocument,
  deleteExclusiveDocument,
} from "./exclusiveApplication.upload.js";

import ApiError from "../../utils/api.error.js";

const allowedCategories = [
  "PUBLIC_OFFICIAL",
  "BUSINESS_EXECUTIVE",
  "ENTREPRENEUR",
  "CELEBRITY",
  "ATHLETE",
  "CREATOR",
];

const allowedApplicationStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const allowedAdminStatuses = [
  "APPROVED",
  "REJECTED",
];

const parseSocialProfiles = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);

      if (Array.isArray(parsedValue)) {
        return parsedValue
          .map((item) =>
            String(item).trim(),
          )
          .filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  throw new ApiError(
    400,
    "Social profiles must be an array",
  );
};

const escapeRegex = (value) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

// ------------------------------------------
// USER: Submit application
// ------------------------------------------

export const createExclusiveApplicationService =
  async ({
    userId,
    body,
    file,
  }) => {
    if (!userId) {
      throw new ApiError(
        401,
        "Authentication required",
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw new ApiError(
        401,
        "Invalid authenticated user",
      );
    }

    if (!file) {
      throw new ApiError(
        400,
        "Verification document is required",
      );
    }

    const eligibilityCategory = String(
      body.eligibilityCategory || "",
    )
      .trim()
      .toUpperCase();

    if (
      !allowedCategories.includes(
        eligibilityCategory,
      )
    ) {
      throw new ApiError(
        400,
        "Invalid eligibility category",
      );
    }

    const existingApplication =
      await exclusiveApplicationModel.findOne({
        userId,
      });

    if (existingApplication) {
      throw new ApiError(
        409,
        "You have already submitted an exclusive application",
      );
    }

    const socialProfiles =
      parseSocialProfiles(
        body.socialProfiles,
      );

    if (socialProfiles.length > 5) {
      throw new ApiError(
        400,
        "Maximum 5 social profiles are allowed",
      );
    }

    let uploadedDocument = null;

    try {
      uploadedDocument =
        await uploadExclusiveDocument(file);

      const application =
        await exclusiveApplicationModel.create({
          userId,
          eligibilityCategory,

          fullName:
            body.fullName?.trim(),

          mobileNumber:
            body.mobileNumber?.trim(),

          profession:
            body.profession?.trim(),

          organization:
            body.organization?.trim() || null,

          location:
            body.location?.trim(),

          socialProfiles,

          verificationDocument:
            uploadedDocument,

          status: "PENDING",
        });

      return application;
    } catch (error) {
      if (uploadedDocument?.fileId) {
        await deleteExclusiveDocument(
          uploadedDocument.fileId,
        );
      }

      if (error?.code === 11000) {
        throw new ApiError(
          409,
          "You have already submitted an exclusive application",
        );
      }

      throw error;
    }
  };

// ------------------------------------------
// USER: Get own application
// ------------------------------------------

export const getMyExclusiveApplicationService =
  async (userId) => {
    if (!userId) {
      throw new ApiError(
        401,
        "Authentication required",
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw new ApiError(
        401,
        "Invalid authenticated user",
      );
    }

    return exclusiveApplicationModel
      .findOne({ userId })
      .populate(
        "reviewedBy",
        "name email type role",
      )
      .lean();
  };

// ------------------------------------------
// ADMIN: Get all applications
// ------------------------------------------

export const getAllExclusiveApplicationsService =
  async ({
    page = 1,
    limit = 10,
    status,
    search,
  }) => {
    const currentPage = Math.max(
      Number(page) || 1,
      1,
    );

    const pageLimit = Math.min(
      Math.max(Number(limit) || 10, 1),
      100,
    );

    const filter = {};

    if (status) {
      const normalizedStatus = String(
        status,
      )
        .trim()
        .toUpperCase();

      if (normalizedStatus !== "ALL") {
        if (
          !allowedApplicationStatuses.includes(
            normalizedStatus,
          )
        ) {
          throw new ApiError(
            400,
            "Invalid application status",
          );
        }

        filter.status = normalizedStatus;
      }
    }

    if (search?.trim()) {
      const safeSearch = escapeRegex(
        search.trim(),
      );

      const searchRegex = new RegExp(
        safeSearch,
        "i",
      );

      filter.$or = [
        { fullName: searchRegex },
        { mobileNumber: searchRegex },
        { profession: searchRegex },
        { organization: searchRegex },
        { location: searchRegex },
      ];
    }

    const skip =
      (currentPage - 1) * pageLimit;

    const [
      applications,
      totalApplications,
    ] = await Promise.all([
      exclusiveApplicationModel
        .find(filter)
        .populate(
          "userId",
          "name email phone profileImage",
        )
        .populate(
          "reviewedBy",
          "name email type role",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),

      exclusiveApplicationModel
        .countDocuments(filter),
    ]);

    return {
      applications,

      pagination: {
        currentPage,
        limit: pageLimit,
        totalApplications,

        totalPages: Math.ceil(
          totalApplications / pageLimit,
        ),
      },
    };
  };

// ------------------------------------------
// ADMIN: Approve or reject
// ------------------------------------------

export const updateExclusiveApplicationStatusService =
  async ({
    applicationId,
    adminId,
    status,
    remark,
  }) => {
    if (
      !mongoose.Types.ObjectId.isValid(
        applicationId,
      )
    ) {
      throw new ApiError(
        400,
        "Invalid application ID",
      );
    }

    if (
      !adminId ||
      !mongoose.Types.ObjectId.isValid(adminId)
    ) {
      throw new ApiError(
        401,
        "Valid admin authentication is required",
      );
    }

    const normalizedStatus = String(
      status || "",
    )
      .trim()
      .toUpperCase();

    if (
      !allowedAdminStatuses.includes(
        normalizedStatus,
      )
    ) {
      throw new ApiError(
        400,
        "Status must be APPROVED or REJECTED",
      );
    }

    const cleanRemark =
      typeof remark === "string"
        ? remark.trim()
        : "";

    if (
      normalizedStatus === "REJECTED" &&
      !cleanRemark
    ) {
      throw new ApiError(
        400,
        "Remark is required when rejecting an application",
      );
    }

    if (cleanRemark.length > 500) {
      throw new ApiError(
        400,
        "Remark cannot exceed 500 characters",
      );
    }

    const existingApplication =
      await exclusiveApplicationModel.findById(
        applicationId,
      );

    if (!existingApplication) {
      throw new ApiError(
        404,
        "Exclusive application not found",
      );
    }

    if (
      existingApplication.status ===
      normalizedStatus
    ) {
      throw new ApiError(
        409,
        `Application is already ${normalizedStatus.toLowerCase()}`,
      );
    }

    const reviewedAt = new Date();

    const updatedApplication =
      await exclusiveApplicationModel
        .findByIdAndUpdate(
          applicationId,
          {
            $set: {
              status: normalizedStatus,

              adminRemark:
                cleanRemark || null,

              reviewedBy: adminId,

              reviewedAt,
            },

            $push: {
              statusHistory: {
                status: normalizedStatus,

                changedBy: adminId,

                remark:
                  cleanRemark || null,

                changedAt: reviewedAt,
              },
            },
          },
          {
            returnDocument: "after", 
            runValidators: true,
          },
        )
        .populate(
          "userId",
          "name email phone profileImage",
        )
        .populate(
          "reviewedBy",
          "name email type role",
        )
        .lean();

    if (!updatedApplication) {
      throw new ApiError(
        500,
        "Failed to update application status",
      );
    }

    return updatedApplication;
  };


  export const resubmitExclusiveApplicationService =
  async ({
    userId,
    body,
    file,
  }) => {
    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      throw new ApiError(
        401,
        "Valid user authentication is required",
      );
    }

    const application =
      await exclusiveApplicationModel.findOne({
        userId,
      });

    if (!application) {
      throw new ApiError(
        404,
        "Exclusive application not found",
      );
    }

    if (application.status !== "REJECTED") {
      throw new ApiError(
        400,
        "Only rejected applications can be resubmitted",
      );
    }

    // Update eligibility category
    if (body.eligibilityCategory !== undefined) {
      const eligibilityCategory = String(
        body.eligibilityCategory,
      )
        .trim()
        .toUpperCase();

      if (
        !allowedCategories.includes(
          eligibilityCategory,
        )
      ) {
        throw new ApiError(
          400,
          "Invalid eligibility category",
        );
      }

      application.eligibilityCategory =
        eligibilityCategory;
    }

    // Update required text fields
    const textFields = [
      "fullName",
      "mobileNumber",
      "profession",
      "location",
    ];

    for (const field of textFields) {
      if (body[field] !== undefined) {
        const cleanValue = String(
          body[field],
        ).trim();

        if (!cleanValue) {
          throw new ApiError(
            400,
            `${field} cannot be empty`,
          );
        }

        application[field] = cleanValue;
      }
    }

    // Organization can be optional
    if (body.organization !== undefined) {
      application.organization =
        String(body.organization).trim() ||
        null;
    }

    // Update social profiles
    if (body.socialProfiles !== undefined) {
      const socialProfiles =
        parseSocialProfiles(
          body.socialProfiles,
        );

      if (socialProfiles.length > 5) {
        throw new ApiError(
          400,
          "Maximum 5 social profiles are allowed",
        );
      }

      application.socialProfiles =
        socialProfiles;
    }

    const oldDocumentFileId =
      application.verificationDocument?.fileId;

    let newUploadedDocument = null;

    try {
      // File optional hai; user old document bhi retain kar sakta hai
      if (file) {
        newUploadedDocument =
          await uploadExclusiveDocument(file);

        application.verificationDocument =
          newUploadedDocument;
      }

      application.status = "PENDING";
      application.adminRemark = null;
      application.reviewedBy = null;
      application.reviewedAt = null;

      application.statusHistory.push({
        status: "PENDING",
        changedBy: userId,
        remark:
          "Application corrected and resubmitted by user",
        changedAt: new Date(),
      });

      await application.save();

      // New document save hone ke baad old document delete karo
      if (
        newUploadedDocument &&
        oldDocumentFileId &&
        oldDocumentFileId !==
          newUploadedDocument.fileId
      ) {
        await deleteExclusiveDocument(
          oldDocumentFileId,
        );
      }

      return exclusiveApplicationModel
        .findById(application._id)
        .populate(
          "userId",
          "name email phone profileImage",
        )
        .populate(
          "reviewedBy",
          "name email type role",
        )
        .lean();
    } catch (error) {
      // Database save fail ho toh newly uploaded file delete
      if (newUploadedDocument?.fileId) {
        await deleteExclusiveDocument(
          newUploadedDocument.fileId,
        );
      }

      throw error;
    }
  };