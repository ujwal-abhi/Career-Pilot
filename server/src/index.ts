import { env } from "./config/env"; // first on purpose: a bad configuration stops the server before anything else loads
import app from "./app";
import prisma from "./config/db";
import { ensureUploadDir } from "./services/storage.service";

async function startServer() {
  await ensureUploadDir();
  const server = app.listen(env.port, () => {
    console.log(`CareerPilot server running on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // Hosting platforms stop a server with SIGTERM when they deploy a new version. Finish
  // in-flight requests and close the database connection instead of cutting them off.
  let shuttingDown = false;
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // do not hang forever
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// A promise that rejects with nobody listening is a bug. Log it with its stack instead of
// letting Node print a one-line warning or exit without context.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

startServer().catch((error) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});