import { getIO } from "../../socket/socket.js";
import { markChatAsReadService } from "./chat.service.js";

// Send private updates to every device signed in as each user.
export const emitChatEvent = (event, data, userIds) => {
  try {
    const io = getIO();
    const rooms = [...new Set(userIds.filter(Boolean).map((id) => `user:${id?._id ?? id}`))];
    if (!rooms.length) return;
    let target = io;
    for (const room of rooms) target = target.to(room);
    target.emit(event, data);
  } catch (error) {
    // A notification failure must not turn a committed database operation into
    // a client retry (and a duplicate mutation).
    console.error(`Chat ${event} notification failed:`, error);
  }
};

// Mark the chat read for this user and notify both sides. Never throws, so a
// read failure cannot break the request or send that triggered it.
export const autoMarkChatAsRead = async (chatId, userId) => {
  try {
    const result = await markChatAsReadService({ chatId, userId });
    if (result.modifiedMessages) emitChatEvent("message:read", result, [result.userId, result.senderId]);
    return result;
  } catch (error) {
    console.error("Auto mark-as-read failed:", error);
    return null;
  }
};

// True if any of the user's sockets has joined this chat's room (chat is open on screen).
const isViewingChat = (userId, chatId) => {
  try {
    const io = getIO();
    const socketIds = io.sockets.adapter.rooms.get(`chat:${chatId}`);
    if (!socketIds) return false;
    return [...socketIds].some((id) => String(io.sockets.sockets.get(id)?.userId) === String(userId));
  } catch {
    return false;
  }
};
// Tell both users about a new message, including the sender's other devices.
export const emitNewMessage = (message) => {
  const users = [message.senderId, message.receiverId];
  emitChatEvent("message:new", message, users);
  emitChatEvent("chat:update", message, users);
  // Receiver has the chat open: read it now so the unread badge never grows.
  if (isViewingChat(message.receiverId, message.chatId)) {
    autoMarkChatAsRead(message.chatId, message.receiverId);
  }
};