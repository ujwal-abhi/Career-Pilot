import { randomUUID } from "node:crypto";
import { beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import prisma from "../../src/config/db";
import { env } from "../../src/config/env";
import { AUTH_COOKIE_NAME } from "../../src/config/cookie";
import { hashPassword } from "../../src/utils/password.util";
import { signToken } from "../../src/utils/jwt.util";

// Empties every table. Refuses to run unless the connected database is a _test one, even
// though the config already guarantees it: wiping the wrong database is not recoverable.
export async function resetDatabase() {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!db.endsWith("_test")) {
    throw new Error(`Refusing to wipe database "${db}": its name does not end in _test.`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((table) => `"${table.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
}

// Deletes files uploaded during a test (they go to a temporary folder, not your real uploads).
export async function clearUploads() {
  await fs.rm(env.uploadDir, { recursive: true, force: true });
  await fs.mkdir(env.uploadDir, { recursive: true });
}

export async function listUploadedFiles(): Promise<string[]> {
  try {
    return await fs.readdir(env.uploadDir);
  } catch {
    return [];
  }
}

export const TEST_PASSWORD = "correct-horse-battery";

// Hashing is deliberately slow, so hash once and reuse for every test user in a file.
let cachedHash: string | undefined;

// The Cookie header value for a logged-in user. Signing the token directly skips the login
// request, so tests that are NOT about login do not use up the login and register limits.
export function cookieFor(userId: string): string {
  return `${AUTH_COOKIE_NAME}=${signToken({ userId })}`;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  cookie: string;
}

export async function createUser(label = "user"): Promise<TestUser> {
  cachedHash ??= await hashPassword(TEST_PASSWORD);
  const email = `${label}-${randomUUID().slice(0, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: `Test ${label}`, password: cachedHash },
  });
  return { id: user.id, email, name: user.name, password: TEST_PASSWORD, cookie: cookieFor(user.id) };
}

// Fixed reference point for building times: tests that create dates relative to "now".
export const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);
export const daysFromNow = (days: number) => hoursFromNow(days * 24);

// Call once at the top of an API test file. Starts the file with an empty database and an
// empty upload folder, and closes the database connection when the file is done.
export function useCleanDatabase() {
  beforeAll(async () => {
    await resetDatabase();
    await clearUploads();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
}