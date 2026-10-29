import { Router } from "express";
import { isAuthenticated } from '../../middleware/auth.middleware.js';
//import { authorizeAdmin } from '../../middleware/admin.middleware.js';
import {
  registerTokenController, logoutController,
} from './notifications.controller.js';

const router = Router();

//Register token Route for configuring the Device token
router.post("/register-token", isAuthenticated, registerTokenController);
//triggering notification or sending notification to push service (FCM or APNs)
//only Admins can push notification
//router.post("/send", isAuthenticated,authorizeAdmin, sendNotificationController);
// get all notifications 
//router.get("/", isAuthenticated, listNotificationsController);
//unread notification 
//router.get("/unread-count", isAuthenticated, unreadCountController);
//stop notification when user logged out
router.delete("/logout-token", isAuthenticated,logoutController);

export default router;