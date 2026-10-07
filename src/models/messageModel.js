import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: null,
    },

    thumbnailUrl: {
      type: String,
      default: null,
    },

    fileName: {
      type: String,
      default: null,
    },

    fileId: {
      type: String,
      default: null,
    },

    mimeType: {
      type: String,
      default: null,
    },
  
    fileSize: {
      type: Number,
      default: null,
    },

    duration: {
      type: Number,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Message Schema
|--------------------------------------------------------------------------
*/


const messageSchema = new mongoose.Schema(
  {
    /*
     * Kis conversation ka message hai.
     */
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    /*
     * Message sender.
     */
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
     * 1-to-1 chat hai isliye receiver store karna useful hai.
     */
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
     * Flutter har outgoing message ke liye UUID generate karega.
     *
     * Internet retry/reconnection me duplicate message
     * create hone se prevent karega.
     */
    clientMessageId: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * TEXT content.
     */
    message: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    /*
     * Message type.
     */
    messageType: {
      type: String,

      enum: [
        "TEXT",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        "FILE",
      ],

      default: "TEXT",
    },

    /*
     * Media message metadata.
     */
    media: {
      type: mediaSchema,
      default: null,
    },

    /*
     * Delivery status.
     */
    status: {
      type: String,

      enum: [
        "SENT",
        "DELIVERED",
        "READ",
      ],

      default: "SENT",

      index: true,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    readAt: {
      type: Date,
      default: null,
    },

    /*
     * Edit message support.
     */
    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    /*
     * Delete for everyone.
     */
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    deletedForEveryoneAt: {
      type: Date,
      default: null,
    },

    /*
     * Delete only for individual user.
     *
     * Example:
     * User A deletes message for himself.
     * User B can still see it.
     */
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);


/*
|--------------------------------------------------------------------------
| Validations
|--------------------------------------------------------------------------
*/

messageSchema.pre("validate", function () {
  // A deleted message is a content-free tombstone visible to both participants.
  if (this.isDeletedForEveryone) return;

  /*
   * TEXT message me actual text hona compulsory.
   */

  if (
    this.messageType === "TEXT" &&
    !this.message?.trim()
  ) {
    throw new Error("Text message cannot be empty");
  }

  /*
   * Media message me media URL compulsory.
   */

  if (
    this.messageType !== "TEXT" &&
    !this.media?.url
  ) {
    throw new Error("Media URL is required for media messages");
  }
});


/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

/*
 * Duplicate message protection.
 *
 * Same sender same clientMessageId
 * dobara save nahi kar sakta.
 */
messageSchema.index(
  {
    senderId: 1,
    clientMessageId: 1,
  },
  {
    unique: true,
  }
);


/*
 * Most important query:
 *
 * Give me latest messages of this chat.
 */
messageSchema.index({
  chatId: 1,
  createdAt: -1,
});


/*
 * Unread/delivery queries.
 */
messageSchema.index({
  receiverId: 1,
  status: 1,
  createdAt: -1,
});


const MessageModel = mongoose.model(
  "Message",
  messageSchema
);

export default MessageModel;