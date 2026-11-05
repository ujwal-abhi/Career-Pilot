export type InterviewFormat = "PHONE" | "VIDEO" | "ONSITE";

export const INTERVIEW_FORMATS: { value: InterviewFormat; label: string }[] = [
  { value: "VIDEO", label: "Video call" },
  { value: "PHONE", label: "Phone" },
  { value: "ONSITE", label: "On-site" },
];

export interface ApplicationRef {
  id: string;
  company: string;
  position: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  title: string;
  format: InterviewFormat;
  scheduledAt: string; // ISO moment (UTC)
  location: string | null;
  notes: string | null;
  application: ApplicationRef;
}

export interface InterviewInput {
  applicationId: string;
  title: string;
  format: InterviewFormat;
  scheduledAt: string; // ISO moment (UTC), already converted from the person's local time
  location?: string;
  notes?: string;
}

export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  completedAt: string | null;
  applicationId: string | null;
  application: ApplicationRef | null;
}

export interface ReminderInput {
  title: string;
  dueAt: string;
  applicationId?: string;
}

export type NotificationType = "INTERVIEW_SOON" | "REMINDER_OVERDUE" | "REMINDER_DUE" | "FOLLOW_UP";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  at: string;
  href: string;
  applicationId: string | null;
  snoozable: boolean;
}

export interface NotificationsResponse {
  items: AppNotification[];
  total: number;
}

export interface UpcomingInterview {
  id: string;
  title: string;
  format: InterviewFormat;
  scheduledAt: string;
  application: ApplicationRef;
}