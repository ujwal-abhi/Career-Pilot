import { describe, it, expect } from "vitest";
import {
  buildNotifications,
  waitingSince,
  MAX_NOTIFICATIONS,
  type InterviewInput,
  type ReminderInput,
  type FollowUpInput,
} from "../../src/services/notifications/rules";

// A fixed "now" makes every boundary exact and the tests repeatable.
const now = new Date("2026-10-30T10:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);
const days = (n: number) => hours(n * 24);

function interview(id: string, scheduledAt: Date, applicationId = `app-${id}`): InterviewInput {
  return { id, applicationId, title: "Technical round", format: "VIDEO", scheduledAt, company: "Acme", position: "Frontend Developer" };
}
function reminder(id: string, dueAt: Date, completedAt: Date | null = null): ReminderInput {
  return { id, title: `Reminder ${id}`, dueAt, completedAt, applicationId: null, company: null };
}
function application(id: string, overrides: Partial<FollowUpInput> = {}): FollowUpInput {
  return {
    id,
    company: "Globex",
    position: "Developer",
    status: "APPLIED",
    lastStatusChangeAt: days(-10),
    applicationDate: null,
    createdAt: days(-30),
    followUpSnoozedUntil: null,
    ...overrides,
  };
}
const run = (input: { interviews?: InterviewInput[]; reminders?: ReminderInput[]; applications?: FollowUpInput[] }) =>
  buildNotifications({ interviews: [], reminders: [], applications: [], now, ...input });
const ids = (input: Parameters<typeof run>[0]) => run(input).items.map((item) => item.id);

describe("interview notifications", () => {
  it("shows an interview within 48 hours, including exactly 48", () => {
    expect(ids({ interviews: [interview("a", hours(47))] })).toContain("interview:a");
    expect(ids({ interviews: [interview("a", hours(48))] })).toContain("interview:a");
  });

  it("does not show one more than 48 hours away", () => {
    expect(ids({ interviews: [interview("a", hours(49))] })).not.toContain("interview:a");
  });

  it("does not show an interview that already started, but shows one starting this very instant", () => {
    expect(ids({ interviews: [interview("a", hours(-1))] })).not.toContain("interview:a");
    expect(ids({ interviews: [interview("a", now)] })).toContain("interview:a");
  });
});

describe("reminder notifications", () => {
  it("never shows a completed reminder", () => {
    expect(ids({ reminders: [reminder("r", hours(-5), hours(-1))] })).toEqual([]);
  });

  it("marks a past-due reminder OVERDUE and a soon-due one DUE", () => {
    expect(run({ reminders: [reminder("r", hours(-5))] }).items[0].type).toBe("REMINDER_OVERDUE");
    expect(run({ reminders: [reminder("r", hours(23))] }).items[0].type).toBe("REMINDER_DUE");
  });

  it("shows a reminder due in exactly 24 hours, but not one due in 25", () => {
    expect(run({ reminders: [reminder("r", hours(24))] }).items[0]?.type).toBe("REMINDER_DUE");
    expect(run({ reminders: [reminder("r", hours(25))] }).items).toHaveLength(0);
  });

  it("keeps showing a very overdue reminder instead of dropping it", () => {
    expect(ids({ reminders: [reminder("r", days(-90))] })).toContain("reminder:r");
  });
});

describe("follow-up notifications", () => {
  const quietFor = (n: number) => application("x", { lastStatusChangeAt: days(-n) });

  it("triggers after 7 full days of silence, not 6", () => {
    expect(ids({ applications: [quietFor(7)] })).toContain("followup:x");
    expect(ids({ applications: [quietFor(6)] })).not.toContain("followup:x");
  });

  it("counts whole days only: 6.9 days does not trigger", () => {
    const almost = application("x", { lastStatusChangeAt: new Date(days(-7).getTime() + 60 * 60 * 1000) });
    expect(ids({ applications: [almost] })).not.toContain("followup:x");
  });

  it.each(["SAVED", "OFFER", "REJECTED", "WITHDRAWN"])("never nags about a %s application", (status) => {
    expect(ids({ applications: [application("x", { status })] })).toEqual([]);
  });

  it.each(["APPLIED", "SCREENING", "INTERVIEW"])("can nag about a %s application", (status) => {
    expect(ids({ applications: [application("x", { status })] })).toContain("followup:x");
  });

  it("hides a snoozed follow-up, and brings it back when the snooze expires", () => {
    expect(ids({ applications: [application("x", { followUpSnoozedUntil: days(3) })] })).toEqual([]);
    expect(ids({ applications: [application("x", { followUpSnoozedUntil: days(-1) })] })).toContain("followup:x");
  });

  it("does not nag when an interview is coming up, but does when the interview is already past", () => {
    const withFuture = ids({ applications: [application("x")], interviews: [interview("i", days(10), "x")] });
    expect(withFuture).not.toContain("followup:x");
    const withPast = ids({ applications: [application("x")], interviews: [interview("i", days(-3), "x")] });
    expect(withPast).toContain("followup:x");
  });

  it("says how many days it has been, and only follow-ups can be snoozed", () => {
    const followUp = run({ applications: [quietFor(12)] }).items[0];
    expect(followUp.detail).toContain("no update for 12 days");
    expect(followUp.snoozable).toBe(true);
    expect(run({ reminders: [reminder("r", hours(-1))] }).items[0].snoozable).toBe(false);
  });
});

describe("waitingSince", () => {
  it("uses the most recent of the last status change and the application date", () => {
    const input = application("x", { lastStatusChangeAt: days(-10), applicationDate: days(-3) });
    expect(waitingSince(input).getTime()).toBe(days(-3).getTime());
    const other = application("x", { lastStatusChangeAt: days(-2), applicationDate: days(-20) });
    expect(waitingSince(other).getTime()).toBe(days(-2).getTime());
  });

  it("falls back to the created date when there is nothing else", () => {
    const input = application("x", { lastStatusChangeAt: null, applicationDate: null, createdAt: days(-40) });
    expect(waitingSince(input).getTime()).toBe(days(-40).getTime());
  });

  it("treats an application date in the future as not stale", () => {
    const input = application("x", { lastStatusChangeAt: null, applicationDate: days(5) });
    expect(ids({ applications: [input] })).toEqual([]);
  });
});

describe("ordering and limits", () => {
  it("orders overdue, then interviews (soonest first), then due soon, then follow-ups (longest wait first)", () => {
    const result = run({
      reminders: [reminder("late", hours(-30)), reminder("later", hours(-2)), reminder("soonish", hours(5))],
      interviews: [interview("far", hours(40)), interview("near", hours(3))],
      applications: [application("quiet1", { lastStatusChangeAt: days(-9) }), application("quiet2", { lastStatusChangeAt: days(-20) })],
    });
    expect(result.items.map((item) => item.id)).toEqual([
      "reminder:late",
      "reminder:later",
      "interview:near",
      "interview:far",
      "reminder:soonish",
      "followup:quiet2",
      "followup:quiet1",
    ]);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(result.items.length);
  });

  it("caps the list but still reports the true total", () => {
    const many = run({
      applications: Array.from({ length: 35 }, (_, i) => application(`m${i}`, { lastStatusChangeAt: days(-8 - i) })),
    });
    expect(many.items).toHaveLength(MAX_NOTIFICATIONS);
    expect(many.total).toBe(35);
  });

  it("returns an empty list, not an error, when there is nothing to report", () => {
    expect(run({})).toMatchObject({ items: [], total: 0 });
  });
});