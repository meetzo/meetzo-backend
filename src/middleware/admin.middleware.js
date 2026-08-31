import userModel from "../models/userModel.js";
import ApiError from "../utils/api.error.js";
import asyncHandler from "../utils/asyncHandler.js";

export const authorizeAdmin = asyncHandler(
  async (req, res, next) => {
    let user = req.user;

    // If authenticate middleware only sets req.userId
    if (!user && req.userId) {
      user = await userModel
        .findById(req.userId)
        .select("_id type role");
    }

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    // Supports either type: "admin" or role: "ADMIN"
    const userRole = String(
      user.type || user.role || "",
    ).toUpperCase();

    if (userRole !== "ADMIN") {
      throw new ApiError(
        403,
        "Only admin can access this resource",
      );
    }

    req.user = user;
    next();
  },
);