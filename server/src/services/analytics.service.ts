import prisma from "../config/db";
import {
  furthestRank,
  buildFunnel,
  countByWeek,
  appliedDate,
  matchByStage,
  practiceByWeek,
  recentWeekStarts,
  MIN_SAMPLE,
  type ApplicationStatus,
} from "./analytics/calculations";

const WEEKS = 12;

export async function getAnalytics(userId: string, now: Date = new Date()) {
  const windowStart = new Date(`${recentWeekStarts(now, WEEKS)[0]}T00:00:00.000Z`);

  // Every query is scoped by userId, the same ownership rule as the rest of the app.
  const [applications, matches, attempts, totalAttempts, latestResumeAnalysis] = await Promise.all([
    prisma.application.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        applicationDate: true,
        createdAt: true,
        statusEvents: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.jobMatchAnalysis.findMany({
      where: { application: { userId } },
      orderBy: { createdAt: "desc" },
      select: { applicationId: true, matchScore: true },
    }),
    prisma.practiceAttempt.findMany({
      where: { userId, createdAt: { gte: windowStart } },
      select: { createdAt: true, passedCount: true, totalCount: true },
    }),
    prisma.practiceAttempt.count({ where: { userId } }),
    prisma.resumeAnalysis.findFirst({
      where: { resume: { userId } },
      orderBy: { createdAt: "desc" },
      select: { overallScore: true, createdAt: true },
    }),
  ]);

  // Newest match per application (rows arrive newest first, so first one seen wins).
  const latestMatch = new Map<string, number>();
  for (const match of matches) {
    if (!latestMatch.has(match.applicationId)) {
      latestMatch.set(match.applicationId, match.matchScore);
    }
  }

  const enriched = applications.map((application) => {
    const history = application.statusEvents.map((event) => event.toStatus as ApplicationStatus);
    const rank = furthestRank(application.status as ApplicationStatus, history);
    const firstApplied = application.statusEvents.find(
      (event) => event.toStatus !== "SAVED" && furthestRank(event.toStatus as ApplicationStatus, []) !== null
    );
    return {
      rank,
      matchScore: latestMatch.get(application.id) ?? null,
      sentOn: appliedDate({
        rank,
        applicationDate: application.applicationDate,
        createdAt: application.createdAt,
        firstAppliedEventAt: firstApplied?.createdAt ?? null,
      }),
    };
  });

  const funnel = buildFunnel(enriched.map((item) => item.rank));

  return {
    totalApplications: applications.length,
    minSample: MIN_SAMPLE,
    funnel,
    weeklyApplications: countByWeek(
      enriched.flatMap((item) => (item.sentOn ? [item.sentOn] : [])),
      now,
      WEEKS
    ),
    matchByStage: matchByStage(enriched.map((item) => ({ rank: item.rank, matchScore: item.matchScore }))),
    practice: {
      totalAttempts,
      weekly: practiceByWeek(attempts, now, WEEKS),
    },
    resume: latestResumeAnalysis
      ? { latestScore: latestResumeAnalysis.overallScore, analyzedAt: latestResumeAnalysis.createdAt }
      : { latestScore: null, analyzedAt: null },
  };
}