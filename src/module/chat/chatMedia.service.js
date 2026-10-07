import ApiError from "../../utils/api.error.js";
import imageKit from "../profile/imageKit.service.js";

const classifyMediaType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "FILE";
};

const sanitizeFileName = (fileName) =>
  fileName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 150) || "attachment";

export const uploadChatMediaService = async ({ file }) => {
  if (!file?.buffer) {
    throw new ApiError(400, "Select a file to send");
  }

  const safeFileName = sanitizeFileName(file.originalname);

  try {
    const uploadedFile = await imageKit.upload({
      file: file.buffer.toString("base64"),
      fileName: `chat-${Date.now()}-${safeFileName}`,
      folder: "/MeetZo/ChatMedia",
      useUniqueFileName: true,
    });

    return {
      type: classifyMediaType(file.mimetype),
      media: {
        url: uploadedFile.url,
        fileId: uploadedFile.fileId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    };
  } catch (error) {
    console.error("Chat media upload failed:", error.message);
    throw new ApiError(502, "Unable to upload chat media");
  }
};

export const deleteChatMediaService = async (fileId) => {
  if (!fileId) return;

  try {
    await imageKit.deleteFile(fileId);
  } catch (error) {
    console.error("Unable to remove unlinked chat media:", error.message);
  }
};
