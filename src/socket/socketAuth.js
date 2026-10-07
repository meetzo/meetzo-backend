import jwt from "jsonwebtoken";
import UserModel from "../models/userModel.js";

export const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(
        new Error("Authentication token required")
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded?.purpose !== "AUTH" || !decoded?.userId) {
      return next(new Error("A verified login is required"));
    }

    // Validate before the socket joins a personal room or receives presence.
    const user = await UserModel.findById(decoded.userId).select("_id isBlocked");
    if (!user || user.isBlocked) {
      return next(new Error("Account is unavailable"));
    }

    socket.userId = user._id.toString();

    // The handshake is one-time; remove access to personal rooms at JWT expiry
    // so an idle socket cannot keep receiving private messages indefinitely.
    if (decoded.exp) {
      const expiryTimer = setTimeout(() => socket.disconnect(true), decoded.exp * 1000 - Date.now());
      expiryTimer.unref?.();
      socket.on("disconnect", () => clearTimeout(expiryTimer));
    }

    next();
  } catch (error) {
    console.error(
      "Socket authentication error:",
      error.message
    );

    return next(
      new Error(
        "Unable to authenticate user, please login again."
      )
    );
  }
};