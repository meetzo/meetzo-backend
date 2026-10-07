import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Participant State
|--------------------------------------------------------------------------
|
| Har participant ka chat-specific state.
|
| Example:
| User A unread = 0
| User B unread = 4
|
*/

const participantStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastReadAt: {
      type: Date,
      default: null,
    },

    /*
     * User individually chat archive kar sakta hai.
     */
    isArchived: {
      type: Boolean,
      default: false,
    },

    /*
     * Delete chat only for this user.
     * Actual conversation/messages immediately remove nahi honge.
     */
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Chat Schema
|--------------------------------------------------------------------------
*/
const chatSchema = new mongoose.Schema(
  {
    /*
     * 1-to-1 chat ke liye exactly 2 users.
     */
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],

      required: true,

      validate: [
        {
          validator: function (value) {
            return value.length === 2;
          },

          message:
            "A direct chat must contain exactly two participants",
        },

        {
          validator: function (value) {
            if (value.length !== 2) {
              return false;
            }

            return (
              value[0].toString() !==
              value[1].toString()
            );
          },

          message:
            "A user cannot create a chat with themselves",
        },
      ],
    },

    /*
     * Duplicate chat prevent karega.
     *
     * Example:
     *
     * userA = aaa
     * userB = bbb
     *
     * pairKey = aaa_bbb
     *
     * IDs always sorted before creating.
     */
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /*
     * Per-user unread/read/archive state.
     */
    participantStates: {
      type: [participantStateSchema],
      default: [],
    },

    /*
     * Chat list me latest message show karne ke liye.
     */
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },

    /*
     * Entire conversation active hai ya nahi.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);


/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

/*
 * User ki chat list efficiently fetch karne ke liye.
 */
chatSchema.index({
  participants: 1,
  lastMessageAt: -1,
});


const ChatModel = mongoose.model(
  "Chat",
  chatSchema
);

export default ChatModel;