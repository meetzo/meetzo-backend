import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import express from "express";
import http from "node:http";
import ChatModel from "../../models/chatModel.js";
import MessageModel from "../../models/messageModel.js";
import LikeModel from "../../models/like.Model.js";
import UserModel from "../../models/userModel.js";
import {
  sendTextMessageService, accessChatService, getChatMessagesService,
  getUserChatsService, deleteMessageService, markChatAsReadService,
  archiveChatService, editMessageService, getMessageViewersService,
} from "./chat.service.js";
import { requireChatAuth } from "./chat.auth.js";
import { socketAuth } from "../../socket/socketAuth.js";
import { registerChatSocket } from "./chat.socket.js";
import { matchedUserIds } from "./chat.presence.js";

const id = () => new mongoose.Types.ObjectId();
const userA = id(), userB = id(), chatId = id();
const makeChat = () => ({
  _id: chatId, participants: [userA, userB],
  participantStates: [
    { userId: userA, unreadCount: 0, isDeleted: false, isArchived: false, deletedAt: null },
    { userId: userB, unreadCount: 0, isDeleted: false, isArchived: false, deletedAt: null },
  ],
  populate: async function () { return this; },
});
const mockSession = (t) => t.mock.method(mongoose, "startSession", async () => ({
  withTransaction: async (fn) => fn(), endSession: async () => {},
}));
const matchMocks = (t, chat = makeChat()) => {
  t.mock.method(ChatModel, "findById", async () => chat);
  t.mock.method(LikeModel, "exists", async () => true);
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userB, isBlocked: false }) }));
};

// Mocked model boundaries: no MongoDB connection required.
test("text send requires a nonempty bounded message and idempotency ID", async (t) => {
  await assert.rejects(sendTextMessageService({ chatId, senderId: userA, message: "hi" }),
    (error) => error.statusCode === 400);
  await assert.rejects(sendTextMessageService({ chatId, senderId: userA, clientMessageId: "x", message: " ".repeat(3) }),
    (error) => error.statusCode === 400);
  await assert.rejects(sendTextMessageService({ chatId, senderId: userA, clientMessageId: "x", message: "a".repeat(5001) }),
    (error) => error.statusCode === 400);
  mockSession(t);
  matchMocks(t);
  t.mock.method(MessageModel, "findOne", async () => null);
  t.mock.method(MessageModel, "create", async (input) => [{ ...input[0], _id: id(), createdAt: new Date() }]);
  let update;
  t.mock.method(ChatModel, "updateOne", async (filter, pipeline) => {
    update = pipeline; return { matchedCount: 1 };
  });
  const result = await sendTextMessageService({ chatId, senderId: userA, clientMessageId: "client-1", message: " hello " });
  assert.equal(result.created, true);
  assert.equal(result.message.message, "hello");
  assert.equal(result.message.messageType, "TEXT");
  assert.equal(result.message.receiverId, userB);
  // Atomic in-document update uses $map/$add, not a stale read/save of unreadCount.
  assert.ok(update[0].$set.participantStates.$map);
});

test("retry returns existing message and never increments unread count twice", async (t) => {
  mockSession(t);
  matchMocks(t);
  const existing = { _id: id(), chatId, senderId: userA, receiverId: userB, message: "hello" };
  t.mock.method(MessageModel, "findOne", async () => existing);
  const create = t.mock.method(MessageModel, "create", async () => { throw Error("unexpected create"); });
  const update = t.mock.method(ChatModel, "updateOne", async () => { throw Error("unexpected update"); });
  const result = await sendTextMessageService({ chatId, senderId: userA, clientMessageId: "client-1", message: "hello" });
  assert.equal(result.created, false);
  assert.equal(result.message, existing);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});

test("sending after an unlike is rejected", async (t) => {
  mockSession(t);
  t.mock.method(ChatModel, "findById", async () => makeChat());
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userB, isBlocked: false }) }));
  t.mock.method(LikeModel, "exists", async () => false);
  await assert.rejects(sendTextMessageService({ chatId, senderId: userA, clientMessageId: "x", message: "hi" }),
    (error) => error.statusCode === 403);
});

test("accessing a cleared chat reopens only the caller without removing the history cutoff", async (t) => {
  const chat = makeChat();
  chat.participantStates[0].isDeleted = true;
  chat.participantStates[0].deletedAt = new Date("2025-01-01");
  chat.participantStates[1].isDeleted = true;
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userA, isBlocked: false }) }));
  t.mock.method(LikeModel, "exists", async () => true);
  t.mock.method(ChatModel, "findOne", async () => chat);
  t.mock.method(ChatModel, "findById", async () => chat);
  let update;
  t.mock.method(ChatModel, "updateOne", async (...args) => { update = args; return { matchedCount: 1 }; });
  t.mock.method(MessageModel, "findOne", () => ({ sort: () => ({ lean: async () => null }) }));
  await accessChatService({ userId: userA, targetUserId: userB });
  assert.equal(String(update[0]["participantStates.userId"]), String(userA));
  assert.deepEqual(update[1], { $set: { "participantStates.$.isDeleted": false } });
  assert.equal(chat.participantStates[1].isDeleted, true);
  assert.equal(chat.participantStates[0].deletedAt.toISOString(), "2025-01-01T00:00:00.000Z");
});

test("history enforces personal clear cutoff and retains deletion tombstones", async (t) => {
  const chat = makeChat();
  chat.participantStates[0].deletedAt = new Date("2025-01-01");
  t.mock.method(ChatModel, "findById", async () => chat);
  let filter;
  t.mock.method(MessageModel, "find", (where) => {
    filter = where;
    return { sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [
      { message: "", isDeletedForEveryone: true },
    ] }) }) }) };
  });
  t.mock.method(MessageModel, "countDocuments", async () => 1);
  const result = await getChatMessagesService({ chatId, userId: userA });
  assert.equal(filter.createdAt.$gt, chat.participantStates[0].deletedAt);
  assert.deepEqual(filter.deletedFor, { $ne: userA });
  assert.equal(filter.isDeletedForEveryone, undefined);
  assert.equal(result.messages[0].isDeletedForEveryone, true);
});

test("inbox pagination filters archived and cleared chats in the database", async (t) => {
  let filter;
  t.mock.method(ChatModel, "find", (where) => {
    filter = where;
    return { sort: () => ({ skip: () => ({ limit: async () => [] }) }) };
  });
  t.mock.method(ChatModel, "countDocuments", async () => 0);
  const result = await getUserChatsService({ userId: userA, archived: true, page: 2, limit: 5 });
  assert.deepEqual(filter.participantStates.$elemMatch,
    { userId: userA, isDeleted: false, isArchived: true });
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.total, 0);
});

test("delete for everyone stores a tombstone without calling document validation", async (t) => {
  const message = { _id: id(), chatId, senderId: userA, receiverId: userB, createdAt: new Date() };
  mockSession(t);
  matchMocks(t);
  t.mock.method(MessageModel, "findById", async () => message);
  let update;
  t.mock.method(MessageModel, "updateOne", async (query, value) => { update = value; return { matchedCount: 1 }; });
  t.mock.method(MessageModel, "countDocuments", async () => 0);
  t.mock.method(ChatModel, "updateOne", async () => ({ matchedCount: 1 }));
  const result = await deleteMessageService({ messageId: message._id, userId: userA, deleteForEveryone: true });
  assert.equal(result.deleteForEveryone, true);
  assert.equal(update.$set.message, "");
  assert.equal(update.$set.isDeletedForEveryone, true);
  const tombstone = new MessageModel({ chatId, senderId: userA, receiverId: userB,
    clientMessageId: "deleted", messageType: "TEXT", message: "", isDeletedForEveryone: true });
  await tombstone.validate();
});

test("chat rejects temporary OTP tokens even if general auth accepted them", (t) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret";
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret; });
  const reqFor = (purpose) => ({ headers: { authorization: `Bearer ${jwt.sign({
    id: String(userA), userId: String(userA), purpose,
  }, process.env.JWT_SECRET)}` }, user: { _id: userA } });
  let error;
  requireChatAuth(reqFor("EMAIL_LOGIN_OTP"), {}, (err) => { error = err; });
  assert.equal(error?.statusCode, 401);
  error = "not-called";
  requireChatAuth(reqFor("AUTH"), {}, (err) => { error = err; });
  assert.equal(error, undefined);
});

test("pair key uses canonical ObjectIds regardless of hexadecimal case", async (t) => {
  const chat = makeChat();
  let key;
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userA, isBlocked: false }) }));
  t.mock.method(LikeModel, "exists", async () => true);
  t.mock.method(ChatModel, "findOne", async (query) => { key = query.pairKey; return chat; });
  t.mock.method(ChatModel, "findById", async () => chat);
  t.mock.method(ChatModel, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(MessageModel, "findOne", () => ({ sort: () => ({ lean: async () => null }) }));
  await accessChatService({ userId: userA, targetUserId: String(userB).toUpperCase() });
  assert.equal(key, [String(userA), String(userB)].sort().join("_"));
});

test("read receipt commits message statuses and unread count in one transaction", async (t) => {
  mockSession(t);
  t.mock.method(ChatModel, "findById", async () => makeChat());
  const lastId = id();
  t.mock.method(MessageModel, "findOne", () => ({ sort: () => ({ lean: async () => ({ _id: lastId }) }) }));
  t.mock.method(MessageModel, "updateMany", async () => ({ modifiedCount: 2 }));
  t.mock.method(MessageModel, "countDocuments", async () => 0);
  let options;
  t.mock.method(ChatModel, "updateOne", async (...args) => { options = args[2]; return { matchedCount: 1 }; });
  const result = await markChatAsReadService({ chatId, userId: userA });
  assert.equal(result.modifiedMessages, 2);
  assert.equal(result.unreadCount, 0);
  assert.equal(result.lastReadMessageId, lastId);
  assert.ok(options.session);
});

test("read receipts exclude personally cleared and deleted messages", async (t) => {
  mockSession(t);
  const chat = makeChat();
  chat.participantStates[0].deletedAt = new Date("2025-01-01");
  t.mock.method(ChatModel, "findById", async () => chat);
  t.mock.method(MessageModel, "findOne", () => ({ sort: () => ({ lean: async () => null }) }));
  let updated;
  t.mock.method(MessageModel, "updateMany", async (filter) => {
    updated = filter; return { modifiedCount: 0 };
  });
  t.mock.method(MessageModel, "countDocuments", async () => 0);
  t.mock.method(ChatModel, "updateOne", async () => ({ matchedCount: 1 }));
  await markChatAsReadService({ chatId, userId: userA });
  assert.equal(updated.createdAt.$gt, chat.participantStates[0].deletedAt);
  assert.ok(updated.createdAt.$lte);
  assert.deepEqual(updated.deletedFor, { $ne: userA });
  assert.deepEqual(updated.isDeletedForEveryone, { $ne: true });
});

test("archive affects only requesting participant", async (t) => {
  t.mock.method(ChatModel, "findById", async () => makeChat());
  let filter;
  t.mock.method(ChatModel, "updateOne", async (where) => { filter = where; });
  await archiveChatService({ chatId, userId: userA, isArchived: true });
  assert.equal(filter["participantStates.userId"], userA);
  await assert.rejects(archiveChatService({ chatId, userId: userA, isArchived: "true" }),
    (error) => error.statusCode === 400);
});

test("message edit is sender-only and excludes users who deleted it from edit notifications", async (t) => {
  const message = { _id: id(), chatId, senderId: userA, receiverId: userB,
    message: "old", messageType: "TEXT", createdAt: new Date(),
    deletedFor: [userB], isDeletedForEveryone: false };
  t.mock.method(MessageModel, "findById", async () => message);
  t.mock.method(MessageModel, "findOneAndUpdate", async () => ({ ...message, message: "new" }));
  t.mock.method(ChatModel, "findById", () => ({ ...makeChat(), lean: async () => makeChat() }));
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userB, isBlocked: false }) }));
  t.mock.method(LikeModel, "exists", async () => true);
  await assert.rejects(editMessageService({ messageId: message._id, userId: userB, message: "bad" }),
    (error) => error.statusCode === 403);
  const result = await editMessageService({ messageId: message._id, userId: userA, message: "new" });
  assert.deepEqual((await getMessageViewersService(result)).map(String), [String(userA)]);
});

test("socket handshake rejects OTP tokens before joining personal rooms", async (t) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret";
  t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret; });
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userA, isBlocked: false }) }));
  const socket = { handshake: { auth: { token: jwt.sign({ userId: String(userA), purpose: "EMAIL_LOGIN_OTP" }, process.env.JWT_SECRET) } } };
  let error;
  await socketAuth(socket, (err) => { error = err; });
  assert.ok(error);
  socket.handshake.auth.token = jwt.sign({ userId: String(userA), purpose: "AUTH" }, process.env.JWT_SECRET);
  error = "not-called";
  await socketAuth(socket, (err) => { error = err; });
  assert.equal(error, undefined);
  assert.equal(socket.userId, String(userA));
});

test("malformed socket callback cannot crash a chat event", async () => {
  const handlers = new Map();
  const socket = { userId: String(userA), handshake: { auth: {} },
    rooms: new Set(), on: (event, handler) => handlers.set(event, handler) };
  registerChatSocket({}, socket);
  assert.doesNotThrow(() => handlers.get("chat:leave")({ chatId: "invalid" }, 42));
  await assert.doesNotReject(handlers.get("message:send")({ media: {} }, 42));
});

test("presence only returns users with reciprocal active likes", async (t) => {
  const third = id();
  let incomingFilter;
  t.mock.method(LikeModel, "find", (filter) => {
    if (filter.fromUserId === userA) {
      return { select: () => ({ lean: async () => [{ toUserId: userB }, { toUserId: third }] }) };
    }
    incomingFilter = filter;
    return { select: () => ({ lean: async () => [{ fromUserId: userB }] }) };
  });
  assert.deepEqual(await matchedUserIds(userA), [String(userB)]);
  assert.equal(incomingFilter.status, "ACTIVE");
  assert.deepEqual(incomingFilter.fromUserId.$in, [userB, third]);
});

test("chat REST routes return correct 400/401 and reject direct media metadata", async (t) => {
  const old = Object.fromEntries(["JWT_SECRET", "IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY",
    "IMAGEKIT_URL_ENDPOINT"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { JWT_SECRET: "test-only-secret", IMAGEKIT_PUBLIC_KEY: "test",
    IMAGEKIT_PRIVATE_KEY: "test", IMAGEKIT_URL_ENDPOINT: "https://example.com" });
  t.after(() => { for (const [key, value] of Object.entries(old)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const { default: router } = await import("./chat.routes.js");
  t.mock.method(UserModel, "findById", () => ({ select: async () => ({ _id: userA, isBlocked: false }) }));
  const app = express();
  app.use(express.json());
  app.use("/api/chat", router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/chat`;
  const auth = (purpose) => ({ Authorization: `Bearer ${jwt.sign({
    id: String(userA), userId: String(userA), purpose,
  }, process.env.JWT_SECRET)}`, "Content-Type": "application/json" });
  const blocked = await fetch(`${url}/${chatId}/messages`, { method: "POST",
    headers: auth("EMAIL_LOGIN_OTP"), body: JSON.stringify({ message: "hi", clientMessageId: "x" }) });
  assert.equal(blocked.status, 401);
  const media = await fetch(`${url}/${chatId}/messages`, { method: "POST",
    headers: auth("AUTH"), body: JSON.stringify({ messageType: "IMAGE", media: { url: "fake" } }) });
  assert.equal(media.status, 400);
  const badHistory = await fetch(`${url}/invalid/messages`, { headers: auth("AUTH") });
  assert.equal(badHistory.status, 400);
});
