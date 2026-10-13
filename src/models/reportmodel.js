import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    reportedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    evidance: {
        type: String,
        required: false
    },
    status:{
        type: String,
        enum: ["pending", "resolved", "rejected", "in_review", "dismissed"],
        default: "pending"
    },
    action_taken:{
        type: String,
        enum: ["none", "warning", "suspended", "banned"],
        required: false,
        default: "none"
    }

}, { timestamps: true });

export default mongoose.model("Report", reportSchema);