import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./module/auth/auth.routes.js";
import profileRoutes from "./module/profile/profile.routes.js";
import errormiddleware from "./middleware/error.middleware.js";
import exclusiveApplicationRoutes from "./module/meetzo_exclusive/exclusiveApplication.routes.js";
import matchRoutes from "./module/matches/matches.routes.js";
import multer from "multer";
import likeRoute from "./module/likes/likes.routes.js";
import chatRoutes from "./module/chat/chat.routes.js";
import discoveryRoutes  from "./module/discovery/discovery.routes.js"
import idsRoutes from "./module/aadhar/ids.routes.js";
import subscriptionRoutes from "./module/subscription/subscription.routes.js"
import reportRoutes from "./module/reports/report.routes.js";
import blockUserRoutes from "./module/block/blockuser.routes.js";
import "dotenv/config";

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test route
app.get("/test", (req, res) => {
  console.log("✅ TEST ROUTE HIT");
  return res.status(200).json({
    success: true,
    message: "Meetzo App is working",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

app.use("/api/exclusive-applications", exclusiveApplicationRoutes);

app.use("/api/like", likeRoute);
app.use("/api/match", matchRoutes)
app.use("/api/chat", chatRoutes);
app.use("/api/discovery", discoveryRoutes);
app.use("/api/kyc", idsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/block", blockUserRoutes);


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
