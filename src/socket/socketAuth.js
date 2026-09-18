import jwt from "jsonwebtoken";

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

    if (!decoded?.userId) {
      return next(
        new Error("Invalid authentication token")
      );
    }

    socket.userId = decoded.userId;

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