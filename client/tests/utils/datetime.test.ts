import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  defaultLocalInputValue,
  formatDateTime,
  formatRelative,
  fromLocalInputValue,
  toLocalInputValue,
} from "../../src/utils/datetime";

// These helpers convert between the person's LOCAL time and exact UTC moments, so the tests
// pin the time zone. India has no daylight saving, which makes the expected values fixed:
// local time is always UTC + 5:30.
beforeAll(() => {
  vi.stubEnv("TZ", "Asia/Kolkata");
});

describe("toLocalInputValue", () => {
  it("shows a UTC moment in the person's local time, in the format a datetime-local input wants", () => {
    expect(toLocalInputValue("2026-12-01T09:30:00.000Z")).toBe("2026-12-01T15:00");
  });

  it("rolls over to the next day when local time is past midnight", () => {
    expect(toLocalInputValue("2026-12-31T20:00:00.000Z")).toBe("2027-01-01T01:30");
  });

  it("pads single-digit months, days, hours and minutes with a zero", () => {
    expect(toLocalInputValue("2026-03-04T00:05:00.000Z")).toBe("2026-03-04T05:35");
  });
});

describe("fromLocalInputValue", () => {
  it("turns what the person typed (local time) into an exact UTC moment", () => {
    expect(fromLocalInputValue("2026-12-01T15:00")).toBe("2026-12-01T09:30:00.000Z");
  });

  it("returns null for an empty field", () => {
    expect(fromLocalInputValue("")).toBeNull();
  });

  it("returns null for text that is not a date", () => {
    expect(fromLocalInputValue("not a date")).toBeNull();
  });

  it("is the exact reverse of toLocalInputValue", () => {
    const iso = "2027-06-15T03:45:00.000Z";
    expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso);
  });
});

describe("defaultLocalInputValue", () => {
  const now = new Date("2026-12-01T09:40:00.000Z"); // 15:10 local

  it("is the next whole hour, the given number of hours ahead", () => {
    expect(defaultLocalInputValue(2, now)).toBe("2026-12-01T17:00");
  });

  it("drops the minutes even when they would round up", () => {
    expect(defaultLocalInputValue(1, new Date("2026-12-01T09:59:00.000Z"))).toBe("2026-12-01T16:00");
  });
});

describe("formatDateTime", () => {
  it("includes the weekday, month, day and time in the person's time zone", () => {
    // The exact layout depends on the locale, so check the parts rather than one string.
    const text = formatDateTime("2026-12-01T09:30:00.000Z"); // Tuesday 15:00 local
    expect(text).toContain("Tue");
    expect(text).toContain("Dec");
    expect(text).toMatch(/\b1\b/);
    expect(text).toMatch(/3:00/);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-12-01T12:00:00.000Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

  it.each([
    ["half a minute from now", 0.5, "now"],
    ["half a minute ago", -0.5, "now"],
    ["30 minutes ahead", 30, "in 30 minutes"],
    ["45 minutes ago", -45, "45 minutes ago"],
    ["3 hours ahead", 180, "in 3 hours"],
    ["5 hours ago", -300, "5 hours ago"],
    ["47 hours ahead (still counted in hours)", 47 * 60, "in 47 hours"],
    ["3 days ahead", 72 * 60, "in 3 days"],
    ["2 days ago", -50 * 60, "2 days ago"],
  ])("%s", (_label, minutes, expected) => {
    expect(formatRelative(at(minutes), now)).toBe(expected);
  });
});