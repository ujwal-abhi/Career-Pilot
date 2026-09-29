import prisma from "../config/db";
import { analyzeResumeText } from "./ai/ai.service";

export async function runResumeAnalysis(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("NOT_FOUND");
  }
  if (!resume.extractedText || resume.extractedText.trim().length === 0) {
    throw new Error("NO_TEXT");
  }

  const result = await analyzeResumeText(resume.extractedText);

  return prisma.resumeAnalysis.create({
    data: {
      resumeId,
      ...result,
    },
  });
}

export async function getLatestAnalysis(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("NOT_FOUND");
  }

  return prisma.resumeAnalysis.findFirst({
    where: { resumeId },
    orderBy: { createdAt: "desc" },
  });
}