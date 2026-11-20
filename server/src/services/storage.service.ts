import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";

// Where uploaded resumes live. Configurable (UPLOAD_DIR) for two reasons: tests write to a
// temporary folder instead of your real uploads, and a hosting platform keeps files on a
// mounted disk whose path you choose.
const UPLOAD_DIR = env.uploadDir;

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function getUploadDir() {
  return UPLOAD_DIR;
}

export function getFilePath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}

export async function deleteStoredFile(storedName: string) {
  const filePath = getFilePath(storedName);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    // File was already gone — nothing left to clean up.
  }
}