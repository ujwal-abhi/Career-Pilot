import type { UpcomingInterview } from "./schedule.types";
export type ApplicationStatus =
  | "SAVED"
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export interface Application {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  jobUrl: string | null;
  salary: string | null;
  location: string | null;
  jobDescription: string | null;
  applicationDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  company: string;
  position: string;
  status: ApplicationStatus;
  jobUrl?: string;
  salary?: string;
  location?: string;
  jobDescription?: string;
  applicationDate?: string;
  notes?: string;
}

export interface RecentApplication {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface DashboardStats {
  totalApplications: number;
  statusCounts: Record<ApplicationStatus, number>;
  recentApplications: RecentApplication[];
  upcomingInterviews: UpcomingInterview[];
}