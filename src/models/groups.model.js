import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["public", "private", "premium"],
        required: true
    },
    ownerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["ACTIVE","BANNED"],
        default: "ACTIVE"
    },
    category: {
        type: String,
        required: true
    },
    membercount: {
        type: Number,
        default: 0
    },
    lastmessageID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMessage"
    },
    lastmessagedate: {
        type: Date
    },
    isDefault:{
        type:Boolean,
        default: false
    }
},
{
    timestamps: true
});
// restrict duplicate group creation
groupSchema.index(
  { ownerID: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
const Group = mongoose.model("Group", groupSchema);

// invites schema to send invites to users to join the group
const inviteSchema = new mongoose.Schema({
    groupID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled"],
        default: "pending"
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    respondedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    respondedAt:{
        type: Date
    },
},
{
    timestamps: true
});
// stops the same user from getting duplicate pending invites to one group
inviteSchema.index(
  { groupID: 1, userID: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

const Invite = mongoose.model("Invite", inviteSchema);




//group members schema to store the members of the group and their roles

const groupMemberSchema = new mongoose.Schema({
    groupID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    role: {
        type: String,
        enum: ["member", "admin", "owner"],
        default: "member"       
    },
    status: {
        type: String,
        enum: ["active", "left", "banned", "removed"],
        default: "active"
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    leftAt: {
        type: Date,
        default: null
    },
    lastreadmessageID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GroupMessage",
        default: null
    },
},
{
    timestamps: true
});
groupMemberSchema.index({ groupID: 1, userID: 1 }, { unique: true });

const GroupMember = mongoose.model("GroupMember", groupMemberSchema);



//group messages schema to store the messages of the group
const groupMessageSchema = new mongoose.Schema({
    groupID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    senderID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        
    },
    message: {
        type: String
        
    },
    messageType: {
        type: String,
        enum: ["text", "image", "video","system", "file"],  
        default: "text" 
    },
    isedited: {
        type: Boolean,
        default: false      
    },
    isdeleted: {
        type: Boolean,
        default: false      
    },
    systemEvent: {
        type: {
            type: String,
            enum: ["GROUP_CREATED", "MEMBER_JOINED", "MEMBER_LEFT", "MEMBER_REMOVED"],
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    }
},
{
    timestamps: true
}
);

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);


export { Group, Invite, GroupMember, GroupMessage };