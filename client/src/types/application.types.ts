export type ApplicationStatus =
  | "SAVED"
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

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
}