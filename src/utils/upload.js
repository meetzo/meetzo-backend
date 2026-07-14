import multer from "multer";

export const uploadProfileImage = multer({
  storage: multer.memoryStorage(), // 🔥 required for sharp
  limits: {
    fileSize: 6 * 1024 * 1024, 
    // 5MB max input
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

