import {
    createReportservice,
    getMyReportservice,
    getReportedUserservice,
    getAllReportedUserservice,
    changeReportStatusservice
} from "./report.service.js";

export const createReportController = async (req, res, next) => {
    try {
        const report = await createReportservice(req.user._id, req.params.userId, req.body);
        res.status(201).json(report);
    } catch (error) {
        next(error);
    }
};

//get my reports controller
export const getmyReportsController = async (req, res, next) => {
    try {
        const reports = await getMyReportservice(req.user._id, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
        res.json(reports);
    } catch (error) {
        next(error);
    }
};

//get reported users by userId 
export const getReportedusersController = async (req, res, next) => {
    try {
        const users = await getReportedUserservice(req.user._id, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
        res.json(users);
    } catch (error) {
        next(error);
    }
};

//Admin controller to get all reported users
export const getAllReportedUsersController = async (req, res, next) => {
    try {
        const users = await getAllReportedUserservice(parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
        res.json(users);
    } catch (error) {
        next(error);
    }
};

// Admin controller to change report status
export const changeReportStatusController = async (req, res, next) => {
    try {
        const updatedReport = await changeReportStatusservice(req.params.reportId, req.body.status);
        res.json(updatedReport);
    } catch (error) {
        next(error);
    }
}