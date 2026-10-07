import { getIO } from "../../socket/socket.js";

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

// Tell both users about a new message, including the sender's other devices.
export const emitNewMessage = (message) => {
  const users = [message.senderId, message.receiverId];
  emitChatEvent("message:new", message, users);
  emitChatEvent("chat:update", message, users);
};
