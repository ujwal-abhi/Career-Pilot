import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase } from "../helpers/db";

useCleanDatabase();

const ALLOWED_ORIGIN = "http://localhost:5173"; // CLIENT_URL in vitest.config.mts

describe("response headers", () => {
  it("sends the helmet security headers and hides that the server is Express", async () => {
    const res = await api().get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("tells browsers and proxies never to store API responses", async () => {
    expect((await api().get("/api/health")).headers["cache-control"]).toBe("no-store");
    expect((await api().get("/api/auth/me")).headers["cache-control"]).toBe("no-store"); // even a 401
  });
});

describe("health check", () => {
  it("answers 200 with a status and timestamp, without logging in", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(Number.isNaN(Date.parse(res.body.data.timestamp))).toBe(false);
  });
});

describe("error handling", () => {
  it("returns JSON (not an HTML page) for an unknown route", async () => {
    const res = await api().get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Not found." });
  });

  it("returns 400 JSON for a malformed JSON body, without leaking parser details", async () => {
    const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "The request body is not valid JSON." });
  });

  it("returns 413 for a body over 100 KB", async () => {
    const res = await api().post("/api/auth/logout").send({ filler: "x".repeat(150 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it("never exposes a stack trace or file path in an error", async () => {
    const res = await api().post("/api/auth/login").set("Content-Type", "application/json").send("{bad");
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/node_modules|\.ts:|at \w+ \(/);
  });
});

describe("CSRF: the Origin check on requests that change data", () => {
  it("blocks a POST from another website, and does nothing", async () => {
    const user = await createUser("csrf");
    const before = await prisma.application.count();
    const res = await api()
      .post("/api/applications")
      .set("Cookie", user.cookie)
      .set("Origin", "https://evil.example")
      .send({ company: "Evil Corp", position: "Spy" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/untrusted origin/);
    expect(await prisma.application.count()).toBe(before);
  });

  it("blocks the literal origin \"null\" (sandboxed pages and some redirects)", async () => {
    const res = await api().post("/api/auth/logout").set("Origin", "null");
    expect(res.status).toBe(403);
  });

  it("blocks PUT and DELETE too, not just POST", async () => {
    const user = await createUser("csrf2");
    for (const method of ["put", "delete", "patch"] as const) {
      const res = await api()[method]("/api/applications/some-id").set("Cookie", user.cookie).set("Origin", "https://evil.example").send({});
      expect(res.status).toBe(403);
    }
  });

  it("allows our own front end", async () => {
    const user = await createUser("csrf3");
    const res = await api().post("/api/applications").set("Cookie", user.cookie).set("Origin", ALLOWED_ORIGIN).send({ company: "Acme", position: "Dev" });
    expect(res.status).toBe(201);
  });

  it("allows a request with no Origin (scripts, curl, tests), since only browsers carry a CSRF risk", async () => {
    const user = await createUser("csrf4");
    const res = await api().post("/api/applications").set("Cookie", user.cookie).send({ company: "Acme", position: "Dev" });
    expect(res.status).toBe(201);
  });

  it("does not apply to reads: a GET from another origin is not blocked by this check", async () => {
    const res = await api().get("/api/health").set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });
});

describe("CORS", () => {
  it("lets our front end read responses, with cookies", async () => {
    const res = await api().options("/api/applications").set("Origin", ALLOWED_ORIGIN).set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("gives another origin no permission", async () => {
    const res = await api().options("/api/applications").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("every protected route rejects a visitor who is not logged in", () => {
  const protectedRoutes: [string, string][] = [
    ["get", "/api/auth/me"],
    ["get", "/api/dashboard"],
    ["get", "/api/analytics"],
    ["get", "/api/applications"],
    ["post", "/api/applications"],
    ["get", "/api/applications/x"],
    ["put", "/api/applications/x"],
    ["delete", "/api/applications/x"],
    ["get", "/api/resumes"],
    ["post", "/api/resumes"],
    ["get", "/api/resumes/x/download"],
    ["delete", "/api/resumes/x"],
    ["put", "/api/resumes/x/default"],
    ["post", "/api/ai/resume-analysis/x"],
    ["get", "/api/ai/resume-analysis/x"],
    ["get", "/api/ai/job-match/options"],
    ["post", "/api/ai/job-match"],
    ["get", "/api/ai/job-match/x/y"],
    ["post", "/api/ai/resume-tailor"],
    ["get", "/api/ai/resume-tailor/x/y"],
    ["post", "/api/ai/interview-questions"],
    ["get", "/api/ai/interview-questions/x/y"],
    ["post", "/api/ai/practice/attempts"],
    ["get", "/api/ai/practice/questions/x/attempts"],
    ["get", "/api/ai/practice/weak-areas"],
    ["get", "/api/interviews"],
    ["post", "/api/interviews"],
    ["put", "/api/interviews/x"],
    ["delete", "/api/interviews/x"],
    ["get", "/api/reminders"],
    ["post", "/api/reminders"],
    ["patch", "/api/reminders/x/completed"],
    ["delete", "/api/reminders/x"],
    ["get", "/api/notifications"],
    ["post", "/api/notifications/follow-ups/x/snooze"],
  ];

  it.each(protectedRoutes)("%s %s -> 401", async (method, path) => {
    const res = await (api() as unknown as Record<string, (p: string) => import("supertest").Test>)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});