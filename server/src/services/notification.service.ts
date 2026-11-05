import prisma from "../config/db";
import {
  buildNotifications,
  FOLLOW_UP_STATUSES,
  SNOOZE_DAYS,
} from "./notifications/rules";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getNotifications(userId: string, now: Date = new Date()) {
  // Fetch generously and let the pure rules in rules.ts decide what actually qualifies.
  // Keeping the rules in one place (not split between SQL and code) is what makes them
  // testable. Every query is scoped to this user.
  const [interviews, reminders, applications] = await Promise.all([
    prisma.interview.findMany({
      where: { application: { userId }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        format: true,
        scheduledAt: true,
        applicationId: true,
        application: { select: { company: true, position: true } },
      },
    }),
    prisma.reminder.findMany({
      where: { userId, completedAt: null },
      orderBy: { dueAt: "asc" },
      take: 200,
      select: {
        id: true,
        title: true,
        dueAt: true,
        completedAt: true,
        applicationId: true,
        application: { select: { company: true } },
      },
    }),
    prisma.application.findMany({
      where: { userId, status: { in: [...FOLLOW_UP_STATUSES] } },
      select: {
        id: true,
        company: true,
        position: true,
        status: true,
        applicationDate: true,
        createdAt: true,
        followUpSnoozedUntil: true,
        statusEvents: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
  ]);

  return buildNotifications({
    now,
    interviews: interviews.map((interview) => ({
      id: interview.id,
      applicationId: interview.applicationId,
      title: interview.title,
      format: interview.format,
      scheduledAt: interview.scheduledAt,
      company: interview.application.company,
      position: interview.application.position,
    })),
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      dueAt: reminder.dueAt,
      completedAt: reminder.completedAt,
      applicationId: reminder.applicationId,
      company: reminder.application?.company ?? null,
    })),
    applications: applications.map((application) => ({
      id: application.id,
      company: application.company,
      position: application.position,
      status: application.status,
      lastStatusChangeAt: application.statusEvents[0]?.createdAt ?? null,
      applicationDate: application.applicationDate,
      createdAt: application.createdAt,
      followUpSnoozedUntil: application.followUpSnoozedUntil,
    })),
  });
}

// "Not now": hide the follow-up nudge for SNOOZE_DAYS. Scoped by userId, so you cannot
// snooze someone else's application (it simply looks like it does not exist).
export async function snoozeFollowUp(userId: string, applicationId: string, now: Date = new Date()) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  });
  if (!application) {
    throw new Error("NOT_FOUND");
  }

  const until = new Date(now.getTime() + SNOOZE_DAYS * DAY_MS);
  await prisma.application.update({
    where: { id: application.id },
    data: { followUpSnoozedUntil: until },
  });
  return { snoozedUntil: until };
}