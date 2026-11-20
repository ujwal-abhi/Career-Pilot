import "dotenv/config"; // so TEST_DATABASE_URL / DATABASE_URL from server/.env are visible below
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Which database the API tests use:
//   1. TEST_DATABASE_URL from server/.env, if you set it;
//   2. otherwise your DATABASE_URL with "_test" added to the database name
//      (.../careerpilot -> .../careerpilot_test);
//   3. otherwise a local default, so the pure unit tests still run with no .env at all.
// tests/globalSetup.ts then REFUSES to continue unless the name ends in _test.
function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const dev = process.env.DATABASE_URL?.trim();
  if (dev) {
    const url = new URL(dev);
    url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
    return url.toString();
  }
  return "postgresql://postgres:postgres@localhost:5432/careerpilot_test";
}

// Everything the server reads at startup (see src/config/env.ts), set explicitly for tests so
// a test run never depends on, or touches, your development .env values.
const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl(),
  JWT_SECRET: "test-secret-that-is-long-enough-to-pass-validation-0123456789",
  CLIENT_URL: "http://localhost:5173",
  COOKIE_SAME_SITE: "lax",
  TRUST_PROXY: "0",
  UPLOAD_DIR: path.join(os.tmpdir(), "careerpilot-test-uploads"),
};

export default defineConfig({
  test: {
    env: testEnv,
    testTimeout: 20_000,
    projects: [
      {
        // Pure logic: no database, no server, runs in milliseconds.
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        // The real Express app against a real (test) PostgreSQL database. Files run one at a
        // time because they share that database and wipe it between files.
        extends: true,
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts"],
          globalSetup: ["tests/globalSetup.ts"],
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/scripts/**", "src/index.ts", "src/types/**", "src/scratch*"],
      reporter: ["text-summary", "text", "html"],
    },
  },
});