import UserModel from "../../models/userModel.js";
import {
    Group,
    Invite,
    GroupMember,
    GroupMessage
} from '../../models/groups.model.js';
import mongoose from "mongoose";
import { encrypt, decrypt } from "../../utils/encryption.js";
import imageKit from "../profile/imageKit.service.js";
import { notifyUser } from "../notifications/notifications.service.js";

//create group service
export const createGroupService = async (groupData, userId) => {

   const validateGroupInput = ({ name, description }) => {

  if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 50) {
    throw fail("Group name must be 3 to 50 characters", 400);
  }

  if (description && (typeof description !== "string" || description.length > 500)) {
    throw fail("Description must be at most 500 characters", 400);
  }
};
    //validate the group input data
    validateGroupInput(groupData);

    // Save the same trimmed values the duplicate check uses, or "Name " slips past it.
    const name = groupData.name.trim();
    const duplicate = await Group.exists({ ownerID: userId, name, type: groupData.type })
        .collation({ locale: "en", strength: 2 });
    if (duplicate) throw fail(`You already have a ${groupData.type} group with this name`, 409);

    //create a new group instance
    // Only client-editable fields; status, isDefault and membercount stay server-controlled.
    const group = new Group({
        name,
        description: groupData.description,
        category: groupData.category,
        type: groupData.type,
        ownerID: userId,
        membercount: 1
    });
    await group.save();
    await GroupMember.create({
        groupID: group._id,
        userID: userId,
        role: 'owner'
    });
   const systemMessage = await GroupMessage.create({
        groupID: group._id,
        senderID: null,
        messageType: "system",
        message: encrypt("Group created successfully"),
        systemEvent: { type: "GROUP_CREATED", actorId: userId },
    });

    group.lastmessageID = systemMessage._id;
    group.lastmessagedate = systemMessage.createdAt;
    await group.save();

    return group;
};


// leave group service
export const leaveGroupService = async (groupId, userId) => {
  if (!mongoose.isValidObjectId(groupId)) throw fail("Invalid group ID", 400);
    const groupMember = await GroupMember.findOne({ groupID: groupId, userID: userId, status: "active" });
    if (!groupMember) throw fail('You are not a member of this group', 404);
    if (groupMember.role === 'owner') throw fail('Owner cannot leave the group. Transfer ownership or delete the group', 400);
    await GroupMember.updateOne({ _id: groupMember._id }, { $set: { status: 'left', leftAt: new Date() } });
    await Group.updateOne({ _id: groupId }, { $inc: { membercount: -1 } });
    return true;
};

const MANAGER_ROLES = ["owner", "admin"];

const getActiveMembership = (groupId, userId, session) =>
  GroupMember.findOne({ groupID: groupId, userID: userId, status: "active" }, null, { session });


// send invites service (owner/admin of a private or premium group only)
export const sendInvitesService = async (groupId, invitees, userId) => {
  if (!mongoose.isValidObjectId(groupId)) throw fail("Invalid group ID", 400);
  if (!Array.isArray(invitees) || invitees.length === 0) throw fail("userIds must be a non-empty array", 400);
  if (invitees.length > 50) throw fail("You can invite at most 50 users at once", 400);

  const group = await Group.findById(groupId).select("_id name type status");
  if (!group || group.status !== "ACTIVE") throw fail("Group not found", 404);
  if (group.type === "public") throw fail("Public groups don't need invites, users can join directly", 400);

  const inviter = await getActiveMembership(groupId, userId);
  if (!inviter || !MANAGER_ROLES.includes(inviter.role)) {
    throw fail("Only the owner or an admin can send invites", 403);
  }

  const ids = [...new Set(invitees.map(String))].filter((id) => id !== String(userId));
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw fail("Invalid user ID in userIds", 400);

  const [users, members, pending] = await Promise.all([
    UserModel.find({ _id: { $in: ids }, isBlocked: { $ne: true } }).select("_id").lean(),
    GroupMember.find({ groupID: groupId, userID: { $in: ids }, status: { $in: ["active", "banned"] } }).select("userID").lean(),
    Invite.find({ groupID: groupId, userID: { $in: ids }, status: "pending" }).select("userID").lean(),
  ]);
  const skip = new Set([...members, ...pending].map((doc) => String(doc.userID)));
  const toInvite = users.map((u) => String(u._id)).filter((id) => !skip.has(id));

  const invited = await Invite.insertMany(
    toInvite.map((inviteeId) => ({ groupID: groupId, userID: inviteeId, invitedBy: userId })),
  );
  invited.forEach((invite) => notifyUser(invite.userID, {
    title: "Group invite",
    body: `You've been invited to join ${group.name}`,
    data: { type: "GROUP_INVITE", inviteId: invite._id, groupId },
  }));
  return { invited, skipped: ids.filter((id) => !toInvite.includes(id)) };
};



// my pending invites (invitee)
export const getMyInvitesService = (userId) =>
  Invite.find({ userID: userId, status: "pending" })
    .populate("groupID", "_id name description type category membercount")
    .populate("invitedBy", "_id name profileImage")
    .sort({ createdAt: -1 })
    .lean();

// pending invites of a group (owner/admin)
export const getGroupInvitesService = async (groupId, userId) => {
  if (!mongoose.isValidObjectId(groupId)) throw fail("Invalid group ID", 400);
  const me = await getActiveMembership(groupId, userId);
  if (!me || !MANAGER_ROLES.includes(me.role)) throw fail("Only the owner or an admin can view invites", 403);
  return Invite.find({ groupID: groupId, status: "pending" })
    .populate("userID", "_id name profileImage")
    .populate("invitedBy", "_id name")
    .sort({ createdAt: -1 })
    .lean();
};

// accept / reject an invite (invited user only)
export const respondInviteService = async (inviteId, userId, action) => {
  if (!mongoose.isValidObjectId(inviteId)) throw fail("Invalid invite ID", 400);
  if (!["accept", "reject"].includes(action)) throw fail("Invalid action", 400);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const invite = await Invite.findById(inviteId, null, { session });
      // Hide other users' invites behind 404 so invite IDs can't be probed.
      if (!invite || String(invite.userID) !== String(userId)) throw fail("Invite not found", 404);
      if (invite.status !== "pending") throw fail(`Invite already ${invite.status}`, 409);

      invite.status = action === "accept" ? "accepted" : "rejected";
      invite.respondedby = userId;
      invite.respondedAt = new Date();
      await invite.save({ session });

      if (action === "reject") {
        result = { joined: false, message: "Invite rejected" };
        return;
      }

      const group = await Group.findById(invite.groupID, null, { session });
      if (!group || group.status !== "ACTIVE") throw fail("Group is unavailable", 403);

      const existing = await GroupMember.findOne({ groupID: group._id, userID: userId }, null, { session });
      if (existing?.status === "banned") throw fail("You cannot join this group", 403);
      if (existing?.status === "active") {
        result = { joined: false, groupId: group._id, message: "Already a member" };
        return;
      }

      await GroupMember.findOneAndUpdate(
        { groupID: group._id, userID: userId },
        { $set: { status: "active", role: "member", joinedAt: new Date() }, $unset: { leftAt: "" } },
        { upsert: true, session },
      );
      await Group.updateOne({ _id: group._id }, { $inc: { membercount: 1 } }, { session });
      await GroupMessage.create([{
        groupID: group._id, senderID: null, messageType: "system",
        message: encrypt("Member joined"),
        systemEvent: { type: "MEMBER_JOINED", actorId: userId },
      }], { session });

      result = { joined: true, groupId: group._id, message: "Joined group successfully" };
    });
    return result;
  } finally {
    await session.endSession();
  }
};

  



//join public group service 
export const joingroupservice = async (groupId, userId) =>{
    if (!mongoose.isValidObjectId(groupId)) throw fail("Invalid group ID", 400);
    const session = await mongoose.startSession();

    try{
        let result;
        await session.withTransaction(async () => {
        const group = await Group.findById(groupId, null, { session });

      if (!group || group.status === "BANNED") throw fail("Group not found", 404);
      if (group.type !== "public") throw fail("This is not a public group", 403);
      if (group.status !== "ACTIVE") throw fail("Group is unavailable", 403);

      const existing = await GroupMember.findOne({ groupID: groupId, userID: userId }, null, { session });

      if (existing?.status === "active") {
        result = { group, joined: false, message: "Already a member" };
        return;
      }
       if (["banned", "removed"].includes(existing?.status)) throw fail("You cannot join this group", 403);

       // adding member to the public group
        await GroupMember.findOneAndUpdate(
        { groupID: groupId, userID: userId },
        {
          $set: { status: "active", role: "member", joinedAt: new Date() },
          $unset: { leftAt: ""},
        },
        { upsert: true, session }
      );

      await Group.updateOne({ _id: groupId }, { $inc: { membercount: 1 } }, { session });

      
       await GroupMessage.create([{
        groupID: groupId, senderID: null, messageType: "system", message: encrypt("Member joined"),
        systemEvent: { type: "MEMBER_JOINED", actorId: userId },
        }], { session });

        result = { group, joined: true, message: "Joined group successfully" };
        });
        return result;

    }catch (error){
         if (error.code === 11000) return { joined: false, message: "Already a member" };
         throw error;
    }finally {
    await session.endSession();
  }
    
}





// get all messages service (newest first, paginated)
export const getGroupMessagesService = async ({ groupId, userId, page = 1, limit = 30 }) => {
  const member = await assertActiveMember(groupId, userId);
  const p = Math.max(parseInt(page) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit) || 30, 1), 100);

  // Members only see messages sent since they (re)joined.
  const filter = { groupID: groupId, createdAt: { $gte: member.joinedAt } };

  const [messages, total] = await Promise.all([
    GroupMessage.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((p - 1) * l).limit(l)
      .populate("senderID", "_id name profileImage")
      .lean(),
    GroupMessage.countDocuments(filter),
  ]);
  
  return {
    messages: messages.map(toClientGroupMessage),
    total_messgages:total,
    pagination: {
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
      hasNextPage: p * l < total,
    },
  };
}

// send message service
export const sendGroupMessageService = async ({ groupId, userId, message, messageType = "text" }) => {
  await assertActiveMember(groupId, userId);
  if (typeof message !== "string" || !message.trim()) throw fail("Message cannot be empty", 400);
  if (message.length > 5000) throw fail("Message too long", 400);
  // "system" is server-only; media types have no upload handling yet.
  if (messageType !== "text") throw fail("Only text messages are supported", 400);

  const created = await GroupMessage.create({
    groupID: groupId,
    senderID: userId,
    message: encrypt(message.trim()),
    messageType,
  });

  await Group.updateOne(
    { _id: groupId },
   { $set: { lastmessageID: created._id, lastmessagedate: created.createdAt } }
  );

   const populated = await GroupMessage.findById(created._id)
    .populate("senderID", "_id name profileImage").lean();
   
    return toClientGroupMessage(populated);
};

//




const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const assertActiveMember = async (groupId, userId) => {
  if (!mongoose.isValidObjectId(groupId)) throw fail("Invalid group ID", 400);

  const group = await Group.findById(groupId).select("_id status");

  if (!group || group.status === "BANNED") throw fail("Group not found", 404);

  const member = await GroupMember.findOne({ groupID: groupId, userID: userId, status: "active" })
    .select("_id role joinedAt").lean();

  if (!member) throw fail("You are not a member of this group", 403);
  return member;
};

const toClientGroupMessage = (msg) => msg && ({
  ...msg,
  message: msg.isdeleted ? "" : (msg.message ? decrypt(msg.message) : ""),
});




// upload or replace the group icon (owner/admin only)
export const updateGroupIconService = async({groupId, userId, file}) =>{
  if(!mongoose.isValidObjectId(groupId)) throw fail("Invalid Group ID", 400);
  if(!file) throw fail("Icon image is required", 400);

  const me =  await GroupMember.findOne({groupID : groupId, userID: userId, status: "active"});
  if(!me || !["owner", "admin"].includes(me.role)){
    throw fail("Only the owner or an Admin can change the group Icon", 403);
  }
  const group = await Group.findById(groupId);
  if (!group) throw fail("Group not fund", 404);
  const oldIconId = group.iconId;

  //upload new image
  let uploaded;
  try{
    uploaded = await imageKit.upload({
      file: file.buffer.toString("base64"),
      fileName: `group-${groupId}-${Date.now()}`,
      folder: "/Meetzo/Group_Icons",
      useUniqueFileName: true,
      tags: ["group-icon", String(groupId)]
    });
  }catch(error){
    throw fail (`Group Icon upload failed: ${error.message}`, 500);
  }
 // 2. save to DB; if that fails, remove the image we just uploaded
  try {
    group.icon = uploaded.url;
    group.iconId = uploaded.fileId;
    await group.save();
  } catch (error) {
    await imageKit.deleteFile(uploaded.fileId).catch(() => {});
    throw fail("Unable to update group icon", 500);
  }
   // 3. only now delete the old icon
  if (oldIconId && oldIconId !== uploaded.fileId) {
    await imageKit.deleteFile(oldIconId)
      .catch((e) => console.error("Old group icon deletion failed:", e.message));
  }

  return { icon: group.icon, iconId: group.iconId };
};


//set Admins service
export const setGroupAdminsService = async ({groupId, targetUserId, userId, ownerId, role}) =>{
  if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(targetUserId)) {
    throw fail("invalid ID", 400);
      }
  if(!["admin", "member"].includes(role)){
    throw fail('role must be "Admin" o "member"', 400);
  }
  const me = await GroupMember.findOne({groupID: groupId, userID: ownerId, status: "active" });
if(!me || me.role !== "owner")throw fail("only the owner can change the role of a member", 400);

const target = await GroupMember.findOne({groupID: groupId, userID: targetUserId, status: "active"});
if(!target) throw fail ("Member not found in theis group", 404);
if(target.role == "owner") throw fail ("the owner role can not be changed", 400);
if(target.role === role) throw fail(`user is already ${role === "admin" ? "an Admin" : "a member"}`, 400)

target.role = role;
await target.save();
return{userId: target.userID, role: target.role};
};
