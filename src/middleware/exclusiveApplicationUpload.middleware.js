import multer from "multer";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new Error(
        "Only JPG, PNG and PDF documents are allowed",
      ),
      false,
    );
  }

  callback(null, true);
};

export const exclusiveDocumentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});