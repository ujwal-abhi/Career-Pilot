import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import type { Request, Response, NextFunction } from "express";
import { getUploadDir } from "../services/storage.service";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    // The stored name is always a random UUID plus ".pdf". It used to keep whatever
    // extension the uploader's filename had, so a file called "x.php" or "x.html" would have
    // been stored with that extension. The person's original name is kept separately in the
    // database for display and download.
    cb(null, `${crypto.randomUUID()}.pdf`);
  },
});

function fileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  // First, cheap check on what the browser CLAIMS the file is. It is easy to fake, which is
  // why verifyPdfSignature below looks at the actual bytes.
  if (file.mimetype !== "application/pdf") {
    cb(new Error("ONLY_PDF_ALLOWED"));
    return;
  }
  cb(null, true);
}

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB, one file
});

// A real PDF starts with "%PDF-". The PDF spec lets a few junk bytes come before it, and
// readers accept the marker anywhere in the first 1024 bytes, so this does the same.
export function looksLikePdf(firstBytes: Buffer): boolean {
  return firstBytes.subarray(0, 1024).includes("%PDF-", 0, "latin1");
}

// Runs after multer has saved the file. If the bytes are not a PDF, delete the file and
// refuse, so an uploaded "resume.pdf" that is really something else never gets parsed or
// served back.
export async function verifyPdfSignature(req: Request, res: Response, next: NextFunction) {
  const file = req.file;
  if (!file) return next();

  let isPdf = false;
  try {
    const handle = await fs.open(file.path, "r");
    try {
      const buffer = Buffer.alloc(1024);
      const { bytesRead } = await handle.read(buffer, 0, 1024, 0);
      isPdf = looksLikePdf(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    isPdf = false;
  }

  if (!isPdf) {
    await fs.unlink(file.path).catch(() => undefined);
    return res.status(400).json({ success: false, message: "That file is not a valid PDF." });
  }
  next();
}