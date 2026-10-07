import mongoose from "mongoose";
import {
  getParticipantChatService, sendTextMessageService,
  markChatAsReadService, markChatAsDeliveredService,
} from "./chat.service.js";
import { assertChatSocketAuth } from "./chat.auth.js";
import { emitChatEvent, emitNewMessage } from "./chat.events.js";

// Incoming socket events use the same services as REST. Callbacks acknowledge
// requests; outgoing events are sent to each user's personal room separately.
export const registerChatSocket = (io, socket) => {
  // One timer per joined chat on this socket. Expire typing indicators even
  // if the client forgets to send typing:stop or disconnects unexpectedly.
  const typingTimers = new Map();
  const room = (chatId) => `chat:${chatId}`;
  const acknowledgeError = (callback, error) => typeof callback === "function" && callback({
    success: false, message: error.message, statusCode: error.statusCode || 500,
  });

  const stopTyping = (chatId) => {
    const timer = typingTimers.get(chatId);
    if (!timer) return;
    clearTimeout(timer);
    typingTimers.delete(chatId);
    socket.to(room(chatId)).emit("typing:stop", { chatId, userId: socket.userId });
  };

  // Joining a room is only for typing/open-chat presence; private message
  // notifications go to verified users' personal rooms even when not joined.
  socket.on("chat:join", async (data = {}, callback) => {
    try {
      await assertChatSocketAuth(socket);
      const { chatId } = data || {};
      await getParticipantChatService({ chatId, userId: socket.userId });
      await socket.join(room(chatId));
      typeof callback === "function" && callback({ success: true, message: "Chat joined successfully" });
    } catch (error) { acknowledgeError(callback, error); }
  });

  socket.on("chat:leave", (data = {}, callback) => {
    const { chatId } = data || {};
    if (!mongoose.Types.ObjectId.isValid(chatId) || !socket.rooms.has(room(chatId))) {
      return typeof callback === "function" && callback({ success: false, message: "Join the chat first" });
    }
    stopTyping(chatId);
    socket.leave(room(chatId));
    typeof callback === "function" && callback({ success: true });
  });

  // Same validated, idempotent text send path as REST. The callback confirms
  // the result; emitNewMessage synchronizes the recipient and other devices.
  socket.on("message:send", async (data = {}, callback) => {
    try {
      await assertChatSocketAuth(socket);
      if (data?.media != null || (data?.messageType && data.messageType !== "TEXT")) {
        throw Object.assign(new Error("Only text messages are supported"), { statusCode: 400 });
      }
      const result = await sendTextMessageService({
        chatId: data?.chatId, senderId: socket.userId,
        clientMessageId: data?.clientMessageId, message: data?.message,
      });
      if (result.created) emitNewMessage(result.message);
      typeof callback === "function" && callback({ success: true, message: result.created ? "Message sent successfully" : "Message already sent",
        data: result.message, created: result.created });
    } catch (error) { acknowledgeError(callback, error); }
  });

  socket.on("message:delivered", async (data = {}, callback) => {
    try {
      await assertChatSocketAuth(socket);
      const result = await markChatAsDeliveredService({ chatId: data?.chatId, userId: socket.userId });
      if (result.modifiedMessages) emitChatEvent("message:delivered", result, [result.userId, result.senderId]);
      typeof callback === "function" && callback({ success: true, data: result });
    } catch (error) { acknowledgeError(callback, error); }
  });

  socket.on("chat:read", async (data = {}, callback) => {
    try {
      await assertChatSocketAuth(socket);
      const result = await markChatAsReadService({ chatId: data?.chatId, userId: socket.userId });
      if (result.modifiedMessages) emitChatEvent("message:read", result, [result.userId, result.senderId]);
      typeof callback === "function" && callback({ success: true, data: result });
    } catch (error) { acknowledgeError(callback, error); }
  });

  // Typing requires both room membership and a still-active match. It is
  // ephemeral: no typing state is written to MongoDB.
  const typing = async (data, callback, start) => {
    try {
      await assertChatSocketAuth(socket);
      const { chatId } = data || {};
      if (!mongoose.Types.ObjectId.isValid(chatId) || !socket.rooms.has(room(chatId))) {
        throw Object.assign(new Error("Join the chat before sending typing status"), { statusCode: 403 });
      }
      await getParticipantChatService({ chatId, userId: socket.userId, requireMatch: true });
      if (!start) stopTyping(chatId);
      else {
        const existing = typingTimers.get(chatId);
        if (existing) clearTimeout(existing);
        else socket.to(room(chatId)).emit("typing:start", { chatId, userId: socket.userId });
        typingTimers.set(chatId, setTimeout(() => stopTyping(chatId), 5000));
      }
      typeof callback === "function" && callback({ success: true });
    } catch (error) { acknowledgeError(callback, error); }
  };
  socket.on("typing:start", (data, callback) => typing(data, callback, true));
  socket.on("typing:stop", (data, callback) => typing(data, callback, false));

  socket.on("disconnecting", () => {
    for (const chatId of typingTimers.keys()) stopTyping(chatId);
  });
};
