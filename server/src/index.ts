import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";

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

app.listen(PORT, () => {
  console.log(`CareerPilot server running on http://localhost:${PORT}`);
});