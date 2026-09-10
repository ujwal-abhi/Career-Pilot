import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/health", healthRoutes);

app.listen(PORT, () => {
  console.log(`CareerPilot server running on http://localhost:${PORT}`);
});