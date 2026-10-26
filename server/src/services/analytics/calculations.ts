// Pure functions: data in, numbers out. No database, no Express, no clock of their own
// (the caller passes "now"), so every rule here can be tested with plain arrays.

export type ApplicationStatus =
  | "SAVED"
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

// The stages an application can progress through, in order. REJECTED and WITHDRAWN are
// not stages: they are ways an application ends, and they say nothing about how far it got.
export const FUNNEL_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

const STAGE_RANK: Partial<Record<ApplicationStatus, number>> = {
  SAVED: 0,
  APPLIED: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 4,
};

// Below this many applications at a stage, a conversion rate is noise, not a finding.
export const MIN_SAMPLE = 5;
// Below this many applications in a group, an average is shown but flagged.
export const LOW_SAMPLE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Furthest stage reached
// ---------------------------------------------------------------------------

// How far did this application ever get? Returns:
//   0..4  the highest stage seen in its history (0 = only ever saved)
//   null  unknown: it ended (rejected/withdrawn) and we never saw it at a real stage,
//         which is what applications from before status history existed look like.
// Never guessed: "unknown" stays unknown and is reported as such.
export function furthestRank(current: ApplicationStatus, history: ApplicationStatus[]): number | null {
  let best: number | null = null;
  for (const status of [current, ...history]) {
    const rank = STAGE_RANK[status];
    if (rank !== undefined && (best === null || rank > best)) {
      best = rank;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export interface FunnelStageCount {
  stage: FunnelStage;
  reached: number;
}

export interface FunnelStep {
  from: FunnelStage;
  to: FunnelStage;
  reached: number; // how many made it to "to"
  of: number; // out of how many reached "from"
  rate: number | null; // whole percent, null when nobody reached "from"
  enoughData: boolean;
}

export interface Funnel {
  stages: FunnelStageCount[];
  steps: FunnelStep[];
  weakestStep: FunnelStep | null;
  savedOnlyCount: number;
  stageUnknownCount: number;
}

export function buildFunnel(ranks: (number | null)[]): Funnel {
  // "Reached stage N" means "furthest rank >= N". An application dragged straight from
  // Applied to Interview did pass through Screening in reality, so it counts there too.
  const stages: FunnelStageCount[] = FUNNEL_STAGES.map((stage, index) => ({
    stage,
    reached: ranks.filter((rank) => rank !== null && rank >= index + 1).length,
  }));

  const steps: FunnelStep[] = stages.slice(1).map((current, index) => {
    const previous = stages[index];
    return {
      from: previous.stage,
      to: current.stage,
      reached: current.reached,
      of: previous.reached,
      rate: previous.reached > 0 ? Math.round((current.reached / previous.reached) * 100) : null,
      enoughData: previous.reached >= MIN_SAMPLE,
    };
  });

  // The weakest step is only named when there is enough data to mean something.
  let weakestStep: FunnelStep | null = null;
  for (const step of steps) {
    if (!step.enoughData || step.rate === null) continue;
    if (weakestStep === null || step.rate < (weakestStep.rate as number)) {
      weakestStep = step;
    }
  }

  return {
    stages,
    steps,
    weakestStep,
    savedOnlyCount: ranks.filter((rank) => rank === 0).length,
    stageUnknownCount: ranks.filter((rank) => rank === null).length,
  };
}

// ---------------------------------------------------------------------------
// Weekly buckets (Monday to Sunday, in UTC)
// ---------------------------------------------------------------------------

export function startOfWeekUTC(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (day.getUTCDay() + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
  return new Date(day.getTime() - daysSinceMonday * DAY_MS);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The last `weeks` Monday dates, oldest first, ending with the current week.
export function recentWeekStarts(now: Date, weeks: number): string[] {
  const thisWeek = startOfWeekUTC(now).getTime();
  const result: string[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    result.push(isoDay(new Date(thisWeek - i * 7 * DAY_MS)));
  }
  return result;
}

export interface WeekCount {
  weekStart: string; // YYYY-MM-DD, a Monday
  count: number;
}

export function countByWeek(dates: Date[], now: Date, weeks: number): WeekCount[] {
  const buckets = new Map<string, number>(recentWeekStarts(now, weeks).map((week) => [week, 0]));
  for (const date of dates) {
    const key = isoDay(startOfWeekUTC(date));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) as number) + 1);
    }
  }
  return Array.from(buckets.entries()).map(([weekStart, count]) => ({ weekStart, count }));
}

// ---------------------------------------------------------------------------
// When was an application sent?
// ---------------------------------------------------------------------------

export interface AppliedDateInput {
  rank: number | null;
  applicationDate: Date | null;
  createdAt: Date;
  // When the history first shows the application at Applied or beyond, if it ever did.
  firstAppliedEventAt: Date | null;
}

// Returns the date to count the application under, or null if it should not be counted
// as "sent" at all. A date the person typed in always wins over anything inferred.
export function appliedDate(input: AppliedDateInput): Date | null {
  const { rank, applicationDate, createdAt, firstAppliedEventAt } = input;
  const wasSent = (rank !== null && rank >= 1) || (rank === null && applicationDate !== null);
  if (!wasSent) return null;
  return applicationDate ?? firstAppliedEventAt ?? createdAt;
}

// ---------------------------------------------------------------------------
// Match score by stage reached
// ---------------------------------------------------------------------------

export interface MatchInput {
  rank: number | null;
  matchScore: number | null;
}

export interface MatchByStage {
  stage: FunnelStage;
  applications: number;
  averageScore: number | null;
  lowSample: boolean;
}

// For each stage, the average match score of applications whose FURTHEST stage was that one.
export function matchByStage(inputs: MatchInput[]): MatchByStage[] {
  return FUNNEL_STAGES.map((stage, index) => {
    const scores = inputs
      .filter((item) => item.rank === index + 1 && item.matchScore !== null)
      .map((item) => item.matchScore as number);
    const total = scores.reduce((sum, score) => sum + score, 0);
    return {
      stage,
      applications: scores.length,
      averageScore: scores.length > 0 ? Math.round(total / scores.length) : null,
      lowSample: scores.length < LOW_SAMPLE,
    };
  });
}

// ---------------------------------------------------------------------------
// Practice trend
// ---------------------------------------------------------------------------

export interface AttemptInput {
  createdAt: Date;
  passedCount: number;
  totalCount: number;
}

export interface PracticeWeek {
  weekStart: string;
  attempts: number;
  passRate: number | null; // null in weeks with no attempts, so the chart shows a gap, not a fake 0
}

// Pass rate per week is pooled: total checks passed / total checks asked, so a week with
// one long answer and a week with ten short ones are weighed by how many checks they held.
export function practiceByWeek(attempts: AttemptInput[], now: Date, weeks: number): PracticeWeek[] {
  const weekStarts = recentWeekStarts(now, weeks);
  const passed = new Map<string, number>(weekStarts.map((week) => [week, 0]));
  const total = new Map<string, number>(weekStarts.map((week) => [week, 0]));
  const count = new Map<string, number>(weekStarts.map((week) => [week, 0]));

  for (const attempt of attempts) {
    const key = isoDay(startOfWeekUTC(attempt.createdAt));
    if (!count.has(key)) continue;
    count.set(key, (count.get(key) as number) + 1);
    passed.set(key, (passed.get(key) as number) + attempt.passedCount);
    total.set(key, (total.get(key) as number) + attempt.totalCount);
  }

  return weekStarts.map((weekStart) => {
    const weekTotal = total.get(weekStart) as number;
    return {
      weekStart,
      attempts: count.get(weekStart) as number,
      passRate: weekTotal > 0 ? Math.round(((passed.get(weekStart) as number) / weekTotal) * 100) : null,
    };
  });
}