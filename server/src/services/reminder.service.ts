import prisma from "../config/db";
import { parseDateInput } from "../utils/datetime.util";

interface ReminderInput {
  title: string;
  dueAt: string;
  applicationId?: string | null;
}

const withApplication = {
  application: { select: { id: true, company: true, position: true } },
} as const;

function requireDate(value: string): Date {
  const date = parseDateInput(value);
  if (!date) throw new Error("INVALID_DATE");
  return date;
}

async function findOwnedReminder(userId: string, id: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
  if (!reminder) {
    throw new Error("NOT_FOUND");
  }
  return reminder;
}

export async function listReminders(userId: string) {
  return prisma.reminder.findMany({
    where: { userId },
    orderBy: { dueAt: "asc" },
    take: 200,
    include: withApplication,
  });
}

export async function createReminder(userId: string, input: ReminderInput) {
  // If the reminder is tied to an application, it must be one of YOUR applications.
  if (input.applicationId) {
    const application = await prisma.application.findFirst({
      where: { id: input.applicationId, userId },
      select: { id: true },
    });
    if (!application) {
      throw new Error("APPLICATION_NOT_FOUND");
    }
  }

  return prisma.reminder.create({
    data: {
      userId,
      applicationId: input.applicationId || null,
      title: input.title.trim(),
      dueAt: requireDate(input.dueAt),
    },
    include: withApplication,
  });
}

export async function setReminderCompleted(userId: string, id: string, completed: boolean) {
  await findOwnedReminder(userId, id);
  return prisma.reminder.update({
    where: { id },
    data: { completedAt: completed ? new Date() : null },
    include: withApplication,
  });
}

export async function deleteReminder(userId: string, id: string) {
  await findOwnedReminder(userId, id);
  await prisma.reminder.delete({ where: { id } });
}