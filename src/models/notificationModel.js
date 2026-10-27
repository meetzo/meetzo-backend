import mongoose from "mongoose";

// Device Token Schema
const  deviceTokenSchema = new mongoose.Schema({
    userId:{
         type: mongoose.Schema.Types.ObjectId,
         ref: "User",
         required: true,
         index: true
         },
    token:{
         type: String,
         required: true, 
         unique: true 
        },   // one device = one owner
    platform:{
         type: String, 
         enum: ["android", "ios", "web"], 
         required: true
         },
    lastSeenAt:{
         type: Date,
         default: Date.now
         },
    // sha256 of the JWT that registered this device, so logout can remove it
    sessionHash:{
         type: String,
         index: true
         },
},
{ timestamps: true }
);

const deviceToken = mongoose.model("deviceToken", deviceTokenSchema);

export { deviceToken };