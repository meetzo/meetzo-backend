import express from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { requireChatAuth } from "./chat.auth.js";
import { uploadChatMedia } from "../../middleware/chatMediaUpload.middleware.js";
import {
  accessChatController,
  getUserChatsController,
  getChatByIdController,
  getChatMessagesController,
  sendMessageController,
  markChatAsReadController,
  markChatAsDeliveredController,
  archiveChatController,
  deleteChatController,
  editMessageController,
  deleteMessageController,
  sendChatMediaController,
  getallchatscontroller
} from "./chat.controller.js";

const router = express.Router();

// The shared guard loads the account; the chat guard rejects OTP-stage JWTs.
router.use(isAuthenticated, requireChatAuth);

// Access creates/retrieves a matched pair; inbox/history are per-user views.
router.post("/create_chat/:targetUserId",isAuthenticated, accessChatController);
router.get("/", isAuthenticated, getUserChatsController);
router.get("/feed", isAuthenticated,  getallchatscontroller)
// Legacy multipart endpoint retained; normal message sends are text-only.
router.post("/:chatId/media", uploadChatMedia, sendChatMediaController);
router.get("/:chatId", isAuthenticated,  getChatByIdController);
router.get("/messages/:chatId",  isAuthenticated,  getChatMessagesController);
router.post("/send_message/:chatId", isAuthenticated,  sendMessageController);
// Receipt and archive operations act on the authenticated participant's state.
router.patch("/delivered/:chatId",  isAuthenticated, markChatAsDeliveredController);
router.patch("/read/:chatId", isAuthenticated,  markChatAsReadController);
router.patch("/archive/:chatId", isAuthenticated,  archiveChatController);
// Message deletion defaults to "for me" unless deleteForEveryone is true.
router.patch("/message/:messageId", isAuthenticated,  editMessageController);
router.delete("/message/:messageId", isAuthenticated,  deleteMessageController);
router.delete("/:chatId", isAuthenticated,  deleteChatController);

export default router;