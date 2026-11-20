import { describe, it, expect } from "vitest";
import { api } from "../helpers/api";

// Its own file because it uses up the whole 300-request budget for this address: nothing
// else in the same file could make a request afterwards. (Every test file starts with fresh
// limiter counters, so the other files are not affected.)

describe("the global limit on /api", () => {
  it("reports the limit in standard headers, and not in the old X-RateLimit-* ones", async () => {
    const res = await api().get("/api/does-not-exist"); // the very first request of this file
    expect(res.status).toBe(404);
    expect(res.headers["ratelimit-limit"]).toBe("300");
    expect(res.headers["ratelimit-remaining"]).toBe("299");
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });

  it("answers 429 to the 301st request within 15 minutes", async () => {
    for (let request = 2; request <= 300; request += 1) {
      const res = await api().get("/api/does-not-exist");
      if (res.status !== 404) throw new Error(`request ${request} answered ${res.status}, expected 404`);
    }

    const blocked = await api().get("/api/does-not-exist");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many requests\. Try again in \d+ minutes?\.$/),
    });
    const retryAfter = Number(blocked.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900);
  });

  it("never blocks the health check, so a hosting platform's probes cannot take the app 'down'", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
  });

  it("never counts or blocks OPTIONS (CORS preflight) requests", async () => {
    const res = await api().options("/api/does-not-exist");
    expect(res.status).not.toBe(429);
  });
});