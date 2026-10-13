import ReportModel from "../../models/reportmodel.js";
import UserModel from "../../models/userModel.js";




const createReportservice = async (reporterId, reportedUserId, reportData) => {
  const { reason, description, } = reportData;

    // Check if the reported user exists, not blocked 
    const reportedUser = await UserModel.findById(reportedUserId);
    if (!reportedUser) {
        throw new Error("Reported user not found");
    }
    if (reportedUser.isBlocked === true) {
        throw new Error("User is already blocked");
    }

    if (reporterId.toString() === reportedUserId) {
    throw new Error("You cannot report yourself");
  }
    

    // Create the report
    const report = new ReportModel({
        userId: reporterId,
        reportedUserId,
        reason,
        description,
        

    });

    return await report.save();
};

//export { createReportservice, getMyReportservice, getReportedUserservice };



// Fetch reports made on the authenticated user
 const getMyReportservice = async (userId) => {
        return await ReportModel.find({ reportedUserId: userId }).populate("userId", "username email");
   };


const getReportedUserservice = async (userId, page = 1, limit = 20) => {
     return ReportModel.find({ userId })
       .sort({ createdAt: -1 })
       .skip((page - 1) * limit)
       .limit(limit)
       .populate("userId", "username profileImage")
       .lean();
}

// Admin route to get all reported users
const getAllReportedUserservice = async (page = 1, limit = 20) => {
    return ReportModel.find()   
       .sort({ createdAt: -1 })
       .skip((page - 1) * limit)
       .limit(limit)
       .populate("userId", "username email")
       .populate("reportedUserId", "username profileImage")
       .lean();
}

// Admin service to change report status
const changeReportStatusservice = async (reportId, status) => {
    const report = await ReportModel.findById(reportId);
    if (!report) {
        throw new Error("Report not found");
    }
    report.status = status;
    return await report.save();
}

export { createReportservice, getMyReportservice, getReportedUserservice, getAllReportedUserservice, changeReportStatusservice };