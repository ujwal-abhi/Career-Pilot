import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase, type TestUser } from "../helpers/db";

useCleanDatabase();

// Each test FILE gets fresh limiter counters (the limiters live in memory and every file loads
// its own copy of the app), so the numbers here start from zero. Login has its own files:
// ratelimit.login.test.ts and ratelimit.login-ip.test.ts.

describe("registration", () => {
  it("allows 10 requests per hour from one address, then answers 429 and creates nothing", async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const res = await api().post("/api/auth/register").send({});
      expect(res.status, `request ${attempt}`).toBe(400); // rejected as invalid, but still counted
    }

    const blocked = await api().post("/api/auth/register").send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many accounts created from this address\. Try again in \d+ minutes?\.$/),
    });
    const retryAfter = Number(blocked.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600);

    // A perfectly valid sign-up is refused too while the limit is active.
    const valid = await api()
      .post("/api/auth/register")
      .send({ email: "late-comer@example.com", password: "correct-horse-battery", name: "Late" });
    expect(valid.status).toBe(429);
    expect(await prisma.user.count({ where: { email: "late-comer@example.com" } })).toBe(0);
  });
});

describe("AI generation", () => {
  let exhausted: TestUser;

  beforeAll(async () => {
    exhausted = await createUser("ai-heavy");
    for (let request = 1; request <= 60; request += 1) {
      // The resume does not exist, so each of these is a cheap 404, but it still counts.
      const res = await api().post("/api/ai/resume-analysis/nope").set("Cookie", exhausted.cookie);
      if (res.status !== 404) throw new Error(`request ${request} answered ${res.status}, expected 404`);
    }
  });

  it("answers 429 to the 61st generating request within 15 minutes", async () => {
    const res = await api().post("/api/ai/resume-analysis/nope").set("Cookie", exhausted.cookie);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: expect.stringMatching(/^You are generating results too quickly\. Try again in \d+ minutes?\.$/),
    });
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("does not limit reading saved results", async () => {
    const res = await api().get("/api/ai/resume-analysis/nope").set("Cookie", exhausted.cookie);
    expect(res.status).toBe(404);
  });

  it("counts each user separately", async () => {
    const other = await createUser("ai-light");
    const res = await api().post("/api/ai/resume-analysis/nope").set("Cookie", other.cookie);
    expect(res.status).toBe(404);
  });
});

describe("uploads", () => {
  let exhausted: TestUser;

  beforeAll(async () => {
    exhausted = await createUser("uploader");
    for (let request = 1; request <= 20; request += 1) {
      // No file attached, so each of these is a cheap 400, but it still counts.
      const res = await api().post("/api/resumes").set("Cookie", exhausted.cookie);
      if (res.status !== 400) throw new Error(`request ${request} answered ${res.status}, expected 400`);
    }
  });

  it("answers 429 to the 21st upload request within an hour", async () => {
    const res = await api().post("/api/resumes").set("Cookie", exhausted.cookie);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many uploads\. Try again in \d+ minutes?\.$/),
    });
  });

  it("counts each user separately", async () => {
    const other = await createUser("quiet");
    const res = await api().post("/api/resumes").set("Cookie", other.cookie);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No file was uploaded.");
  });
});