import prisma from "../config/db";
import type { InterviewFormat } from "../generated/prisma/client";
import { parseDateInput } from "../utils/datetime.util";

interface InterviewInput {
  applicationId: string;
  title: string;
  format?: InterviewFormat;
  scheduledAt: string;
  location?: string;
  notes?: string;
}

const withApplication = {
  application: { select: { id: true, company: true, position: true } },
} as const;

// scheduledAt has already been validated by the time a service runs, so a null here would
// be a programming error, not bad input.
function requireDate(value: string): Date {
  const date = parseDateInput(value);
  if (!date) throw new Error("INVALID_DATE");
  return date;
}

// An interview belongs to you if its application belongs to you.
async function findOwnedInterview(userId: string, id: string) {
  const interview = await prisma.interview.findFirst({
    where: { id, application: { userId } },
  });
  if (!interview) {
    throw new Error("NOT_FOUND");
  }
  return interview;
}

export async function listInterviews(userId: string) {
  return prisma.interview.findMany({
    where: { application: { userId } },
    orderBy: { scheduledAt: "asc" },
    take: 200,
    include: withApplication,
  });
}

export async function listUpcomingInterviews(userId: string, limit: number, now: Date = new Date()) {
  return prisma.interview.findMany({
    where: { application: { userId }, scheduledAt: { gte: now } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      format: true,
      scheduledAt: true,
      application: { select: { id: true, company: true, position: true } },
    },
  });
}

export async function createInterview(userId: string, input: InterviewInput) {
  // You can only schedule an interview for one of YOUR applications.
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, userId },
    select: { id: true },
  });
  if (!application) {
    throw new Error("APPLICATION_NOT_FOUND");
  }

  return prisma.interview.create({
    data: {
      applicationId: application.id,
      title: input.title.trim(),
      format: input.format ?? "VIDEO",
      scheduledAt: requireDate(input.scheduledAt),
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    include: withApplication,
  });
}

// The application an interview belongs to cannot be changed here. To move it, delete it
// and schedule a new one. That keeps the ownership check simple and hard to get wrong.
export async function updateInterview(userId: string, id: string, input: Omit<InterviewInput, "applicationId">) {
  await findOwnedInterview(userId, id);

  return prisma.interview.update({
    where: { id },
    data: {
      title: input.title.trim(),
      format: input.format ?? "VIDEO",
      scheduledAt: requireDate(input.scheduledAt),
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    include: withApplication,
  });
}

export async function deleteInterview(userId: string, id: string) {
  await findOwnedInterview(userId, id);
  await prisma.interview.delete({ where: { id } });
}