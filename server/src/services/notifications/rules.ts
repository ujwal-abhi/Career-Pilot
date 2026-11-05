// Pure rules for "what needs your attention right now". Data in, notifications out.
// No database, no Express, no clock of its own (the caller passes "now"), so every rule
// can be tested with plain objects.
//
// Notifications are DERIVED each time they are asked for, not stored. That means there is
// no cron job, no duplicates, and no stale rows to clean up: if you reschedule an
// interview or finish a reminder, the notification simply stops being produced.

export const INTERVIEW_WINDOW_HOURS = 48; // upcoming interviews inside this window are shown
export const REMINDER_WINDOW_HOURS = 24; // reminders due inside this window are shown
export const FOLLOW_UP_AFTER_DAYS = 7; // silence this long means "consider following up"
export const SNOOZE_DAYS = 7;
export const MAX_NOTIFICATIONS = 20;

// Only applications that are waiting on the company get a follow-up nudge. SAVED means you
// have not applied yet; OFFER, REJECTED and WITHDRAWN are finished.
export const FOLLOW_UP_STATUSES = ["APPLIED", "SCREENING", "INTERVIEW"] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type NotificationType = "INTERVIEW_SOON" | "REMINDER_OVERDUE" | "REMINDER_DUE" | "FOLLOW_UP";

export interface InterviewInput {
  id: string;
  applicationId: string;
  title: string;
  format: string;
  scheduledAt: Date;
  company: string;
  position: string;
}

export interface ReminderInput {
  id: string;
  title: string;
  dueAt: Date;
  completedAt: Date | null;
  applicationId: string | null;
  company: string | null;
}

export interface FollowUpInput {
  id: string; // the application's id
  company: string;
  position: string;
  status: string;
  lastStatusChangeAt: Date | null;
  applicationDate: Date | null;
  createdAt: Date;
  followUpSnoozedUntil: Date | null;
}

export interface AppNotification {
  id: string; // stable and unique: "interview:<id>", "reminder:<id>", "followup:<applicationId>"
  type: NotificationType;
  title: string;
  detail: string;
  at: string; // ISO time the notification is about (interview time, due time, or waiting since)
  href: string;
  applicationId: string | null;
  snoozable: boolean;
}

export interface NotificationResult {
  items: AppNotification[];
  total: number; // how many there are before the cap, so the bell can say "20 of 31"
}

const FORMAT_LABELS: Record<string, string> = {
  PHONE: "Phone",
  VIDEO: "Video",
  ONSITE: "On-site",
};

const STATUS_LABELS: Record<string, string> = {
  APPLIED: "applied",
  SCREENING: "in screening",
  INTERVIEW: "in interview stage",
};

// When did this application last show any sign of movement? The most recent of the last
// recorded status change and the application date the person entered. Applications from
// before status history existed fall back to the date they were created.
export function waitingSince(input: FollowUpInput): Date {
  const candidates = [input.lastStatusChangeAt, input.applicationDate].filter(
    (date): date is Date => date !== null
  );
  if (candidates.length === 0) return input.createdAt;
  return new Date(Math.max(...candidates.map((date) => date.getTime())));
}

export function buildNotifications(input: {
  interviews: InterviewInput[];
  reminders: ReminderInput[];
  applications: FollowUpInput[];
  now: Date;
}): NotificationResult {
  const { interviews, reminders, applications, now } = input;
  const nowMs = now.getTime();

  // ---- Overdue and due-soon reminders ----
  const overdue: { at: number; item: AppNotification }[] = [];
  const dueSoon: { at: number; item: AppNotification }[] = [];

  for (const reminder of reminders) {
    if (reminder.completedAt !== null) continue;
    const dueMs = reminder.dueAt.getTime();
    const isOverdue = dueMs < nowMs;
    if (!isOverdue && dueMs > nowMs + REMINDER_WINDOW_HOURS * HOUR_MS) continue;

    const item: AppNotification = {
      id: `reminder:${reminder.id}`,
      type: isOverdue ? "REMINDER_OVERDUE" : "REMINDER_DUE",
      title: reminder.title,
      detail: reminder.company ? `Reminder for ${reminder.company}` : "Reminder",
      at: reminder.dueAt.toISOString(),
      href: "/schedule",
      applicationId: reminder.applicationId,
      snoozable: false,
    };
    (isOverdue ? overdue : dueSoon).push({ at: dueMs, item });
  }

  // ---- Interviews coming up ----
  const soon: { at: number; item: AppNotification }[] = [];
  for (const interview of interviews) {
    const startMs = interview.scheduledAt.getTime();
    if (startMs < nowMs || startMs > nowMs + INTERVIEW_WINDOW_HOURS * HOUR_MS) continue;
    soon.push({
      at: startMs,
      item: {
        id: `interview:${interview.id}`,
        type: "INTERVIEW_SOON",
        title: `${interview.title} at ${interview.company}`,
        detail: `${interview.position} (${FORMAT_LABELS[interview.format] ?? interview.format})`,
        at: interview.scheduledAt.toISOString(),
        href: "/schedule",
        applicationId: interview.applicationId,
        snoozable: false,
      },
    });
  }

  // ---- Follow-ups: applications that have gone quiet ----
  // An application with a future interview is not "quiet": something is already scheduled.
  const hasUpcomingInterview = new Set(
    interviews.filter((interview) => interview.scheduledAt.getTime() > nowMs).map((i) => i.applicationId)
  );

  const followUps: { at: number; item: AppNotification }[] = [];
  for (const application of applications) {
    if (!(FOLLOW_UP_STATUSES as readonly string[]).includes(application.status)) continue;
    if (hasUpcomingInterview.has(application.id)) continue;
    if (application.followUpSnoozedUntil !== null && application.followUpSnoozedUntil.getTime() > nowMs) continue;

    const since = waitingSince(application);
    const daysWaiting = Math.floor((nowMs - since.getTime()) / DAY_MS);
    if (daysWaiting < FOLLOW_UP_AFTER_DAYS) continue;

    followUps.push({
      at: since.getTime(),
      item: {
        id: `followup:${application.id}`,
        type: "FOLLOW_UP",
        title: `Follow up with ${application.company}`,
        detail: `${application.position}: ${STATUS_LABELS[application.status] ?? application.status}, no update for ${daysWaiting} days`,
        at: since.toISOString(),
        href: "/applications",
        applicationId: application.id,
        snoozable: true,
      },
    });
  }

  // Most urgent first: overdue reminders, then interviews, then reminders due soon, then
  // follow-ups. Inside each group: oldest due first, soonest interview first, longest wait first.
  const byTime = (a: { at: number }, b: { at: number }) => a.at - b.at;
  const all = [
    ...overdue.sort(byTime),
    ...soon.sort(byTime),
    ...dueSoon.sort(byTime),
    ...followUps.sort(byTime),
  ].map((entry) => entry.item);

  return { items: all.slice(0, MAX_NOTIFICATIONS), total: all.length };
}