import prisma from "../config/db";
import type { ApplicationStatus } from "../generated/prisma/client";

interface ApplicationInput {
  company: string;
  position: string;
  status?: ApplicationStatus;
  jobUrl?: string;
  salary?: string;
  location?: string;
  jobDescription?: string;
  applicationDate?: string;
  notes?: string;
}

export async function listApplications(userId: string) {
  return prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicationById(userId: string, id: string) {
  const application = await prisma.application.findFirst({
    where: { id, userId },
  });

  if (!application) {
    throw new Error("NOT_FOUND");
  }

  return application;
}

export async function createApplication(userId: string, data: ApplicationInput) {
  return prisma.application.create({
    data: {
      userId,
      // The first history row: "this application started here". Written in the same
      // query as the application, so one can never exist without the other.
      statusEvents: { create: { fromStatus: null, toStatus: data.status ?? "SAVED" } },
      company: data.company,
      position: data.position,
      status: data.status,
      jobUrl: data.jobUrl || null,
      salary: data.salary || null,
      location: data.location || null,
      jobDescription: data.jobDescription || null,
      applicationDate: data.applicationDate ? new Date(data.applicationDate) : null,
      notes: data.notes || null,
    },
  });
}

export async function updateApplication(
  userId: string,
  id: string,
  data: Partial<ApplicationInput>
) {
  const existing = await getApplicationById(userId, id); // throws NOT_FOUND if missing or not owned by this user

  // Only a real change is history. Re-saving the form with the same status adds nothing.
  const newStatus = data.status;
  const statusHistory =
    newStatus !== undefined && newStatus !== existing.status
      ? { statusEvents: { create: { fromStatus: existing.status, toStatus: newStatus } } }
      : {};

  return prisma.application.update({
    where: { id },
    data: {
      ...(data.company !== undefined && { company: data.company }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.status !== undefined && { status: data.status }),
      ...statusHistory,
      ...(data.jobUrl !== undefined && { jobUrl: data.jobUrl || null }),
      ...(data.salary !== undefined && { salary: data.salary || null }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(data.jobDescription !== undefined && { jobDescription: data.jobDescription || null }),
      ...(data.applicationDate !== undefined && {
        applicationDate: data.applicationDate ? new Date(data.applicationDate) : null,
      }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });
}

export async function deleteApplication(userId: string, id: string) {
  await getApplicationById(userId, id); // throws NOT_FOUND if missing or not owned by this user
  await prisma.application.delete({ where: { id } });
}