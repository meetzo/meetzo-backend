import { Server } from "socket.io";

import { socketAuth } from "./socketAuth.js";
import { registerChatSocket } from "../module/chat/chat.socket.js";
import { matchedUserIds } from "../module/chat/chat.presence.js";

let io;
// Count connections, not just users: disconnecting one of several devices
// should not make that user appear offline. This map is process-local.
const onlineSocketCounts = new Map();

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Socket authentication
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = socket.userId.toString();
    const socketCount = onlineSocketCounts.get(userId) || 0;

    onlineSocketCounts.set(userId, socketCount + 1);

    console.log("\n==============================");
    console.log("SOCKET CONNECTED");
    console.log("Socket ID:", socket.id);
    console.log("User ID:", socket.userId);
    console.log("==============================\n");

    /*
     * Personal user room
     *
     * Example:
     * user:68abcdef123
     */
    socket.join(`user:${socket.userId}`);

    // Only reveal presence to current mutual matches, never all user IDs.
    matchedUserIds(userId).then((matches) => {
      if (!socket.connected) return;
      socket.emit("presence:online-users", matches.filter((id) => onlineSocketCounts.has(id)));
      if (socketCount === 0) {
        for (const id of matches) {
          socket.to(`user:${id}`).emit("presence:online", { userId });
        }
      }
    }).catch((error) => console.error("Presence lookup failed:", error));

    // Recheck matches on every lookup so an unlike stops future presence
    // queries from revealing that user's status on this connection.
    socket.on("presence:check", async (payload = {}, callback) => {
      if (typeof callback !== "function") return;
      try {
        const matches = new Set(await matchedUserIds(userId));
        const userIds = Array.isArray(payload?.userIds)
          ? payload.userIds.slice(0, 100).map(String)
          : [];
        callback({
          success: true,
          statuses: Object.fromEntries(
            userIds.map((id) => [id, matches.has(id) && onlineSocketCounts.has(id)]),
          ),
        });
      } catch (error) {
        callback({ success: false, message: "Unable to check presence" });
      }
    });

    // Chat related socket listeners
    registerChatSocket(io, socket);

    socket.on("disconnect", (reason) => {
      const remainingSockets = (onlineSocketCounts.get(userId) || 1) - 1;

      if (remainingSockets <= 0) {
        onlineSocketCounts.delete(userId);
        matchedUserIds(userId).then((matches) => {
          for (const id of matches) {
            io.to(`user:${id}`).emit("presence:offline", { userId });
          }
        }).catch((error) => console.error("Presence lookup failed:", error));
      } else {
        onlineSocketCounts.set(userId, remainingSockets);
      }

      console.log("\n==============================");
      console.log("SOCKET DISCONNECTED");
      console.log("User ID:", socket.userId);
      console.log("Socket ID:", socket.id);
      console.log("Reason:", reason);
      console.log("==============================\n");
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized"
    );
  }

  return io;
};