export const registerChatSocket = (io, socket) => {
  /*
   * JOIN CHAT
   */
  socket.on(
    "chat:join",
    ({ chatId }, callback) => {
      try {
        if (!chatId) {
          return callback?.({
            success: false,
            message: "Chat ID is required",
          });
        }

        const roomName = `chat:${chatId}`;

        socket.join(roomName);

        console.log(
          `💬 User ${socket.userId} joined ${roomName}`
        );

        callback?.({
          success: true,
          message: "Chat joined successfully",
        });
      } catch (error) {
        console.log(
          "chat:join error:",
          error.message
        );

        callback?.({
          success: false,
          message: "Unable to join chat",
        });
      }
    }
  );

  /*
   * LEAVE CHAT
   */
  socket.on("chat:leave", ({ chatId }) => {
    if (!chatId) return;

    const roomName = `chat:${chatId}`;

    socket.leave(roomName);

    console.log(
      `🚪 User ${socket.userId} left ${roomName}`
    );
  });

  /*
   * SEND MESSAGE
   *
   * Temporary.
   * MongoDB integration next step me karenge.
   */
  socket.on(
    "message:send",
    (data, callback) => {
      try {
        const {
          chatId,
          receiverId,
          message,
        } = data;

        if (!chatId) {
          return callback?.({
            success: false,
            message: "Chat ID is required",
          });
        }

        if (!receiverId) {
          return callback?.({
            success: false,
            message: "Receiver ID is required",
          });
        }

        if (!message?.trim()) {
          return callback?.({
            success: false,
            message: "Message is required",
          });
        }

        const newMessage = {
          _id: Date.now().toString(),

          chatId,

          senderId: socket.userId,

          receiverId,

          message: message.trim(),

          messageType: "TEXT",

          status: "SENT",

          createdAt: new Date(),
        };

        /*
         * Open chat screen
         */
        io
          .to(`chat:${chatId}`)
          .emit(
            "message:new",
            newMessage
          );

        /*
         * Receiver's personal room
         * Chat list update ke liye.
         */
        io
          .to(`user:${receiverId}`)
          .emit(
            "chat:update",
            newMessage
          );

        console.log(
          `📨 Message sent by ${socket.userId} to ${receiverId}`
        );

        callback?.({
          success: true,
          message: "Message sent successfully",
          data: newMessage,
        });
      } catch (error) {
        console.log(
          "message:send error:",
          error.message
        );

        callback?.({
          success: false,
          message: "Unable to send message",
        });
      }
    }
  );

  /*
   * TYPING START
   */
  socket.on(
    "typing:start",
    ({ chatId }) => {
      if (!chatId) return;

      socket
        .to(`chat:${chatId}`)
        .emit("typing:start", {
          chatId,
          userId: socket.userId,
        });
    }
  );

  /*
   * TYPING STOP
   */
  socket.on(
    "typing:stop",
    ({ chatId }) => {
      if (!chatId) return;

      socket
        .to(`chat:${chatId}`)
        .emit("typing:stop", {
          chatId,
          userId: socket.userId,
        });
    }
  );
};