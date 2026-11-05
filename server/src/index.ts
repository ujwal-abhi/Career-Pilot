import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import applicationRoutes from "./routes/application.routes";
import resumeRoutes from "./routes/resume.routes";
import aiRoutes from "./routes/ai.routes";
import analyticsRoutes from "./routes/analytics.routes";
import interviewRoutes from "./routes/interview.routes"; // NEW
import reminderRoutes from "./routes/reminder.routes"; // NEW
import notificationRoutes from "./routes/notification.routes"; // NEW
import { ensureUploadDir } from "./services/storage.service";

dotenv.config();

const app = express();
app.disable("etag");
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/interviews", interviewRoutes); // NEW
app.use("/api/reminders", reminderRoutes); // NEW
app.use("/api/notifications", notificationRoutes); // NEW

// Error-handling middleware: Express recognizes this as an error handler
// specifically because it takes 4 arguments (err, req, res, next).
// It must be registered AFTER all routes.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File is too large (max 5MB)." });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message === "ONLY_PDF_ALLOWED") {
    return res.status(400).json({ success: false, message: "Only PDF files are allowed." });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: "Something went wrong." });
});

async function startServer() {
  await ensureUploadDir();
  app.listen(PORT, () => {
    console.log(`CareerPilot server running on http://localhost:${PORT}`);
  });
}

startServer();