import ImageKit from "imagekit";
import multer from "multer";

import ApiError from "../../utils/api.error.js";

const {
  IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_URL_ENDPOINT,
} = process.env;

if (
  !IMAGEKIT_PUBLIC_KEY ||
  !IMAGEKIT_PRIVATE_KEY ||
  !IMAGEKIT_URL_ENDPOINT
) {
  throw new Error(
    "ImageKit environment variables are missing",
  );
}

const imagekit = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL_ENDPOINT,
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new ApiError(
        400,
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

export const uploadExclusiveDocument = async (
  file,
) => {
  if (!file?.buffer) {
    throw new ApiError(
      400,
      "Verification document is required",
    );
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new ApiError(
      400,
      "Only JPG, PNG and PDF documents are allowed",
    );
  }

  const safeFileName = file.originalname
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  try {
    const uploadedDocument =
      await imagekit.upload({
        file: file.buffer.toString("base64"),
        fileName: `exclusive-${Date.now()}-${safeFileName}`,
        folder: "/MeetZo/ExclusiveApplications",
        useUniqueFileName: true,
      });

    return {
      url: uploadedDocument.url,
      fileId: uploadedDocument.fileId,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };
  } catch (error) {
    console.error(
      "ImageKit upload error:",
      error.message,
    );

    throw new ApiError(
      500,
      "Failed to upload verification document",
    );
  }
};

export const deleteExclusiveDocument = async (
  fileId,
) => {
  if (!fileId) {
    return;
  }

  try {
    await imagekit.deleteFile(fileId);
  } catch (error) {
    console.error(
      "ImageKit document deletion failed:",
      error.message,
    );
  }
};

export default imagekit;