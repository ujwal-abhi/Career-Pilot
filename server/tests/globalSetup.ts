import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { assertTestDatabase, databaseNameOf } from "./testDatabase";

// Runs ONCE before the API tests start:
//   1. makes sure the test database exists (creates it if not),
//   2. applies every migration to it, so its tables match prisma/schema.prisma.
// Re-running is cheap: migrations already applied are skipped.
export default async function setup(project: TestProject) {
  // The URL comes from vitest.config.mts (test.env), so there is one source of truth.
  const url = assertTestDatabase(project.config.env.DATABASE_URL as string);
  const name = databaseNameOf(url);

  // To create a database you must be connected to a different one, so connect to the
  // built-in "postgres" database on the same server first.
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";
  const client = new Client({ connectionString: maintenanceUrl.toString() });
  try {
    await client.connect();
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (found.rowCount === 0) {
      // `name` is checked above to be only letters, digits and underscores, so quoting it is safe.
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`[tests] created database ${name}`);
    }
  } catch (error) {
    throw new Error(
      `Could not reach or create the test database "${name}". Is PostgreSQL running, and can the ` +
        `user in DATABASE_URL create databases? Create it yourself with:  CREATE DATABASE ${name};\n` +
        `Original error: ${(error as Error).message}`
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  // Prisma's own CLI applies the migration files. DATABASE_URL is overridden for this one
  // command, so it targets the test database and never your development one.
  // TEST_SKIP_MIGRATE=1 skips this step, for a machine where the schema is already in place.
  if (process.env.TEST_SKIP_MIGRATE === "1") return;
  try {
    execSync("npx prisma migrate deploy", {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (error) {
    const output = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `"npx prisma migrate deploy" failed for ${name}:\n${output.stdout?.toString() ?? ""}${output.stderr?.toString() ?? ""}`
    );
  }
}