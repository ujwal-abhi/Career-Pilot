import prisma from "../config/db";
import type { ApplicationStatus } from "../generated/prisma/client";
import { listUpcomingInterviews } from "./interview.service";

const STATUSES: ApplicationStatus[] = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

export async function getDashboardStats(userId: string) {
  // The database does the counting (GROUP BY status) and the 5 newest rows are
  // fetched with LIMIT 5, so this stays fast no matter how many applications exist.
  // Before, every application was loaded into memory just to be counted.
  const [grouped, recent, upcomingInterviews] = await Promise.all([
    prisma.application.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, company: true, position: true, status: true, createdAt: true },
    }),
    listUpcomingInterviews(userId, 5),
  ]);

  // groupBy only returns statuses that exist, so start every status at 0.
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const row of grouped) {
    statusCounts[row.status] = row._count._all;
  }

  const totalApplications = STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);

  return {
    totalApplications,
    statusCounts,
    recentApplications: recent,
    upcomingInterviews,
  };
}