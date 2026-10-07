// Chat business rules and database operations. Controllers and sockets share
// these services so permissions and message state stay consistent.
import mongoose from "mongoose";
import ChatModel from "../../models/chatModel.js";
import MessageModel from "../../models/messageModel.js";
import LikeModel from "../../models/like.Model.js";
import UserModel from "../../models/userModel.js";

const validId = (value) => mongoose.Types.ObjectId.isValid(value);
// Normalize IDs before comparing them or building a pair key: uppercase and
// lowercase hex strings must identify the same users and conversation.
const idString = (value) => {
  const id = value?._id ?? value;
  return validId(id) ? new mongoose.Types.ObjectId(id).toString() : String(id);
};
const pairKeyFor = (a, b) => [idString(a), idString(b)].sort().join("_");
const stateFor = (chat, userId) =>
  chat.participantStates?.find((state) => idString(state.userId) === idString(userId));
const otherId = (chat, userId) =>
  chat.participants.find((id) => idString(id) !== idString(userId));
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const windowMs = 15 * 60 * 1000;

const paging = (page, limit, defaultLimit) => {
  const p = Number(page);
  const l = Number(limit);
  if ((page !== undefined && (!Number.isInteger(p) || p < 1)) ||
      (limit !== undefined && (!Number.isInteger(l) || l < 1))) {
    throw fail("page and limit must be positive integers", 400);
  }
  return { page: p || 1, limit: Math.min(l || defaultLimit, 100) };
};

const pagination = (page, limit, total) => ({
  page, limit, total, totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total, hasPreviousPage: page > 1,
});

// A chat can be created or sent to only while both directional likes are active.
// Old conversations remain readable after an unlike, but new sends are blocked.
export const assertMatchService = async (userId, targetUserId) => {
  const [first, second] = await Promise.all([
    LikeModel.exists({ fromUserId: userId, toUserId: targetUserId, status: "ACTIVE" }),
    LikeModel.exists({ fromUserId: targetUserId, toUserId: userId, status: "ACTIVE" }),
  ]);
  if (!first || !second) throw fail("You can only chat with a matched user", 403);
};

// Always check membership before exposing a chat. Require the current match
// only for actions that start or continue a conversation, not reading history.
export const getParticipantChatService = async ({ chatId, userId, requireMatch = false, session }) => {
  if (!validId(chatId)) throw fail("Invalid chat ID", 400);
  const chat = await ChatModel.findById(chatId, null, { session });
  if (!chat) throw fail("Chat not found", 404);
  if (!chat.participants.some((id) => idString(id) === idString(userId))) {
    throw fail("You are not a participant of this chat", 403);
  }
  if (requireMatch) {
    const targetId = otherId(chat, userId);
    const target = await UserModel.findById(targetId).select("_id isBlocked");
    if (!target || target.isBlocked) throw fail("Chat is unavailable", 403);
    await assertMatchService(userId, targetId);
  }
  return chat;
};

// Kept for the existing multipart endpoint; media handling is otherwise out of scope.
export const assertChatParticipantService = async ({ chatId, userId }) => {
  await getParticipantChatService({ chatId, userId, requireMatch: true });
};

// Deleting one message hides it only for that user. Clearing a chat stores a
// permanent timestamp cutoff; reopening does not reveal older messages.
const visibleMessages = (chat, userId) => {
  const filter = { chatId: chat._id, deletedFor: { $ne: userId } };
  const deletedAt = stateFor(chat, userId)?.deletedAt;
  if (deletedAt) filter.createdAt = { $gt: deletedAt };
  return filter;
};

// Return only public participant fields and the caller's own chat state.
// The last-message preview must obey that caller's deletion rules too.
const publicChat = async (chat, userId) => {
  await chat.populate({ path: "participants", select: "_id name profileImage" });
  const state = stateFor(chat, userId);
  const lastMessage = await MessageModel.findOne(visibleMessages(chat, userId))
    .sort({ createdAt: -1, _id: -1 }).lean();
  return {
    _id: chat._id,
    participants: chat.participants,
    otherParticipant: chat.participants.find((p) => idString(p) !== idString(userId)),
    unreadCount: state?.unreadCount || 0,
    isArchived: state?.isArchived || false,
    lastReadMessageId: state?.lastReadMessageId || null,
    lastReadAt: state?.lastReadAt || null,
    lastMessage,
    lastMessageAt: lastMessage?.createdAt || null,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
};

export const accessChatService = async ({ userId, targetUserId }) => {
  if (!validId(userId) || !validId(targetUserId)) throw fail("Invalid user ID", 400);
  if (idString(userId) === idString(targetUserId)) throw fail("You cannot chat with yourself", 400);
  const [user, target] = await Promise.all([
    UserModel.findById(userId).select("_id isBlocked"),
    UserModel.findById(targetUserId).select("_id isBlocked"),
  ]);
  if (!user || !target) throw fail("User not found", 404);
  if (user.isBlocked || target.isBlocked) throw fail("Chat is unavailable", 403);
  await assertMatchService(userId, targetUserId);
  const pairKey = pairKeyFor(userId, targetUserId);
  let chat = await ChatModel.findOne({ pairKey });
  // The unique pairKey prevents duplicate chats; if two requests race to
  // create one, load the winner instead of returning a duplicate-key error.
  if (!chat) {
    try {
      chat = await ChatModel.create({
        pairKey, participants: [userId, targetUserId],
        participantStates: [{ userId }, { userId: targetUserId }],
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      chat = await ChatModel.findOne({ pairKey });
      if (!chat) throw error;
    }
  }
  // Reopening never removes the personal clear-history cutoff or alters the other user.
  await ChatModel.updateOne(
    { _id: chat._id, "participantStates.userId": userId },
    { $set: { "participantStates.$.isDeleted": false } },
  );
  chat = await ChatModel.findById(chat._id);
  return publicChat(chat, userId);
};

// Filter hidden/archived chats in MongoDB before pagination so page lengths
// and totals describe the chats the caller can actually see.
export const getUserChatsService = async ({ userId, page, limit, archived = false }) => {
  const pagingResult = paging(page, limit, 20);
  const query = {
    participants: userId,
    participantStates: { $elemMatch: { userId, isDeleted: false, isArchived: archived } },
  };
  const [chats, total] = await Promise.all([
    ChatModel.find(query).sort({ lastMessageAt: -1, _id: -1 })
      .skip((pagingResult.page - 1) * pagingResult.limit).limit(pagingResult.limit),
    ChatModel.countDocuments(query),
  ]);
  return {
    chats: await Promise.all(chats.map((chat) => publicChat(chat, userId))),
    pagination: pagination(pagingResult.page, pagingResult.limit, total),
  };
};

export const getChatByIdService = async ({ chatId, userId }) => {
  const chat = await getParticipantChatService({ chatId, userId });
  await ChatModel.updateOne(
    { _id: chatId, "participantStates.userId": userId },
    { $set: { "participantStates.$.isDeleted": false } },
  );
  return publicChat(await ChatModel.findById(chatId), userId);
};

// Fetch newest messages for efficient paging, then reverse this page so the
// client receives it in chronological order. Tombstones remain in history.
export const getChatMessagesService = async ({ chatId, userId, page, limit }) => {
  const { page: p, limit: l } = paging(page, limit, 30);
  const chat = await getParticipantChatService({ chatId, userId });
  const filter = visibleMessages(chat, userId);
  const [messages, total] = await Promise.all([
    MessageModel.find(filter).sort({ createdAt: -1, _id: -1 })
      .skip((p - 1) * l).limit(l).lean(),
    MessageModel.countDocuments(filter),
  ]);
  return { messages: messages.reverse(), pagination: pagination(p, l, total) };
};

const checkText = (message, clientMessageId) => {
  if (typeof clientMessageId !== "string" || !clientMessageId.trim() || clientMessageId.length > 128) {
    throw fail("clientMessageId is required (maximum 128 characters)", 400);
  }
  if (typeof message !== "string" || !message.trim() || message.trim().length > 5000) {
    throw fail("Message must contain 1 to 5000 characters", 400);
  }
};

// Update both participant states and the inbox preview in one atomic write.
// $add avoids lost unread increments from simultaneous sends; the timestamp
// comparison prevents an older send from replacing a newer last message.
// Mongoose does not cast values in pipeline updates; use ObjectIds for comparisons.
const updateChatAfterSend = async (chat, senderId, receiverId, message, session) => {
  const sender = new mongoose.Types.ObjectId(idString(senderId));
  const receiver = new mongoose.Types.ObjectId(idString(receiverId));
  const result = await ChatModel.updateOne({ _id: chat._id }, [{
    $set: {
      participantStates: {
        $map: {
          input: "$participantStates", as: "state",
          in: {
            $cond: [
              { $eq: ["$$state.userId", receiver] },
              { $mergeObjects: ["$$state", {
                unreadCount: { $add: [{ $ifNull: ["$$state.unreadCount", 0] }, 1] },
                isDeleted: false,
              }] },
              { $cond: [
                { $eq: ["$$state.userId", sender] },
                { $mergeObjects: ["$$state", { isDeleted: false }] },
                "$$state",
              ] },
            ],
          },
        },
      },
      lastMessage: {
        $cond: [
          { $or: [{ $eq: ["$lastMessageAt", null] }, { $lte: ["$lastMessageAt", message.createdAt] }] },
          message._id, "$lastMessage",
        ],
      },
      lastMessageAt: { $max: ["$lastMessageAt", message.createdAt] },
    },
  }], { session });
  if (!result.matchedCount) throw fail("Chat not found", 404);
};

// Internal common send path also serves the existing media uploader.
const persistMessage = async ({ chatId, senderId, clientMessageId, message, messageType = "TEXT", media }, session) => {
  if (typeof clientMessageId !== "string" || !clientMessageId.trim() || clientMessageId.length > 128) {
    throw fail("clientMessageId is required (maximum 128 characters)", 400);
  }
  if (messageType === "TEXT") checkText(message, clientMessageId);
  const chat = await getParticipantChatService({ chatId, userId: senderId, requireMatch: true, session });
  const cleanId = clientMessageId.trim();
  // The model has a unique (senderId, clientMessageId) index. Retrying a
  // request returns its original message without incrementing unread again.
  const lookup = { senderId, clientMessageId: cleanId };
  const existing = await MessageModel.findOne(lookup, null, { session });
  if (existing) {
    if (idString(existing.chatId) !== idString(chatId)) {
      throw fail("clientMessageId has already been used in another chat", 409);
    }
    return { message: existing, created: false };
  }
  let saved;
  try {
    const input = {
      chatId, senderId, receiverId: otherId(chat, senderId),
      clientMessageId: cleanId, message: message?.trim() || "",
      messageType, media: media ?? null, status: "SENT",
    };
    saved = session ? (await MessageModel.create([input], { session }))[0]
      : await MessageModel.create(input);
  } catch (error) {
    // A duplicate-key failure aborts a MongoDB transaction; resolve it outside.
    if (error.code !== 11000 || session) throw error;
    const duplicate = await MessageModel.findOne(lookup);
    if (!duplicate || idString(duplicate.chatId) !== idString(chatId)) {
      throw fail("clientMessageId has already been used in another chat", 409);
    }
    return { message: duplicate, created: false };
  }
  await updateChatAfterSend(chat, senderId, saved.receiverId, saved, session);
  return { message: saved, created: true };
};

export const sendTextMessageService = async ({ chatId, senderId, clientMessageId, message }) => {
  checkText(message, clientMessageId);
  const session = await mongoose.startSession();
  try {
    let result;
    // Inserting the message and updating unread/lastMessage must commit together.
    // Requires MongoDB replica set (including Atlas or a single-node replica set).
    await session.withTransaction(async () => {
      result = await persistMessage({ chatId, senderId, clientMessageId, message, messageType: "TEXT" }, session);
    });
    return result;
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A concurrent retry may win the unique index race. The failed transaction
    // has ended, so read the winner outside it and acknowledge the same result.
    const existing = await MessageModel.findOne({ senderId, clientMessageId: clientMessageId.trim() });
    if (!existing || idString(existing.chatId) !== idString(chatId)) {
      throw fail("clientMessageId has already been used in another chat", 409);
    }
    return { message: existing, created: false };
  } finally {
    await session.endSession();
  }
};

// Preserve the existing media controller contract without accepting media in normal text sends.
export const sendMessageService = async (input) => (await persistMessage(input)).message;

// Delivery is an explicit recipient acknowledgement, not a guess based on
// whether a socket happened to be connected. READ messages stay READ.
export const markChatAsDeliveredService = async ({ chatId, userId }) => {
  const chat = await getParticipantChatService({ chatId, userId });
  const deliveredAt = new Date();
  const result = await MessageModel.updateMany(
    { chatId, receiverId: userId, status: "SENT", createdAt: { $lte: deliveredAt } },
    { $set: { status: "DELIVERED", deliveredAt } },
  );
  return { chatId, userId, senderId: otherId(chat, userId), deliveredAt, modifiedMessages: result.modifiedCount };
};

// Mark only messages still visible to this recipient. A transaction keeps
// message statuses, last-read position and unread count in sync with sends.
export const markChatAsReadService = async ({ chatId, userId }) => {
  const session = await mongoose.startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const chat = await getParticipantChatService({ chatId, userId, session });
      const readAt = new Date();
      const filter = visibleMessages(chat, userId);
      const last = await MessageModel.findOne({ ...filter, receiverId: userId,
        isDeletedForEveryone: { $ne: true }, createdAt: {
        ...(filter.createdAt || {}), $lte: readAt,
      } }, null, { session }).sort({ createdAt: -1, _id: -1 }).lean();
      const result = await MessageModel.updateMany(
        { ...filter, receiverId: userId, status: { $ne: "READ" },
          isDeletedForEveryone: { $ne: true },
          createdAt: { ...(filter.createdAt || {}), $lte: readAt } },
        { $set: { status: "READ", readAt } }, { session },
      );
      // Snapshot count and unread state commit together; concurrent sends retry
      // on a write conflict instead of reviving an already-read unread counter.
      const unreadCount = await MessageModel.countDocuments({
        ...filter, receiverId: userId, status: { $ne: "READ" },
        isDeletedForEveryone: { $ne: true },
      }, { session });
      await ChatModel.updateOne(
        { _id: chatId, "participantStates.userId": userId },
        { $set: {
          "participantStates.$.unreadCount": unreadCount,
          "participantStates.$.lastReadAt": readAt,
          "participantStates.$.lastReadMessageId": last?._id || null,
        } }, { session },
      );
      response = { chatId, userId, senderId: otherId(chat, userId), readAt,
        lastReadMessageId: last?._id || null, modifiedMessages: result.modifiedCount, unreadCount };
    });
    return response;
  } finally {
    await session.endSession();
  }
};

// Archive changes inbox placement for one participant; it does not erase
// messages or change the other participant's inbox.
export const archiveChatService = async ({ chatId, userId, isArchived }) => {
  if (typeof isArchived !== "boolean") throw fail("isArchived must be a boolean", 400);
  await getParticipantChatService({ chatId, userId });
  await ChatModel.updateOne(
    { _id: chatId, "participantStates.userId": userId },
    { $set: { "participantStates.$.isArchived": isArchived } },
  );
  return { chatId, isArchived };
};

// "Clear chat" is personal: hide it and retain a cutoff for future reads.
// A later message may reopen the inbox without revealing cleared history.
export const deleteChatService = async ({ chatId, userId }) => {
  await getParticipantChatService({ chatId, userId });
  const deletedAt = new Date();
  await ChatModel.updateOne(
    { _id: chatId, "participantStates.userId": userId },
    { $set: {
      "participantStates.$.isDeleted": true,
      "participantStates.$.deletedAt": deletedAt,
      "participantStates.$.unreadCount": 0,
    } },
  );
  return { chatId, isDeleted: true, deletedAt };
};

// An edit contains the full message text. Notify only participants who have
// not individually deleted that message or cleared it from their history.
export const getMessageViewersService = async (message) => {
  const chat = await ChatModel.findById(message.chatId).lean();
  if (!chat) return [];
  return chat.participants.filter((userId) => {
    const deletedForUser = message.deletedFor?.some((id) => idString(id) === idString(userId));
    const cutoff = stateFor(chat, userId)?.deletedAt;
    return !deletedForUser && (!cutoff || message.createdAt > cutoff);
  });
};

// Only the sender can edit their still-visible text within the configured
// window. The update repeats those guards to avoid an edit/delete race.
export const editMessageService = async ({ messageId, userId, message }) => {
  if (!validId(messageId)) throw fail("Invalid message ID", 400);
  checkText(message, "edit");
  const existing = await MessageModel.findById(messageId);
  if (!existing) throw fail("Message not found", 404);
  await getParticipantChatService({ chatId: existing.chatId, userId, requireMatch: true });
  if (idString(existing.senderId) !== idString(userId)) throw fail("Only the sender can edit a message", 403);
  if (existing.messageType !== "TEXT" || existing.isDeletedForEveryone) {
    throw fail("This message cannot be edited", 400);
  }
  if (Date.now() - existing.createdAt.getTime() > windowMs) throw fail("Edit window has expired", 400);
  const updated = await MessageModel.findOneAndUpdate(
    { _id: messageId, senderId: userId, isDeletedForEveryone: false, messageType: "TEXT",
      createdAt: { $gte: new Date(Date.now() - windowMs) } },
    { $set: { message: message.trim(), isEdited: true, editedAt: new Date() } },
    { new: true, runValidators: true },
  );
  if (!updated) throw fail("Message can no longer be edited", 409);
  return updated;
};

// For everyone: replace content with a tombstone (sender only, 15 minutes).
// For me: add this user to deletedFor. Recalculate unread in the same
// transaction so removing an unread message cannot leave a phantom badge.
export const deleteMessageService = async ({ messageId, userId, deleteForEveryone = false }) => {
  if (!validId(messageId)) throw fail("Invalid message ID", 400);
  if (typeof deleteForEveryone !== "boolean") throw fail("deleteForEveryone must be a boolean", 400);
  const session = await mongoose.startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const message = await MessageModel.findById(messageId, null, { session });
      if (!message) throw fail("Message not found", 404);
      const chat = await getParticipantChatService({ chatId: message.chatId, userId, session });
      let changed = false;
      if (deleteForEveryone) {
        if (idString(message.senderId) !== idString(userId)) throw fail("Only the sender can delete for everyone", 403);
        if (!message.isDeletedForEveryone) {
          if (Date.now() - message.createdAt.getTime() > windowMs) throw fail("Delete window has expired", 400);
          // Keep a content-free tombstone in history for both participants.
          const result = await MessageModel.updateOne(
            { _id: messageId, senderId: userId, isDeletedForEveryone: false,
              createdAt: { $gte: new Date(Date.now() - windowMs) } },
            { $set: { isDeletedForEveryone: true, deletedForEveryoneAt: new Date(), message: "", media: null } },
            { session },
          );
          if (!result.matchedCount) throw fail("Message can no longer be deleted", 409);
          changed = true;
        }
      } else if (!message.deletedFor?.some((id) => idString(id) === idString(userId))) {
        await MessageModel.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } }, { session });
        changed = true;
      }
      const receiverId = message.receiverId;
      if (changed && (deleteForEveryone || idString(receiverId) === idString(userId))) {
        const receiverChatState = stateFor(chat, receiverId);
        const filter = visibleMessages(chat, receiverId);
        const unreadCount = await MessageModel.countDocuments({
          ...filter, receiverId, status: { $ne: "READ" },
          isDeletedForEveryone: { $ne: true },
        }, { session });
        await ChatModel.updateOne(
          { _id: chat._id, "participantStates.userId": receiverId },
          { $set: { "participantStates.$.unreadCount": receiverChatState?.isDeleted ? 0 : unreadCount } },
          { session },
        );
      }
      response = { chatId: message.chatId, messageId, userId,
        otherUserId: otherId(chat, userId), deleteForEveryone, changed };
    });
    return response;
  } finally {
    await session.endSession();
  }
};
