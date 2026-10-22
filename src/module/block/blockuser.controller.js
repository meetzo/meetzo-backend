import {
    blockUserservice,
    getBlockedUsersservice,
    unblockUserservice,
    restrictUserService
} from './blockuser.service.js';

//block user controller
export const blockUserController = async (req, res, next) => {
    try {
        const  blockedId  = req.params.blockedId;
        const blockerId = req.user._id;
        const result = await blockUserservice(blockedId, blockerId);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// get blocked users controller
export const getBlockedUsersController = async (req, res, next) => {
    try {
        const result = await getBlockedUsersservice();
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

//unblock user controller 
export const unblockUserController = async (req, res, next) => {
    try {
        const  blockedID  = req.params.blockedId;
        const blockerID = req.user._id;
        const result = await unblockUserservice(blockerID, blockedID);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

//restrict user controller
export const restrictUserController = async (req, res, next) => {
    try {
        const restrict = await restrictUserService(req.params.userId, req.body.isBlocked);
        res.status(200).json(restrict);
    } catch (error) {
        next(error);
    }   
};