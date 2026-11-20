import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  validateLoginInput,
  validateRegisterInput,
  MAX_PASSWORD_BYTES,
} from "../../src/validators/auth.validator";
import { validateApplicationInput } from "../../src/validators/application.validator";
import { validateReminderInput, validateCompletedInput } from "../../src/validators/reminder.validator";
import { validateInterviewInput } from "../../src/validators/interview.validator";
import { parseDateInput } from "../../src/utils/datetime.util";
import { routeParam } from "../../src/utils/params.util";

const goodRegister = { email: "ada@example.com", password: "longenough1", name: "Ada" };

describe("validateRegisterInput", () => {
  it("accepts valid input", () => {
    expect(validateRegisterInput(goodRegister)).toBeNull();
  });

  it.each([
    ["a missing body", undefined],
    ["null", null],
    ["an array", [1, 2]],
    ["a string", "hello"],
  ])("returns a message (does not crash) for %s", (_label, body) => {
    expect(typeof validateRegisterInput(body)).toBe("string");
  });

  it.each([
    ["a numeric password", { ...goodRegister, password: 12345678 }],
    ["an object as email (NoSQL-style injection shape)", { ...goodRegister, email: { $ne: "" } }],
    ["an array as name", { ...goodRegister, name: ["a"] }],
    ["a blank name", { ...goodRegister, name: "   " }],
    ["a malformed email", { ...goodRegister, email: "not-an-email" }],
  ])("rejects %s", (_label, body) => {
    expect(typeof validateRegisterInput(body)).toBe("string");
  });

  describe("password length", () => {
    it("rejects 7 characters, accepts 8", () => {
      expect(validateRegisterInput({ ...goodRegister, password: "1234567" })).toMatch(/at least 8/);
      expect(validateRegisterInput({ ...goodRegister, password: "12345678" })).toBeNull();
    });

    it("accepts exactly 72 bytes and rejects 73 (bcrypt ignores everything after byte 72)", () => {
      expect(validateRegisterInput({ ...goodRegister, password: "a".repeat(MAX_PASSWORD_BYTES) })).toBeNull();
      expect(validateRegisterInput({ ...goodRegister, password: "a".repeat(MAX_PASSWORD_BYTES + 1) })).toMatch(
        /too long/
      );
    });

    it("counts BYTES, not characters: 30 emoji are 30 characters but 120 bytes", () => {
      expect(validateRegisterInput({ ...goodRegister, password: "😀".repeat(30) })).toMatch(/too long/);
    });
  });

  it("limits email (254) and name (100) length", () => {
    expect(typeof validateRegisterInput({ ...goodRegister, email: "a".repeat(250) + "@b.co" })).toBe("string");
    expect(typeof validateRegisterInput({ ...goodRegister, name: "n".repeat(101) })).toBe("string");
    expect(validateRegisterInput({ ...goodRegister, name: "n".repeat(100) })).toBeNull();
  });
});

describe("validateLoginInput", () => {
  it("accepts an email and password", () => {
    expect(validateLoginInput({ email: "a@b.co", password: "x" })).toBeNull();
  });

  it("rejects missing, non-string and oversized values", () => {
    expect(typeof validateLoginInput(undefined)).toBe("string");
    expect(typeof validateLoginInput({ email: "a@b.co" })).toBe("string");
    expect(typeof validateLoginInput({ email: "a@b.co", password: { x: 1 } })).toBe("string");
    expect(typeof validateLoginInput({ email: "a@b.co", password: "x".repeat(1001) })).toBe("string");
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases, so Ghost@Gmail.com and ghost@gmail.com are one account", () => {
    expect(normalizeEmail("  Ghost@Gmail.COM ")).toBe("ghost@gmail.com");
  });
});

describe("validateApplicationInput", () => {
  it("requires company and position", () => {
    expect(validateApplicationInput({ position: "Dev" })).toBe("Company is required.");
    expect(validateApplicationInput({ company: "  ", position: "Dev" })).toBe("Company is required.");
    expect(validateApplicationInput({ company: "Acme" })).toBe("Position is required.");
  });

  it("accepts every real status and rejects anything else", () => {
    for (const status of ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]) {
      expect(validateApplicationInput({ company: "A", position: "B", status })).toBeNull();
    }
    expect(validateApplicationInput({ company: "A", position: "B", status: "HIRED" })).toBe("Invalid status value.");
  });
});

describe("validateReminderInput / validateCompletedInput", () => {
  const due = "2026-12-01T09:00:00Z";

  it("accepts a title and a due time with a zone", () => {
    expect(validateReminderInput({ title: "Email recruiter", dueAt: due })).toBeNull();
  });

  it("rejects a missing title, a too-long title, and a bad due time", () => {
    expect(validateReminderInput({ dueAt: due })).toBe("Title is required.");
    expect(validateReminderInput({ title: "x".repeat(201), dueAt: due })).toMatch(/200 characters/);
    expect(validateReminderInput({ title: "x", dueAt: "tomorrow" })).toMatch(/valid due date/);
  });

  it("rejects a non-string applicationId", () => {
    expect(validateReminderInput({ title: "x", dueAt: due, applicationId: 5 })).toBe("Invalid application.");
    expect(validateReminderInput({ title: "x", dueAt: due, applicationId: null })).toBeNull();
  });

  it("completed must be a real boolean", () => {
    expect(validateCompletedInput({ completed: true })).toBeNull();
    expect(validateCompletedInput({ completed: "true" })).toBe("completed must be true or false.");
    expect(validateCompletedInput(undefined)).toBe("completed must be true or false.");
  });
});

describe("validateInterviewInput", () => {
  const good = { applicationId: "app-1", title: "Technical round", scheduledAt: "2026-12-01T09:00:00+05:30" };

  it("accepts valid input", () => {
    expect(validateInterviewInput(good, { requireApplication: true })).toBeNull();
  });

  it("requires an application when creating, but not when editing", () => {
    const { applicationId: _ignored, ...withoutApplication } = good;
    expect(validateInterviewInput(withoutApplication, { requireApplication: true })).toMatch(/Choose which application/);
    expect(validateInterviewInput(withoutApplication, { requireApplication: false })).toBeNull();
  });

  it("rejects a bad title, format, date and over-long notes", () => {
    const opts = { requireApplication: true };
    expect(validateInterviewInput({ ...good, title: "" }, opts)).toMatch(/Title is required/);
    expect(validateInterviewInput({ ...good, title: "x".repeat(121) }, opts)).toMatch(/120/);
    expect(validateInterviewInput({ ...good, format: "TELEPATHY" }, opts)).toBe("Invalid interview format.");
    expect(validateInterviewInput({ ...good, scheduledAt: "2026-12-01T09:00" }, opts)).toMatch(/valid date and time/);
    expect(validateInterviewInput({ ...good, notes: "n".repeat(2001) }, opts)).toMatch(/Notes/);
    expect(validateInterviewInput({ ...good, location: 5 }, opts)).toBe("Location must be text.");
  });
});

describe("parseDateInput", () => {
  it("accepts ISO 8601 with an explicit zone (Z or an offset)", () => {
    expect(parseDateInput("2026-10-30T09:30:00.000Z")?.toISOString()).toBe("2026-10-30T09:30:00.000Z");
    expect(parseDateInput("2026-10-30T15:00:00+05:30")?.toISOString()).toBe("2026-10-30T09:30:00.000Z");
    expect(parseDateInput("2026-10-30T09:30Z")).not.toBeNull();
  });

  it("rejects a time with no zone (the server would have to guess whose clock it is)", () => {
    expect(parseDateInput("2026-10-30T15:00")).toBeNull();
    expect(parseDateInput("2026-10-30")).toBeNull();
  });

  it("rejects loose strings that Date would happily misread", () => {
    expect(parseDateInput("5")).toBeNull();
    expect(parseDateInput("tomorrow")).toBeNull();
    expect(parseDateInput(1767225600000)).toBeNull();
    expect(parseDateInput(null)).toBeNull();
  });

  it("rejects impossible dates and years outside 2000-2100", () => {
    expect(parseDateInput("2026-13-45T09:00:00Z")).toBeNull();
    expect(parseDateInput("1999-12-31T23:59:00Z")).toBeNull();
    expect(parseDateInput("2101-01-01T00:00:00Z")).toBeNull();
  });
});

describe("routeParam", () => {
  it("returns a string param as is, the first of an array, and empty for undefined", () => {
    expect(routeParam("abc")).toBe("abc");
    expect(routeParam(["a", "b"])).toBe("a");
    expect(routeParam(undefined)).toBe("");
  });
});