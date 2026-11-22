import prisma from "../config/db";
import fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import { deleteStoredFile, getFilePath } from "./storage.service";

interface UploadedFile {
  originalname: string;
  filename: string;
  size: number;
  path: string;
}

const RESUME_SELECT = {
  id: true,
  fileName: true,
  fileSize: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

export async function listResumes(userId: string) {
  return prisma.resume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: RESUME_SELECT,
  });
}

// Everything about a resume EXCEPT the PDF bytes (fileData), which can be several MB. Code that
// only needs the text or the ownership check should not pay to load the file as well.
export async function getResumeById(userId: string, id: string) {
  const resume = await prisma.resume.findFirst({ where: { id, userId }, omit: { fileData: true } });
  if (!resume) {
    throw new Error("NOT_FOUND");
  }
  return resume;
}

export async function createResume(userId: string, file: UploadedFile) {
  // Read the upload once. The same bytes are used for text extraction AND stored in the
  // database, because a hosting platform's disk can disappear on a restart; the database does not.
  const buffer = await fs.readFile(file.path);

  let extractedText: string | null = null;

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    extractedText = result.text;
    await parser.destroy();
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    // The resume is still saved even if extraction fails — having the file matters more than having its text.
  }

  const existingCount = await prisma.resume.count({ where: { userId } });

  return prisma.resume.create({
    data: {
      userId,
      fileName: file.originalname,
      storedName: file.filename,
      fileSize: file.size,
      fileData: new Uint8Array(buffer), // a copy typed the way Prisma expects for a Bytes column
      extractedText,
      isDefault: existingCount === 0,
    },
    select: RESUME_SELECT,
  });
}

// The file for a download. `data` is the PDF from the database, or null for a resume uploaded
// before PDFs were stored there (the caller then falls back to the file on disk).
export async function getResumeFile(userId: string, id: string) {
  const resume = await prisma.resume.findFirst({
    where: { id, userId },
    select: { fileName: true, storedName: true, fileData: true },
  });
  if (!resume) {
    throw new Error("NOT_FOUND");
  }
  return {
    fileName: resume.fileName,
    storedName: resume.storedName,
    data: resume.fileData ? Buffer.from(resume.fileData) : null,
  };
}

export async function deleteResume(userId: string, id: string) {
  const resume = await getResumeById(userId, id);
  await deleteStoredFile(resume.storedName);
  await prisma.resume.delete({ where: { id } });
}

export async function setDefaultResume(userId: string, id: string) {
  await getResumeById(userId, id);

  await prisma.$transaction([
    prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.resume.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

export function getResumeFilePath(storedName: string) {
  return getFilePath(storedName);
}