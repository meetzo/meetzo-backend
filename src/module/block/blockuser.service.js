import UserModel from "../../models/userModel.js";
import BlockedUser from "../../models/blockeduserModel.js";

export const blockUserservice = async (blockedID, blockerID) => {
    // Check if the user exists
    const user = await UserModel.findById(blockedID);
    if (!user) {
       return { message: "User not found" };
    }
    if (String(blockedID) === String(blockerID)) {
        throw new Error("You cannot block yourself");
    }

    // Check if the user is already blocked
    const existingBlockedUser = await BlockedUser.findOne({ 
        blockedID, blockerID
    });
    if (existingBlockedUser) {
        return { message: "User is already blocked" };
    }

    const newblock = new BlockedUser({
        blockerID, blockedID
    });
    await newblock.save();
    return { message: "User blocked successfully" };
}; 

export const getBlockedUsersservice = async () => {
    const blockedUsers = await BlockedUser.find({ }).populate("blockerID", "name email profileImage").populate("blockedID", "name email profileImage");
    return blockedUsers;
};



export const unblockUserservice = async (blockerID, blockedID) => {
    // Check if the blocked user exists
    const blockedUser = await BlockedUser.findOne({ blockerID, blockedID });
    if (!blockedUser) {
        return { message: "Blocked user not found" };
    }
    await blockedUser.deleteOne({ blockerID, blockedID });

    return { message: "User unblocked successfully" };
};

//restrict user service
export const restrictUserService = async (userId, isBlocked) => {
    const user = await UserModel.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    // Check if the user is already restricted  
    if (user.isBlocked === isBlocked) {
        return { message: `User is already ${isBlocked ? "restricted" : "un-restricted"}` };
    }
    
    user.isBlocked = isBlocked;
    await user.save();
    return { message: `User  successfully ${isBlocked ? "restricted" : "un-restricted"}` };
};