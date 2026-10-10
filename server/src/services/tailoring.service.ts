import prisma from "../config/db";
import { tailorResumeText } from "./ai/ai.service";

export async function runTailoring(userId: string, resumeId: string, applicationId: string) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("RESUME_NOT_FOUND");
  }
  if (!resume.extractedText || resume.extractedText.trim().length === 0) {
    throw new Error("NO_RESUME_TEXT");
  }

  const application = await prisma.application.findFirst({ where: { id: applicationId, userId } });
  if (!application) {
    throw new Error("APPLICATION_NOT_FOUND");
  }
  if (!application.jobDescription || application.jobDescription.trim().length === 0) {
    throw new Error("NO_JOB_DESCRIPTION");
  }

  const result = await tailorResumeText(
    resume.extractedText,
    application.jobDescription,
    application.position
  );

  return prisma.resumeTailoring.create({
    data: {
      resumeId,
      applicationId,
      ...result,
    },
  });
}

export async function getLatestTailoring(userId: string, resumeId: string, applicationId: string) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("RESUME_NOT_FOUND");
  }
  const application = await prisma.application.findFirst({ where: { id: applicationId, userId } });
  if (!application) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  return prisma.resumeTailoring.findFirst({
    where: { resumeId, applicationId },
    orderBy: { createdAt: "desc" },
  });
}