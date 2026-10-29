import {Router} from 'express'; 
import { uploadProfileImage } from '../../utils/upload.js';
import { isAuthenticated } from '../../middleware/auth.middleware.js';
import { 
getMyGroupsController, 
getGroupsController,
getGroupByIdController, 
updateGroupController, 
createGroupController, 
deleteGroupController,
leaveGroupController,
sendInvitesController,
joinGroupController,
getMembersController,
getMessagesController,
sendMessageController,
removeMemberController,
acceptInviteController,
rejectInviteController,
getGroupInvitesController,
updateGroupIconController,
setGroupAdminsController
 } from './groups.controller.js';  
    
const router = Router();

//create and get groups
router.post('/create', isAuthenticated, createGroupController);
router.get("/discover", isAuthenticated, getGroupsController);        // get public groups
router.get("/mine", isAuthenticated, getMyGroupsController);           // get my groups
router.patch("/icon/:groupId", isAuthenticated,  uploadProfileImage.single("icon"), updateGroupIconController);

// ── Single group ───────────────────────────────────────────
router.get("/:groupId",isAuthenticated, getGroupByIdController);
router.patch("/:groupId",isAuthenticated, updateGroupController);              // Admins/owners only
router.delete("/:groupId",isAuthenticated, deleteGroupController);             // private, owner only
router.post("/leave/:groupId",isAuthenticated, leaveGroupController);

// set Admins route
router.patch("/:groupId/setAdmin/:userId", isAuthenticated, setGroupAdminsController);
// invites (private)
router.post("/invites/:groupId",isAuthenticated, sendInvitesController);
router.post("/invites/:inviteId/accept", isAuthenticated, acceptInviteController);
router.post("/invites/:inviteId/reject", isAuthenticated, rejectInviteController);
router.get("/invites/list/:groupId", isAuthenticated, getGroupInvitesController);

// join group (public)
router.post("/join/:groupId",isAuthenticated, joinGroupController);

// get all members of a group
router.get("/members/:groupId",isAuthenticated, getMembersController);
//delete a member 
router.delete("/:groupId/members/:userId",isAuthenticated, removeMemberController);          // private only

//get group all messages
router.get("/messages/:groupId",isAuthenticated, getMessagesController);
router.post("/messages/:groupId",isAuthenticated, sendMessageController);

export default router;