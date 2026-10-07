import LikeModel from "../../models/like.Model.js";

// Presence is private to reciprocal active likes; a connected user cannot
// enumerate arbitrary accounts or see people who have since unmatched them.
export const matchedUserIds = async (userId) => {
  // First collect active outgoing likes; then keep only users with an active
  // like back. Presence must not reveal one-sided likes or unrelated users.
  const sent = await LikeModel.find({ fromUserId: userId, status: "ACTIVE" })
    .select("toUserId").lean();
  if (!sent.length) return [];
  const received = await LikeModel.find({
    toUserId: userId,
    fromUserId: { $in: sent.map((like) => like.toUserId) },
    status: "ACTIVE",
  }).select("fromUserId").lean();
  return received.map((like) => like.fromUserId.toString());
};
