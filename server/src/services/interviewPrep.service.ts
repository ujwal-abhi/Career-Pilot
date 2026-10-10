import prisma from "../config/db";
import { generateInterviewQuestionsText } from "./ai/ai.service";

const QUESTIONS_ORDERED = { orderBy: { sortOrder: "asc" as const } };

export async function runInterviewPrep(userId: string, resumeId: string, applicationId: string) {
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

  const result = await generateInterviewQuestionsText(
    resume.extractedText,
    application.jobDescription,
    application.position,
    application.company
  );

  // Nested create: the set and all its questions are written together or not at all.
  return prisma.interviewSet.create({
    data: {
      resumeId,
      applicationId,
      notes: result.notes,
      questions: {
        create: result.questions.map((q, index) => ({
          category: q.category,
          question: q.question,
          answerStructure: q.answerStructure,
          sortOrder: index,
        })),
      },
    },
    include: { questions: QUESTIONS_ORDERED },
  });
}

export async function getLatestInterviewSet(
  userId: string,
  resumeId: string,
  applicationId: string
) {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, userId } });
  if (!resume) {
    throw new Error("RESUME_NOT_FOUND");
  }
  const application = await prisma.application.findFirst({ where: { id: applicationId, userId } });
  if (!application) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  return prisma.interviewSet.findFirst({
    where: { resumeId, applicationId },
    orderBy: { createdAt: "desc" },
    include: { questions: QUESTIONS_ORDERED },
  });
}