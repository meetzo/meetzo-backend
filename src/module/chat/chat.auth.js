import jwt from "jsonwebtoken";
import UserModel from "../../models/userModel.js";
import ApiError from "../../utils/api.error.js";

/*
 * Protect Chat REST APIs
 *
 * This middleware:
 * 1. Gets JWT from Authorization header
 * 2. Verifies the token
 * 3. Checks that it is a normal login token
 * 4. Checks that token user matches logged-in user
 */
export const requireChatAuth = (req, res, next) => {
  try {
    // Get token from:
    // Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication token required");
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Only normal login tokens can access chat
    // OTP / temporary tokens should not be allowed.
    if (payload.purpose !== "AUTH") {
      throw new ApiError(
        401,
        "A verified login is required for chat"
      );
    }

    // Make sure the token belongs to the logged-in user
    if (
      !req.user?._id ||
      String(payload.id) !== String(req.user._id)
    ) {
      throw new ApiError(
        401,
        "Invalid user authentication"
      );
    }

    next();

  } catch (error) {
    next(
      error instanceof ApiError
        ? error
        : new ApiError(
            401,
            "Invalid or expired token"
          )
    );
  }
};

/*
 * Protect Socket.IO Chat
 *
 * Socket.IO does not use req/res like Express.
 * The JWT comes from the socket handshake.
 *
 * Example from frontend:
 *
 * io("http://localhost:5000", {
 *   auth: {
 *     token: JWT_TOKEN
 *   }
 * });
 */
export const assertChatSocketAuth = async (socket) => {
  try {
    // Get token from Socket.IO handshake
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(
        "Bearer ",
        ""
      );

    if (!token) {
      throw new ApiError(
        401,
        "Authentication token required"
      );
    }

    // Verify JWT
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Only normal login tokens are allowed
    if (payload.purpose !== "AUTH") {
      throw new ApiError(
        401,
        "A verified login is required for chat"
      );
    }

    // Check that socket belongs to this user
    if (
      !socket.userId ||
      String(payload.id) !== String(socket.userId)
    ) {
      throw new ApiError(
        401,
        "Invalid user authentication"
      );
    }

    // Check that user still exists and is not blocked
    const user = await UserModel
      .findById(socket.userId)
      .select("_id isBlocked");

    if (!user) {
      throw new ApiError(
        403,
        "User account not found"
      );
    }

    if (user.isBlocked) {
      throw new ApiError(
        403,
        "Chat account is unavailable"
      );
    }

    // Everything is valid
    return true;

  } catch (error) {
    throw (
      error instanceof ApiError
        ? error
        : new ApiError(
            401,
            "Invalid or expired token"
          )
    );
  }
};
