import { env } from "./config/env"; // first on purpose: a bad configuration stops everything before anything else loads
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import applicationRoutes from "./routes/application.routes";
import resumeRoutes from "./routes/resume.routes";
import aiRoutes from "./routes/ai.routes";
import analyticsRoutes from "./routes/analytics.routes";
import interviewRoutes from "./routes/interview.routes";
import reminderRoutes from "./routes/reminder.routes";
import notificationRoutes from "./routes/notification.routes";
import { apiLimiter } from "./middleware/rateLimit.middleware";
import { noStore, requireTrustedOrigin } from "./middleware/security.middleware";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware";

// The Express application, built but NOT started. index.ts calls app.listen(); the tests
// import this file and hand `app` to supertest, which runs requests against it in memory
// without opening a port. That split is what makes the API testable.
const app = express();
app.disable("etag");

// Behind a hosting platform's proxy, every request appears to come from the proxy's address.
// TRUST_PROXY tells Express how many proxies to believe, so req.ip (used by the rate
// limiters) is the real visitor. It stays 0 on your own machine.
app.set("trust proxy", env.trustProxy);

// Security headers: no MIME sniffing, no framing, HSTS over HTTPS, and a strict default
// Content-Security-Policy. This server only returns JSON and file downloads, so the
// defaults are safe to keep as they are.
app.use(helmet());

app.use(
  cors({
    origin: env.clientOrigins,
    credentials: true,
  })
);

app.use("/api", noStore);

// Health check first, so a hosting platform probing it every few seconds can never be
// rate limited into thinking the app is down.
app.use("/api/health", healthRoutes);

app.use("/api", apiLimiter);
app.use(express.json({ limit: "100kb" })); // default is also 100kb; stated so it is a visible decision
app.use(cookieParser());
app.use("/api", requireTrustedOrigin);

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/notifications", notificationRoutes);

// Both must come AFTER every route. The error handler is recognised by taking 4 arguments.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;