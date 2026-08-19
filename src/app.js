import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './module/auth/auth.routes.js';
import errormiddleware from './middleware/error.middleware.js'
import profileRoutes from "./module/profile/profile.routes.js";
const app = express();



app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use(
  "/api/profile",
  profileRoutes
);

import multer from "multer";

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Profile picture must be smaller than 5 MB",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
});


app.use(errormiddleware);

export default app;