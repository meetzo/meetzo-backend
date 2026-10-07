import {
  accessChatService,
  getUserChatsService,
  getChatByIdService,
  getChatMessagesService,
  sendTextMessageService,
  sendMessageService,
  assertChatParticipantService,
  markChatAsDeliveredService,
  markChatAsReadService,
  archiveChatService,
  deleteChatService,
  editMessageService,
  getMessageViewersService,
  deleteMessageService,
} from "./chat.service.js";
import { emitChatEvent, emitNewMessage } from "./chat.events.js";
import { deleteChatMediaService, uploadChatMediaService } from "./chatMedia.service.js";
import ApiError from "../../utils/api.error.js";

// HTTP handlers keep the response shape stable; the service owns validation
// and authorization. Errors go to the application's shared error middleware.
export const accessChatController = async (req, res, next) => {
  try {
    const data = await accessChatService({ userId: req.user._id, targetUserId: req.body?.targetUserId });
    res.status(200).json({ success: true, message: "Chat accessed successfully", data });
  } catch (error) { next(error); }
};

export const getUserChatsController = async (req, res, next) => {
  try {
    if (req.query.archived !== undefined && !["true", "false"].includes(req.query.archived)) {
      throw new ApiError(400, "archived must be true or false");
    }
    const result = await getUserChatsService({
      userId: req.user._id, page: req.query.page, limit: req.query.limit,
      archived: req.query.archived === "true",
    });
    res.status(200).json({ success: true, message: "Chats fetched successfully",
      data: result.chats, pagination: result.pagination });
  } catch (error) { next(error); }
};

export const getChatByIdController = async (req, res, next) => {
  try {
    const data = await getChatByIdService({ chatId: req.params.chatId, userId: req.user._id });
    res.status(200).json({ success: true, message: "Chat fetched successfully", data });
  } catch (error) { next(error); }
};

export const getChatMessagesController = async (req, res, next) => {
  try {
    const result = await getChatMessagesService({
      chatId: req.params.chatId, userId: req.user._id,
      page: req.query.page, limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: "Messages fetched successfully",
      data: result.messages, pagination: result.pagination });
  } catch (error) { next(error); }
};

// POST /:chatId/messages accepts text only. A repeated clientMessageId gets
// the existing message and must not trigger a second realtime notification.
export const sendMessageController = async (req, res, next) => {
  try {
    if (req.body?.media != null || (req.body?.messageType && req.body.messageType !== "TEXT")) {
      throw new ApiError(400, "Only text messages are supported by this endpoint");
    }
    const result = await sendTextMessageService({
      chatId: req.params.chatId, senderId: req.user._id,
      clientMessageId: req.body?.clientMessageId, message: req.body?.message,
    });
    if (result.created) emitNewMessage(result.message);
    res.status(result.created ? 201 : 200).json({
      success: true, message: result.created ? "Message sent successfully" : "Message already sent",
      data: result.message,
    });
  } catch (error) { next(error); }
};

// Existing multipart media endpoint retained without extending media features here.
export const sendChatMediaController = async (req, res, next) => {
  let uploadedMedia;
  try {
    const { chatId } = req.params;
    const { clientMessageId, caption = "" } = req.body || {};
    if (typeof clientMessageId !== "string" || !clientMessageId.trim() || clientMessageId.length > 128) {
      throw new ApiError(400, "clientMessageId is required (maximum 128 characters)");
    }
    if (typeof caption !== "string" || caption.length > 5000) {
      throw new ApiError(400, "Caption must be 5000 characters or fewer");
    }
    await assertChatParticipantService({ chatId, userId: req.user._id });
    uploadedMedia = await uploadChatMediaService({ file: req.file });
    const result = await sendMessageService({
      chatId, senderId: req.user._id, clientMessageId: clientMessageId.trim(),
      message: caption, messageType: uploadedMedia.type, media: uploadedMedia.media,
    });
    if (!result.created) {
      // A retry already has a saved message, so remove the extra uploaded copy.
      await deleteChatMediaService(uploadedMedia.media.fileId);
      uploadedMedia = undefined;
    } else {
      // Send updates to both users' devices, even if they have not joined this chat.
      emitNewMessage(result.message);
    }
    return res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created ? "Media message sent successfully" : "Media message already sent",
      data: result.message,
    });
  } catch (error) {
    if (uploadedMedia?.media?.fileId) await deleteChatMediaService(uploadedMedia.media.fileId);
    next(error);
  }
};

// The recipient explicitly acknowledges delivery/read state. Notify both
// users only if at least one stored message actually changed status.
export const markChatAsDeliveredController = async (req, res, next) => {
  try {
    const data = await markChatAsDeliveredService({ chatId: req.params.chatId, userId: req.user._id });
    if (data.modifiedMessages) emitChatEvent("message:delivered", data, [data.userId, data.senderId]);
    res.status(200).json({ success: true, message: "Messages marked as delivered", data });
  } catch (error) { next(error); }
};

export const markChatAsReadController = async (req, res, next) => {
  try {
    const data = await markChatAsReadService({ chatId: req.params.chatId, userId: req.user._id });
    if (data.modifiedMessages) emitChatEvent("message:read", data, [data.userId, data.senderId]);
    res.status(200).json({ success: true, message: "Chat marked as read", data });
  } catch (error) { next(error); }
};

// Archive and clear affect only the current user's view; notify their other
// connected devices, not the other participant.
export const archiveChatController = async (req, res, next) => {
  try {
    const data = await archiveChatService({
      chatId: req.params.chatId, userId: req.user._id, isArchived: req.body?.isArchived,
    });
    emitChatEvent("chat:archive", data, [req.user._id]);
    res.status(200).json({ success: true, message: "Chat archive updated", data });
  } catch (error) { next(error); }
};

export const deleteChatController = async (req, res, next) => {
  try {
    const data = await deleteChatService({ chatId: req.params.chatId, userId: req.user._id });
    emitChatEvent("chat:deleted", data, [req.user._id]);
    res.status(200).json({ success: true, message: "Chat cleared for you", data });
  } catch (error) { next(error); }
};

export const editMessageController = async (req, res, next) => {
  try {
    const data = await editMessageService({
      messageId: req.params.messageId, userId: req.user._id, message: req.body?.message,
    });
    try {
      // Edits carry message text: do not send it to someone who deleted it.
      emitChatEvent("message:edited", data, await getMessageViewersService(data));
    } catch (error) {
      console.error("Message edited but notification failed:", error);
    }
    res.status(200).json({ success: true, message: "Message edited", data });
  } catch (error) { next(error); }
};

export const deleteMessageController = async (req, res, next) => {
  try {
    const data = await deleteMessageService({
      messageId: req.params.messageId, userId: req.user._id,
      deleteForEveryone: req.body?.deleteForEveryone ?? false,
    });
    if (data.changed) {
      emitChatEvent("message:deleted", data,
        data.deleteForEveryone ? [data.userId, data.otherUserId] : [req.user._id]);
    }
    res.status(200).json({ success: true,
      message: data.deleteForEveryone ? "Message deleted for everyone" : "Message deleted for you", data });
  } catch (error) { next(error); }
};
