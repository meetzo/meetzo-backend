import jwt from "jsonwebtoken";
import connectDB from "../config/db.js";
import ApiError from "../utils/api.error.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new ApiError(401, "Please login to access this resource");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isBlocked: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    if (user.isBlocked) {
      throw new ApiError(403, "Your account is blocked");
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

// Admin only middleware
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Please login first"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You are not allowed to access this resource")
      );
    }

    next();
  };
};