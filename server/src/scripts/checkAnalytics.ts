import {
  furthestRank,
  buildFunnel,
  startOfWeekUTC,
  recentWeekStarts,
  countByWeek,
  appliedDate,
  matchByStage,
  practiceByWeek,
} from "../services/analytics/calculations";

let failures = 0;
function expect(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

// 1. Furthest stage
expect("1a. history beats current status", furthestRank("REJECTED", ["SAVED", "APPLIED", "INTERVIEW", "REJECTED"]) === 3);
expect("1b. rejected with no history is unknown, not guessed", furthestRank("REJECTED", []) === null);
expect("1c. withdrawn after only SAVED means never applied", furthestRank("WITHDRAWN", ["SAVED", "WITHDRAWN"]) === 0);
expect("1d. moving backwards keeps the best stage", furthestRank("APPLIED", ["APPLIED", "INTERVIEW", "APPLIED"]) === 3);
expect("1e. current status counts even with no history", furthestRank("OFFER", []) === 4);

// 2. Funnel
const ranks = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 0, null];
const funnel = buildFunnel(ranks);
expect("2a. stage counts are cumulative", JSON.stringify(funnel.stages.map((s) => s.reached)) === "[11,6,3,1]", funnel.stages);
expect("2b. stage counts never increase down the funnel", funnel.stages.every((s, i, all) => i === 0 || s.reached <= all[i - 1].reached));
expect("2c. saved-only and unknown are reported, not hidden", funnel.savedOnlyCount === 1 && funnel.stageUnknownCount === 1, funnel);
expect("2d. step rate is reached / of", funnel.steps[0].reached === 6 && funnel.steps[0].of === 11 && funnel.steps[0].rate === 55, funnel.steps[0]);
// Interview -> Offer is 1 of 3 (33%), lower than Screening -> Interview (3 of 6, 50%),
// but only 3 applications reached Interview, so it must not be named the weakest step.
expect("2e. weakest step ignores steps with too little data", funnel.weakestStep?.from === "SCREENING" && funnel.weakestStep?.to === "INTERVIEW" && funnel.weakestStep?.rate === 50, funnel.weakestStep);
expect("2e2. the small-sample step is still reported, flagged", funnel.steps[2].rate === 33 && funnel.steps[2].enoughData === false, funnel.steps[2]);

const tiny = buildFunnel([1, 2, 3]);
expect("2f. 3 applications is too few to name a weakest step", tiny.weakestStep === null, tiny.weakestStep);

const empty = buildFunnel([]);
expect("2g. empty funnel does not divide by zero", empty.steps.every((s) => s.rate === null) && empty.weakestStep === null, empty);

const skipped = buildFunnel([3]);
expect("2h. skipping Screening still counts as having passed it", skipped.stages[1].reached === 1, skipped.stages);

// 3. Weeks (2026-10-26 is a Monday)
expect("3a. Monday maps to itself", startOfWeekUTC(new Date("2026-10-26T10:00:00Z")).toISOString().slice(0, 10) === "2026-10-26");
expect("3b. Sunday maps to the Monday before", startOfWeekUTC(new Date("2026-11-01T23:59:00Z")).toISOString().slice(0, 10) === "2026-10-26");
expect("3c. Sunday late night UTC is still the same week", startOfWeekUTC(new Date("2026-10-25T23:59:59Z")).toISOString().slice(0, 10) === "2026-10-19");

const now = new Date("2026-10-28T12:00:00Z");
const weeks = recentWeekStarts(now, 4);
expect("3d. recent weeks are oldest first and end this week", JSON.stringify(weeks) === '["2026-10-05","2026-10-12","2026-10-19","2026-10-26"]', weeks);

const buckets = countByWeek(
  [new Date("2026-10-26T01:00:00Z"), new Date("2026-10-27T01:00:00Z"), new Date("2026-10-13T01:00:00Z"), new Date("2025-01-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z")],
  now,
  4
);
expect("3e. dates land in the right week", JSON.stringify(buckets.map((b) => b.count)) === "[0,1,0,2]", buckets);
expect("3f. dates outside the window are ignored, empty weeks are 0", buckets.length === 4);

// 4. Applied date
const created = new Date("2026-10-01T00:00:00Z");
const typed = new Date("2026-10-10T00:00:00Z");
const eventAt = new Date("2026-10-05T00:00:00Z");
expect("4a. typed date wins", appliedDate({ rank: 2, applicationDate: typed, createdAt: created, firstAppliedEventAt: eventAt })?.getTime() === typed.getTime());
expect("4b. otherwise the first applied event", appliedDate({ rank: 2, applicationDate: null, createdAt: created, firstAppliedEventAt: eventAt })?.getTime() === eventAt.getTime());
expect("4c. otherwise created date", appliedDate({ rank: 1, applicationDate: null, createdAt: created, firstAppliedEventAt: null })?.getTime() === created.getTime());
expect("4d. saved-only is not counted as sent", appliedDate({ rank: 0, applicationDate: null, createdAt: created, firstAppliedEventAt: null }) === null);
expect("4e. unknown stage with a typed date is counted", appliedDate({ rank: null, applicationDate: typed, createdAt: created, firstAppliedEventAt: null })?.getTime() === typed.getTime());
expect("4f. unknown stage without a date is not counted", appliedDate({ rank: null, applicationDate: null, createdAt: created, firstAppliedEventAt: null }) === null);

// 5. Match score by stage
const matches = matchByStage([
  { rank: 1, matchScore: 40 },
  { rank: 1, matchScore: 50 },
  { rank: 1, matchScore: 60 },
  { rank: 3, matchScore: 80 },
  { rank: 3, matchScore: null },
  { rank: 0, matchScore: 99 },
  { rank: null, matchScore: 99 },
]);
expect("5a. average per stage, rounded", matches[0].averageScore === 50 && matches[0].applications === 3, matches[0]);
expect("5b. missing scores are skipped, not treated as 0", matches[2].averageScore === 80 && matches[2].applications === 1, matches[2]);
expect("5c. empty stage is null, not 0", matches[1].averageScore === null && matches[3].averageScore === null, matches);
expect("5d. saved-only and unknown never enter the chart", matches.reduce((sum, m) => sum + m.applications, 0) === 4);
expect("5e. small groups are flagged", matches[0].lowSample === false && matches[2].lowSample === true, matches);

// 6. Practice trend
const practice = practiceByWeek(
  [
    { createdAt: new Date("2026-10-27T00:00:00Z"), passedCount: 3, totalCount: 6 },
    { createdAt: new Date("2026-10-28T00:00:00Z"), passedCount: 5, totalCount: 6 },
    { createdAt: new Date("2026-10-13T00:00:00Z"), passedCount: 6, totalCount: 6 },
  ],
  now,
  4
);
expect("6a. pooled pass rate: 8 of 12 = 67%", practice[3].passRate === 67 && practice[3].attempts === 2, practice[3]);
expect("6b. weeks with no attempts are null, not 0", practice[0].passRate === null && practice[2].passRate === null, practice);
expect("6c. single-week values", practice[1].passRate === 100 && practice[1].attempts === 1, practice[1]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);