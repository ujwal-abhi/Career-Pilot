import {
  buildNotifications,
  waitingSince,
  MAX_NOTIFICATIONS,
  type InterviewInput,
  type ReminderInput,
  type FollowUpInput,
} from "../services/notifications/rules";

let failures = 0;
function expect(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const now = new Date("2026-10-30T10:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);
const days = (n: number) => hours(n * 24);

function interview(id: string, scheduledAt: Date, applicationId = `app-${id}`): InterviewInput {
  return { id, applicationId, title: "Technical round", format: "VIDEO", scheduledAt, company: "Acme", position: "Frontend Developer" };
}
function reminder(id: string, dueAt: Date, completedAt: Date | null = null): ReminderInput {
  return { id, title: `Reminder ${id}`, dueAt, completedAt, applicationId: null, company: null };
}
function app(id: string, overrides: Partial<FollowUpInput> = {}): FollowUpInput {
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
const run = (partial: { interviews?: InterviewInput[]; reminders?: ReminderInput[]; applications?: FollowUpInput[] }) =>
  buildNotifications({ interviews: [], reminders: [], applications: [], now, ...partial });
const ids = (partial: Parameters<typeof run>[0]) => run(partial).items.map((n) => n.id);

// 1. Interviews
expect("1a. interview in 47h is shown", ids({ interviews: [interview("a", hours(47))] }).includes("interview:a"));
expect("1b. interview in exactly 48h is shown (boundary is inclusive)", ids({ interviews: [interview("a", hours(48))] }).includes("interview:a"));
expect("1c. interview in 49h is not shown yet", !ids({ interviews: [interview("a", hours(49))] }).includes("interview:a"));
expect("1d. interview that already started is not shown", !ids({ interviews: [interview("a", hours(-1))] }).includes("interview:a"));
expect("1e. interview happening right now (same instant) is shown", ids({ interviews: [interview("a", now)] }).includes("interview:a"));

// 2. Reminders
expect("2a. completed reminder is never shown", ids({ reminders: [reminder("r", hours(-5), hours(-1))] }).length === 0);
expect("2b. past-due reminder is OVERDUE", run({ reminders: [reminder("r", hours(-5))] }).items[0].type === "REMINDER_OVERDUE");
expect("2c. reminder due in 23h is DUE", run({ reminders: [reminder("r", hours(23))] }).items[0].type === "REMINDER_DUE");
expect("2d. reminder due in exactly 24h is DUE (inclusive)", run({ reminders: [reminder("r", hours(24))] }).items[0]?.type === "REMINDER_DUE");
expect("2e. reminder due in 25h is not shown yet", run({ reminders: [reminder("r", hours(25))] }).items.length === 0);
expect("2f. a reminder very overdue is still shown, not dropped", ids({ reminders: [reminder("r", days(-90))] }).includes("reminder:r"));

// 3. Follow-ups
const waiting = (n: number) => app("x", { lastStatusChangeAt: days(-n) });
expect("3a. 7 full days of silence triggers a follow-up", ids({ applications: [waiting(7)] }).includes("followup:x"));
expect("3b. 6 days does not", !ids({ applications: [waiting(6)] }).includes("followup:x"));
expect("3c. 6.9 days does not (whole days only)", !ids({ applications: [app("x", { lastStatusChangeAt: new Date(days(-7).getTime() + 60 * 60 * 1000) })] }).includes("followup:x"));
for (const status of ["SAVED", "OFFER", "REJECTED", "WITHDRAWN"]) {
  expect(`3d. ${status} never gets a follow-up`, ids({ applications: [app("x", { status })] }).length === 0);
}
for (const status of ["APPLIED", "SCREENING", "INTERVIEW"]) {
  expect(`3e. ${status} can get a follow-up`, ids({ applications: [app("x", { status })] }).includes("followup:x"));
}
expect("3f. snoozed into the future is hidden", ids({ applications: [app("x", { followUpSnoozedUntil: days(3) })] }).length === 0);
expect("3g. an expired snooze comes back", ids({ applications: [app("x", { followUpSnoozedUntil: days(-1) })] }).includes("followup:x"));
expect(
  "3h. an application with a future interview is not nagged",
  ids({ applications: [app("x")], interviews: [interview("i", days(10), "x")] }).every((id) => id !== "followup:x")
);
expect(
  "3i. a PAST interview does not stop the nudge (you may be waiting to hear back)",
  ids({ applications: [app("x")], interviews: [interview("i", days(-3), "x")] }).includes("followup:x")
);
expect("3j. detail says how many days", run({ applications: [waiting(12)] }).items[0].detail.includes("no update for 12 days"), run({ applications: [waiting(12)] }).items[0]);
expect("3k. follow-ups are snoozable, others are not", run({ applications: [waiting(9)] }).items[0].snoozable === true && run({ reminders: [reminder("r", hours(-1))] }).items[0].snoozable === false);

// 4. waitingSince
expect("4a. uses the most recent of status change and application date", waitingSince(app("x", { lastStatusChangeAt: days(-10), applicationDate: days(-3) })).getTime() === days(-3).getTime());
expect("4b. status change newer than the typed date wins", waitingSince(app("x", { lastStatusChangeAt: days(-2), applicationDate: days(-20) })).getTime() === days(-2).getTime());
expect("4c. with neither, falls back to created date", waitingSince(app("x", { lastStatusChangeAt: null, applicationDate: null, createdAt: days(-40) })).getTime() === days(-40).getTime());
expect("4d. a future application date means not stale", ids({ applications: [app("x", { lastStatusChangeAt: null, applicationDate: days(5) })] }).length === 0);

// 5. Ordering and caps
const mixed = run({
  reminders: [reminder("late", hours(-30)), reminder("later", hours(-2)), reminder("soonish", hours(5))],
  interviews: [interview("far", hours(40)), interview("near", hours(3))],
  applications: [app("quiet1", { lastStatusChangeAt: days(-9) }), app("quiet2", { lastStatusChangeAt: days(-20) })],
});
expect(
  "5a. order: overdue, interviews (soonest first), due soon, follow-ups (longest wait first)",
  mixed.items.map((n) => n.id).join(",") === "reminder:late,reminder:later,interview:near,interview:far,reminder:soonish,followup:quiet2,followup:quiet1",
  mixed.items.map((n) => n.id)
);
expect("5b. every notification id is unique", new Set(mixed.items.map((n) => n.id)).size === mixed.items.length);

const many = run({ applications: Array.from({ length: 35 }, (_, i) => app(`m${i}`, { lastStatusChangeAt: days(-8 - i) })) });
expect("5c. list is capped but the true total is reported", many.items.length === MAX_NOTIFICATIONS && many.total === 35, { length: many.items.length, total: many.total });

// 6. Empty and defensive
const nothing = run({});
expect("6a. nothing to report gives an empty list, not an error", nothing.items.length === 0 && nothing.total === 0);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);