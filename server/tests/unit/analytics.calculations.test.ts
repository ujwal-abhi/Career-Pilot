import { describe, it, expect } from "vitest";
import {
  furthestRank,
  buildFunnel,
  startOfWeekUTC,
  recentWeekStarts,
  countByWeek,
  appliedDate,
  matchByStage,
  practiceByWeek,
} from "../../src/services/analytics/calculations";

const day = (iso: string) => startOfWeekUTC(new Date(iso)).toISOString().slice(0, 10);

describe("furthestRank", () => {
  it("history beats the current status (a rejected application still reached Interview)", () => {
    expect(furthestRank("REJECTED", ["SAVED", "APPLIED", "INTERVIEW", "REJECTED"])).toBe(3);
  });

  it("is unknown (null), not guessed, for a rejected application with no history", () => {
    expect(furthestRank("REJECTED", [])).toBeNull();
  });

  it("means never applied when withdrawn after only SAVED", () => {
    expect(furthestRank("WITHDRAWN", ["SAVED", "WITHDRAWN"])).toBe(0);
  });

  it("keeps the best stage when an application moves backwards", () => {
    expect(furthestRank("APPLIED", ["APPLIED", "INTERVIEW", "APPLIED"])).toBe(3);
  });

  it("counts the current status even with no history", () => {
    expect(furthestRank("OFFER", [])).toBe(4);
  });
});

describe("buildFunnel", () => {
  const funnel = buildFunnel([4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 0, null]);

  it("counts are cumulative: reaching Interview means you also reached Screening and Applied", () => {
    expect(funnel.stages.map((stage) => stage.reached)).toEqual([11, 6, 3, 1]);
  });

  it("never increases going down the funnel", () => {
    funnel.stages.forEach((stage, i, all) => {
      if (i > 0) expect(stage.reached).toBeLessThanOrEqual(all[i - 1].reached);
    });
  });

  it("reports saved-only and unknown applications instead of hiding them", () => {
    expect(funnel.savedOnlyCount).toBe(1);
    expect(funnel.stageUnknownCount).toBe(1);
  });

  it("computes each step as reached / of", () => {
    expect(funnel.steps[0]).toMatchObject({ reached: 6, of: 11, rate: 55 });
  });

  it("ignores steps with too little data when naming the weakest step", () => {
    // Interview -> Offer is 1 of 3 (33%), lower than Screening -> Interview (3 of 6, 50%),
    // but only 3 applications reached Interview, so it must not be named the weakest.
    expect(funnel.weakestStep).toMatchObject({ from: "SCREENING", to: "INTERVIEW", rate: 50 });
    expect(funnel.steps[2]).toMatchObject({ rate: 33, enoughData: false });
  });

  it("names no weakest step when there are only a few applications", () => {
    expect(buildFunnel([1, 2, 3]).weakestStep).toBeNull();
  });

  it("does not divide by zero on an empty funnel", () => {
    const empty = buildFunnel([]);
    expect(empty.steps.every((step) => step.rate === null)).toBe(true);
    expect(empty.weakestStep).toBeNull();
  });

  it("counts an application that skipped Screening as having passed it", () => {
    expect(buildFunnel([3]).stages[1].reached).toBe(1);
  });
});

describe("weeks (2026-10-26 is a Monday)", () => {
  it("maps a Monday to itself and a Sunday to the Monday before", () => {
    expect(day("2026-10-26T10:00:00Z")).toBe("2026-10-26");
    expect(day("2026-11-01T23:59:00Z")).toBe("2026-10-26");
  });

  it("puts Sunday late night UTC in the week that is ending", () => {
    expect(day("2026-10-25T23:59:59Z")).toBe("2026-10-19");
  });

  const now = new Date("2026-10-28T12:00:00Z");

  it("lists recent weeks oldest first, ending with this week", () => {
    expect(recentWeekStarts(now, 4)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("buckets dates into the right week, ignores dates outside the window, and keeps empty weeks as 0", () => {
    const buckets = countByWeek(
      [
        new Date("2026-10-26T01:00:00Z"),
        new Date("2026-10-27T01:00:00Z"),
        new Date("2026-10-13T01:00:00Z"),
        new Date("2025-01-01T00:00:00Z"),
        new Date("2026-12-01T00:00:00Z"),
      ],
      now,
      4
    );
    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 1, 0, 2]);
  });
});

describe("appliedDate", () => {
  const created = new Date("2026-10-01T00:00:00Z");
  const typed = new Date("2026-10-10T00:00:00Z");
  const event = new Date("2026-10-05T00:00:00Z");

  it("prefers the typed date, then the first applied event, then the created date", () => {
    expect(appliedDate({ rank: 2, applicationDate: typed, createdAt: created, firstAppliedEventAt: event })).toEqual(typed);
    expect(appliedDate({ rank: 2, applicationDate: null, createdAt: created, firstAppliedEventAt: event })).toEqual(event);
    expect(appliedDate({ rank: 1, applicationDate: null, createdAt: created, firstAppliedEventAt: null })).toEqual(created);
  });

  it("does not count a saved-only application as sent", () => {
    expect(appliedDate({ rank: 0, applicationDate: null, createdAt: created, firstAppliedEventAt: null })).toBeNull();
  });

  it("counts an unknown-stage application only if it has a typed date", () => {
    expect(appliedDate({ rank: null, applicationDate: typed, createdAt: created, firstAppliedEventAt: null })).toEqual(typed);
    expect(appliedDate({ rank: null, applicationDate: null, createdAt: created, firstAppliedEventAt: null })).toBeNull();
  });
});

describe("matchByStage", () => {
  const matches = matchByStage([
    { rank: 1, matchScore: 40 },
    { rank: 1, matchScore: 50 },
    { rank: 1, matchScore: 60 },
    { rank: 3, matchScore: 80 },
    { rank: 3, matchScore: null },
    { rank: 0, matchScore: 99 },
    { rank: null, matchScore: 99 },
  ]);

  it("averages per stage, rounded", () => {
    expect(matches[0]).toMatchObject({ averageScore: 50, applications: 3 });
  });

  it("skips missing scores instead of treating them as 0", () => {
    expect(matches[2]).toMatchObject({ averageScore: 80, applications: 1 });
  });

  it("reports an empty stage as null, not 0", () => {
    expect(matches[1].averageScore).toBeNull();
    expect(matches[3].averageScore).toBeNull();
  });

  it("never lets saved-only or unknown applications into the chart", () => {
    expect(matches.reduce((sum, stage) => sum + stage.applications, 0)).toBe(4);
  });

  it("flags small groups", () => {
    expect(matches[0].lowSample).toBe(false);
    expect(matches[2].lowSample).toBe(true);
  });
});

describe("practiceByWeek", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const weeks = practiceByWeek(
    [
      { createdAt: new Date("2026-10-27T00:00:00Z"), passedCount: 3, totalCount: 6 },
      { createdAt: new Date("2026-10-28T00:00:00Z"), passedCount: 5, totalCount: 6 },
      { createdAt: new Date("2026-10-13T00:00:00Z"), passedCount: 6, totalCount: 6 },
    ],
    now,
    4
  );

  it("pools the checks of a week: 8 of 12 is 67%, not the average of 50% and 83%", () => {
    expect(weeks[3]).toMatchObject({ passRate: 67, attempts: 2 });
  });

  it("reports weeks with no attempts as null, not 0", () => {
    expect(weeks[0].passRate).toBeNull();
    expect(weeks[2].passRate).toBeNull();
  });

  it("handles a single-attempt week", () => {
    expect(weeks[1]).toMatchObject({ passRate: 100, attempts: 1 });
  });
});