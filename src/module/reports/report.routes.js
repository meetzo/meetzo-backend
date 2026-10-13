import express from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { isadmin } from "./report.auth.js";
import {
  createReportController,
  getmyReportsController,
  getReportedusersController,
  getAllReportedUsersController,
  changeReportStatusController

} from "./report.controller.js";        

const router = express.Router();

//create Report 
router.post("/:userId", isAuthenticated, createReportController);
//reports on me 
router.get("/", isAuthenticated, getmyReportsController);
// reports I have made  
router.get("/user", isAuthenticated, getReportedusersController);
// Admin route to get all reported users
router.get("/reported-users", isAuthenticated, isadmin, getAllReportedUsersController);
//change report status
router.patch("/status/:reportId", isAuthenticated, isadmin,changeReportStatusController);    
export default router;