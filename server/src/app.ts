import { env } from "./config/env"; // first on purpose: a bad configuration stops everything before anything else loads
import fs from "fs";
import path from "path";
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
// Content-Security-Policy. The built React app loads only its own scripts and styles, so the
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

// Hosted mode: this one server also serves the built React app (client/dist).
//
// Why: the browser then talks to a single address for pages AND API. The login cookie is
// first-party, CORS never comes into play, and there is one thing to deploy instead of two.
//
// It sits AFTER the API routes so /api/... is always answered by the API, and BEFORE the
// 404 handler so a page refresh on a client-side route like /analytics still loads the app.
if (env.serveClient) {
  const indexHtml = path.join(env.clientDistDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    // Fail at startup with a clear message, not with a confusing 404 on the first page view.
    throw new Error(
      `SERVE_CLIENT=true but ${indexHtml} does not exist. Run "npm run build" in client/ first, ` +
        `or set CLIENT_DIST_DIR to the folder that contains the built app.`
    );
  }

  // Built files have a hash in their name (app-3f9a1c.js), so a changed file gets a new name
  // and the old one can be cached for a year.
  app.use(
    "/assets",
    express.static(path.join(env.clientDistDir, "assets"), { index: false, immutable: true, maxAge: "1y" })
  );
  app.use(express.static(env.clientDistDir, { index: false })); // favicon and other loose files

  // Any other GET is a client-side route: answer with the app and let React Router decide.
  // Not for /api (let it fall through to the JSON 404) and not for anything that looks like a
  // file (a missing /assets/x.js must be a real 404, not an HTML page the browser tries to run).
  app.get(/.*/, (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) return next();
    if (path.extname(req.path)) return next();
    res.sendFile(indexHtml, { headers: { "Cache-Control": "no-cache" } }); // always fetch the latest index.html
  });
}

// Both must come AFTER every route. The error handler is recognised by taking 4 arguments.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;