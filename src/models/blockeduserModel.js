import mongoose from "mongoose";

const blockedUserSchema = new mongoose.Schema({
    blockerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    blockedID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

export default mongoose.model("BlockedUser", blockedUserSchema);