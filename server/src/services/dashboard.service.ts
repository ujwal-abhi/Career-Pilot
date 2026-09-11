import prisma from "../config/db";

export async function getDashboardStats(userId: string) {
  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const statusCounts = {
    SAVED: 0,
    APPLIED: 0,
    SCREENING: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  for (const app of applications) {
    statusCounts[app.status] += 1;
  }

  const recentApplications = applications.slice(0, 5).map((app) => ({
    id: app.id,
    company: app.company,
    position: app.position,
    status: app.status,
    createdAt: app.createdAt,
  }));

  return {
    totalApplications: applications.length,
    statusCounts,
    recentApplications,
  };
}