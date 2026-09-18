import { Server } from "socket.io";

import { socketAuth } from "./socketAuth.js";
import { registerChatSocket } from "../module/chat/chat.socket.js";

let io;

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

    // Chat related socket listeners
    registerChatSocket(io, socket);

    socket.on("disconnect", (reason) => {
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