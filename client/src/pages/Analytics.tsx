import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "../components/Navbar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { getAnalytics } from "../services/analyticsService";
import type { AnalyticsData, FunnelStage } from "../types/analytics.types";

// Chart colors. The app is dark-only, so these are the dark-mode steps: the series blue
// clears 3:1 contrast on the slate-800 card, and everything else stays recessive.
const SERIES = "#3987e5";
const SURFACE = "#1e293b";
const GRID = "#334155";
const AXIS = "#94a3b8";
const TEXT = "#e2e8f0";

const STAGE_LABELS: Record<FunnelStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
};

const tooltipProps = {
  contentStyle: {
    background: "#0f172a",
    border: `1px solid ${GRID}`,
    borderRadius: 6,
    color: TEXT,
    fontSize: 12,
  },
  labelStyle: { color: AXIS },
  itemStyle: { color: TEXT },
  cursor: { fill: "rgba(148, 163, 184, 0.12)" },
};

const axisTick = { fill: AXIS, fontSize: 12 };

// Label every second week, counting back from the current week, so the spacing is even
// and the newest week is always labelled. (Letting the chart pick skips weeks unevenly.)
function everyOtherWeek(labels: string[]): string[] {
  return labels.filter((_, index) => (labels.length - 1 - index) % 2 === 0);
}

// "2026-10-26" -> "Oct 26". Weeks are Monday dates in UTC, so format in UTC too,
// otherwise a viewer west of UTC would see the day before.
function formatWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded border border-dashed border-slate-700 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Career Analytics</h1>
        <p className="text-slate-400 mb-6">
          Where your search is working, and where it is getting stuck.
        </p>

        {isLoading && <p className="text-slate-400">Loading analytics...</p>}

        {error && (
          <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300">{error}</div>
        )}

        {data && data.totalApplications === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-slate-300 mb-1">No applications to analyze yet.</p>
            <p className="text-slate-500 text-sm">
              Add some on the{" "}
              <Link to="/applications" className="text-blue-400 underline">
                Applications
              </Link>{" "}
              board and move them through the stages. Your charts fill in as you go.
            </p>
          </div>
        )}

        {data && data.totalApplications > 0 && <AnalyticsContent data={data} />}
      </div>
    </div>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsData }) {
  const { funnel, weeklyApplications, matchByStage, practice, resume, minSample } = data;
  const [applied, screening, interview, offer] = funnel.stages;
  const weakest = funnel.weakestStep;

  const funnelData = funnel.stages.map((item) => ({
    label: STAGE_LABELS[item.stage],
    reached: item.reached,
  }));

  const weeklyData = weeklyApplications.map((item) => ({
    label: formatWeek(item.weekStart),
    count: item.count,
  }));
  const weeklyTotal = weeklyApplications.reduce((sum, item) => sum + item.count, 0);

  const matchData = matchByStage.map((item) => ({
    label: STAGE_LABELS[item.stage],
    averageScore: item.averageScore,
    applications: item.applications,
    // Always show how many applications sit behind each average.
    scoreLabel: item.averageScore === null ? "" : `${item.averageScore} (n=${item.applications})`,
  }));
  const hasMatchData = matchByStage.some((item) => item.applications > 0);

  const practiceData = practice.weekly.map((item) => ({
    label: formatWeek(item.weekStart),
    passRate: item.passRate,
    attempts: item.attempts,
  }));
  const hasPracticeData = practice.weekly.some((item) => item.attempts > 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Applications sent" value={applied.reached} />
        <StatCard
          label="Reached screening"
          value={screening.reached}
          accentClassName="text-blue-400"
          hint={funnel.steps[0].rate !== null ? `${funnel.steps[0].rate}% of sent` : undefined}
        />
        <StatCard
          label="Reached interview"
          value={interview.reached}
          accentClassName="text-yellow-400"
          hint={applied.reached > 0 ? `${Math.round((interview.reached / applied.reached) * 100)}% of sent` : undefined}
        />
        <StatCard
          label="Offers"
          value={offer.reached}
          accentClassName="text-green-400"
          hint={applied.reached > 0 ? `${Math.round((offer.reached / applied.reached) * 100)}% of sent` : undefined}
        />
        <StatCard
          label="Latest resume score"
          value={resume.latestScore ?? "-"}
          hint={resume.latestScore === null ? "Analyze a resume to see it" : "out of 100"}
        />
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 mb-6">
        <h2 className="font-semibold mb-1">Where you may be getting stuck</h2>
        {weakest ? (
          <p className="text-slate-300">
            Your weakest step so far is{" "}
            <strong>
              {STAGE_LABELS[weakest.from]} to {STAGE_LABELS[weakest.to]}
            </strong>
            : {weakest.reached} of {weakest.of} ({weakest.rate}%) made it.
          </p>
        ) : (
          <p className="text-slate-300">
            Not enough data to say yet. A step is only compared once at least {minSample} applications
            have reached it, because a rate from 2 or 3 applications is mostly luck.
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Applications still waiting to hear back count as not having moved, so recent ones pull the
          rates down.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Application funnel"
          question="How far do your applications get?"
          tableColumns={["Stage", "Reached", "Step rate"]}
          tableRows={funnel.stages.map((item, index) => {
            const step = index === 0 ? null : funnel.steps[index - 1];
            return [
              STAGE_LABELS[item.stage],
              item.reached,
              step === null ? "-" : step.rate === null ? "-" : `${step.reached} of ${step.of} (${step.rate}%)`,
            ];
          })}
          footnote={`${funnel.savedOnlyCount} saved but not applied yet. ${funnel.stageUnknownCount} ended (rejected or withdrawn) before status history was recorded, so we cannot tell how far they got and leave them out.`}
        >
          {applied.reached === 0 ? (
            <EmptyChart message="Move an application to Applied and it shows up here." />
          ) : (
            <>
              <div
                role="img"
                aria-label={`Funnel: ${funnel.stages
                  .map((item) => `${STAGE_LABELS[item.stage]} ${item.reached}`)
                  .join(", ")}`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 0 }}>
                    <XAxis type="number" hide domain={[0, "dataMax"]} />
                    <YAxis type="category" dataKey="label" width={80} tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="reached" name="Applications" fill={SERIES} radius={[0, 4, 4, 0]} barSize={24}>
                      <LabelList dataKey="reached" position="right" fill={TEXT} fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {funnel.steps.map((step) => (
                  <li key={step.to} className="flex items-center gap-2">
                    <span>
                      {STAGE_LABELS[step.from]} to {STAGE_LABELS[step.to]}:{" "}
                      <span className="text-white">
                        {step.reached} of {step.of}
                        {step.rate !== null && ` (${step.rate}%)`}
                      </span>
                    </span>
                    {!step.enoughData && (
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        small sample
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Applications sent per week"
          question="Are you keeping up a steady pace?"
          tableColumns={["Week of", "Applications sent"]}
          tableRows={weeklyData.map((item) => [item.label, item.count])}
          footnote="Counted by the date you entered, or the day you moved it to Applied. Weeks run Monday to Sunday (UTC)."
        >
          {weeklyTotal === 0 ? (
            <EmptyChart message="No applications sent in the last 12 weeks." />
          ) : (
            <div role="img" aria-label={`Applications sent per week, ${weeklyTotal} in the last 12 weeks`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" ticks={everyOtherWeek(weeklyData.map((item) => item.label))} interval={0} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipProps} labelFormatter={(label) => `Week of ${label}`} />
                  <Bar dataKey="count" name="Sent" fill={SERIES} radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Match score by stage reached"
          question="Do better-matched jobs get further?"
          tableColumns={["Furthest stage", "Applications", "Average match score"]}
          tableRows={matchData.map((item) => [
            item.label,
            item.applications,
            item.averageScore === null ? "-" : item.averageScore,
          ])}
          footnote="Uses your latest Job Match for each application. The score comes from a rule-based skill matcher, so treat this as a hint, not a prediction. n is how many applications are behind each average; with n under 3 it is barely a pattern."
        >
          {!hasMatchData ? (
            <EmptyChart message="Run Job Match on applications that have reached a stage, and this fills in." />
          ) : (
            <div role="img" aria-label="Average match score for applications by furthest stage reached">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={matchData} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...tooltipProps}
                    formatter={(value, _name, item) => [
                      `${value} (${(item.payload as { applications: number }).applications} applications)`,
                      "Average match",
                    ]}
                  />
                  <Bar dataKey="averageScore" name="Average match" fill={SERIES} radius={[4, 4, 0, 0]} barSize={32}>
                    <LabelList dataKey="scoreLabel" position="top" fill={TEXT} fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Interview practice"
          question="Are your practice answers getting better?"
          tableColumns={["Week of", "Attempts", "Checks passed"]}
          tableRows={practiceData.map((item) => [
            item.label,
            item.attempts,
            item.passRate === null ? "-" : `${item.passRate}%`,
          ])}
          footnote={`${practice.totalAttempts} practice attempts in total. Pass rate is the share of structural checks passed (STAR steps, specifics, length), not a judgment of how good the answer is. Weeks without practice are left blank.`}
        >
          {!hasPracticeData ? (
            <EmptyChart message="No practice attempts in the last 12 weeks. Answer a question on the Practice page." />
          ) : (
            <div role="img" aria-label="Weekly share of practice checks passed">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={practiceData} margin={{ top: 8, right: 28, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" ticks={everyOtherWeek(practiceData.map((item) => item.label))} interval={0} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...tooltipProps}
                    labelFormatter={(label) => `Week of ${label}`}
                    formatter={(value, _name, item) => [
                      `${value}% (${(item.payload as { attempts: number }).attempts} attempts)`,
                      "Checks passed",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="passRate"
                    name="Checks passed"
                    stroke={SERIES}
                    strokeWidth={2}
                    connectNulls={false}
                    dot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}