import multer from "multer";

const storage = multer.memoryStorage();

export const uploadProfilePicture = multer({
  storage,
  limits: {
    fileSize: 6 * 1024 * 1024, // 6 MB
  },
});