import { createGroupService, leaveGroupService, sendInvitesService, joingroupservice,
   getGroupMessagesService, sendGroupMessageService, getMyInvitesService,
   getGroupInvitesService, respondInviteService, updateGroupIconService, 
   setGroupAdminsService } from './groups.service.js';
import { Group, GroupMember, GroupMessage, Invite } from '../../models/groups.model.js';
import mongoose from 'mongoose';


// create group controller
export const createGroupController = async (req, res) => {
  try {
    const createGroupDto = req.body;    
    const group = await createGroupService(createGroupDto, req.user._id);
    res.status(201).json(group);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to create group' });
    if (error.code === 11000) return res.status(409).json({ message: 'You already have a group with this name' });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
  }
};

//set group Admins Controller
export const setGroupAdminsController = async (req, res) => {
  try{
    const admins = await setGroupAdminsService({
      groupId: req.params.groupId,
      targetUserId: req.params.userId,
      ownerId: req.user._id,
      role: req.body.role});
    res.status(201).json({success: true, message: "message role updated", data: admins});
      }
  catch(error){
    res.status(error.ststusCode || 500).json({message: error.message || "failed to set Admin"});
  }
}

// get all groups controller
export const getGroupsController = async (req, res) => {
  try {
    const groups = await Group.find({ type: "public", status: "ACTIVE" })
    .sort({ isDefault: -1, membercount: -1 })
    .lean();
     // One query for all listed groups: which of them is the user an active member of?
    const memberships = await GroupMember.find({
      userID: req.user._id,
      status: "active",
      groupID: { $in: groups.map((g) => g._id) },
    }).select("groupID").lean();
    const joinedIds = new Set(memberships.map((m) => String(m.groupID)));

    const data = groups.map((g) => ({ ...g, joined: joinedIds.has(String(g._id)) }));
    res.status(200).json({ success: true, message: "Groups fetched successfully", data });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch groups', error: error.message });
  }
};

// get my groups controller
export const getMyGroupsController = async (req, res) => {
  try {
    const userId = req.user._id;
    const memberships = await GroupMember.find({ userID: userId, status: "active" }).select("groupID").lean();
    const groups = await Group.find({ _id: { $in: memberships.map((m) => m.groupID) }, status: "ACTIVE" })
      .sort({ lastmessagedate: -1 });
      res.status(200).json({success: true, message: "Groups fetched successfully", data: groups});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch my groups', error: error.message });
  }
};

// get group by id controller
export const getGroupByIdController = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    // Private/premium groups are visible to their members only.
    if (group.type !== "public") {
      const isMember = await GroupMember.exists({ groupID: groupId, userID: req.user._id, status: "active" });
      if (!isMember) return res.status(404).json({ message: 'Group not found' });
    }
    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group', error: error.message });
  }
};      

// update group controller (owner/admin only)
export const updateGroupController = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const me = await GroupMember.findOne({ groupID: groupId, userID: req.user._id, status: "active" });
    if (!me || !["owner", "admin"].includes(me.role)) {
      return res.status(403).json({ message: 'Only the owner or an admin can update the group' });
    }

    // Only these fields are editable; ownerID, type, status, membercount stay protected.
    const updateData = {};
    for (const key of ["name", "description", "category"]) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Nothing to update. Allowed fields: name, description, category' });
    }
    if (updateData.name !== undefined &&
        (typeof updateData.name !== "string" || updateData.name.trim().length < 3 || updateData.name.trim().length > 50)) {
      return res.status(400).json({ message: 'Group name must be 3 to 50 characters' });
    }
    if (updateData.description !== undefined &&
        (typeof updateData.description !== "string" || updateData.description.length > 500)) {
      return res.status(400).json({ message: 'Description must be at most 500 characters' });
    }

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, { new: true, runValidators: true });
    if (!updatedGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update group', error: error.message });
  }
};
//upload/update group icon
export const updateGroupIconController = async(req, res)=>{
  try{
    const result = await updateGroupIconService({
      groupId:req.params.groupId,
      userId: req.user._id,
      file:req.file,
    });
    res.status(200).json({success: true, message: "Group icon update", data: result});
  }catch(error){
    res.status(error.statusCode || 500).json({message: error.message ||"Failed to update group icon"});
  }
};

// delete group controller (owner only)
export const deleteGroupController = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId).select("_id ownerID");
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    if (String(group.ownerID) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the owner can delete the group' });
    }

    // Remove everything that belongs to the group so nothing is left orphaned.
    await Promise.all([
      GroupMember.deleteMany({ groupID: groupId }),
      GroupMessage.deleteMany({ groupID: groupId }),
      Invite.deleteMany({ groupID: groupId }),
    ]);
    await Group.deleteOne({ _id: groupId });

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete group', error: error.message });
  }
};

// leave group controller
export const leaveGroupController = async (req, res) => {
  try {
   const leaveGroup = await leaveGroupService(req.params.groupId, req.user._id);
    if (!leaveGroup) {
      return res.status(404).json({ message: 'Group not found or user is not a member' });
    }
         res.status(200).json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to leave group' });
  }
};


// send invites controller
export const sendInvitesController = async (req, res) => {
  try {
    const result = await sendInvitesService(req.params.groupId, req.body.userIds, req.user._id);
    res.status(201).json({ success: true, message: 'Invites sent successfully', data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to send invites' });
  }

};

// accept invite controller
export const acceptInviteController = async (req, res) => {
  try {
    const result = await respondInviteService(req.params.inviteId, req.user._id, "accept");
    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to accept invite' });
  }
};


// reject invite controller
export const rejectInviteController = async (req, res) => {
  try {
    const result = await respondInviteService(req.params.inviteId, req.user._id, "reject");
    res.status(200).json({ success: true, message: result.message });
    
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to reject invite' });
  }
};

//get groups invite controller 
export const getGroupInvitesController = async (req, res) => {
  try {
    const invites = await getGroupInvitesService(req.params.groupId, req.user._id);
    res.status(200).json({ success: true, data: invites });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || 'Failed to get invites' });
  }
};



//joingroup controller
export const joinGroupController = async (req, res) => {
try{
  const joingroup = await joingroupservice(req.params.groupId, req.user._id);
  
    res.status(200).json({ success: true, message: joingroup.message, joined: joingroup.joined  });
}catch (error) 
{
res.status(error.statusCode || 500).json({ message: error.message || "failed to join group" });
}
}

// get all membrs controller 
export const getMembersController = async (req, res) => {
  try{
    const groupId = req.params.groupId;
     if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

     const group = await Group.findById(groupId).select("_id type status").lean();
      if (!group || group.status !== "ACTIVE") {
      return res.status(404).json({ message: 'Group not found' });
    }
     // Private/premium member lists are visible to their members only.
    if (group.type !== "public") {
      const isMember = await GroupMember.exists({ groupID: groupId, userID: req.user._id, status: "active" });
      if (!isMember) return res.status(404).json({ message: 'Group not found' });
    }
      const members = await GroupMember.find({ groupID: groupId, status: "active" })
      .populate("userID", "_id name profileImage")
      .lean();
    res.status(200).json({ success: true, data: members });
  }catch(error) {
     res.status(500).json({ message: "failed to get members" });
  }
}

//remove member controller (owner/admin only)
export const removeMemberController = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    // The person making the request must be an active owner or admin of this group.
    const me = await GroupMember.findOne({ groupID: groupId, userID: req.user._id, status: "active" });
    if (!me || !["owner", "admin"].includes(me.role)) {
      return res.status(403).json({ message: 'Only the owner or an admin can remove members' });
    }

    const target = await GroupMember.findOne({ groupID: groupId, userID: userId, status: "active" });
    if (!target) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }
    if (target.role === "owner") {
      return res.status(403).json({ message: 'The owner cannot be removed' });
    }
    if (target.role === "admin" && me.role !== "owner") {
      return res.status(403).json({ message: 'Only the owner can remove an admin' });
    }

    // Soft remove: keeps the record, and blocks messages via the status: "active" check.
    target.status = "removed";
    target.leftAt = new Date();
    await target.save();
    await Group.updateOne({ _id: groupId }, { $inc: { membercount: -1 } });

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove member', error: error.message });
  }
};

// get all group messages controller
export const getMessagesController = async (req, res) => {
  try {
    const result = await getGroupMessagesService({
      groupId: req.params.groupId,
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to get messages" });
  }
};



// send message controller
export const sendMessageController = async (req, res) => {
  try {
    const msg = await sendGroupMessageService({
      groupId: req.params.groupId,
      userId: req.user._id,
      message: req.body.message,
      messageType: req.body.messageType,
    });
    res.status(201).json({ success: true, data: msg });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to send message',
    });
  }
};




