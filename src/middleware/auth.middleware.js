import jwt from "jsonwebtoken";
import ApiError from "../utils/api.error.js";
import userModel from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    let token;

    // ---------------------------------------
    // GET TOKEN FROM HEADER
    // ---------------------------------------

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new ApiError(
        401,
        "Please login to access this resource"
      );
    }

    // ---------------------------------------
    // VERIFY TOKEN
    // ---------------------------------------

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      throw new ApiError(
        401,
        "Invalid or expired token"
      );
    }

    // ---------------------------------------
    // GET USER
    // ---------------------------------------

    const user = await userModel
      .findById(decoded.id)
      .select(
        "name email phone role isVerified isBlocked createdAt"
      );

    if (!user) {
      throw new ApiError(
        401,
        "User not found"
      );
    }

    // ---------------------------------------
    // BLOCK CHECK
    // ---------------------------------------

    if (user.isBlocked) {
      throw new ApiError(
        403,
        "Your account is blocked"
      );
    }

    // ---------------------------------------
    // ATTACH USER TO REQUEST
    // ---------------------------------------

    req.user = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt,
    };

    next();
  } catch (error) {
    next(error);
  }
};



export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError(
          401,
          "Please login first"
        )
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          "You are not allowed to access this resource"
        )
      );
    }

    next();
  };
};