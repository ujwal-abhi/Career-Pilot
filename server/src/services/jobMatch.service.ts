import prisma from "../config/db";
import { matchResumeToJobText } from "./ai/ai.service";

export async function runJobMatch(userId: string, resumeId: string, applicationId: string) {
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

  const result = await matchResumeToJobText(resume.extractedText, application.jobDescription);

  return prisma.jobMatchAnalysis.create({
    data: {
      resumeId,
      applicationId,
      ...result,
    },
  });
}

export async function getLatestJobMatch(userId: string, resumeId: string, applicationId: string) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("RESUME_NOT_FOUND");
  }
  const application = await prisma.application.findFirst({ where: { id: applicationId, userId } });
  if (!application) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  return prisma.jobMatchAnalysis.findFirst({
    where: { resumeId, applicationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listResumesForMatch(userId: string) {
  return prisma.resume.findMany({
    where: { userId },
    select: { id: true, fileName: true, isDefault: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listApplicationsForMatch(userId: string) {
  return prisma.application.findMany({
    where: { userId, jobDescription: { not: null } },
    select: { id: true, company: true, position: true },
    orderBy: { createdAt: "desc" },
  });
}