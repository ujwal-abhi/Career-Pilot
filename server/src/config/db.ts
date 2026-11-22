import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

// A small connection pool on purpose. Free database plans allow few simultaneous connections,
// and this app is one small server. Idle connections are closed after 30 seconds so we never
// hold one that Neon has already dropped while its compute was asleep; the next request just
// opens a fresh one (the first request after a long idle takes a moment while Neon wakes up).
const adapter = new PrismaPg(
  {
    connectionString: env.databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  },
  {
    // The driver already survives these; this only makes them visible in the logs.
    onPoolError: (error: Error) => {
      console.error("[db] connection error on an idle connection:", error.message);
    },
  }
);

const prisma = new PrismaClient({ adapter });

export default prisma;