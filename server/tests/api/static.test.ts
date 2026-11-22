import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express } from "express";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// The app reads SERVE_CLIENT when it is first imported, so each scenario sets the variables,
// clears the module cache, and imports a fresh copy of the app.
async function loadApp(settings: Record<string, string | undefined>): Promise<Express> {
  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
  return (await import("../../src/app")).default;
}

const dist = fs.mkdtempSync(path.join(os.tmpdir(), "careerpilot-dist-"));
const emptyDist = fs.mkdtempSync(path.join(os.tmpdir(), "careerpilot-empty-dist-"));

beforeAll(() => {
  fs.mkdirSync(path.join(dist, "assets"));
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html><title>CareerPilot test page</title>");
  fs.writeFileSync(path.join(dist, "assets", "app-abc123.js"), "console.log('hello');");
  fs.writeFileSync(path.join(dist, "favicon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
});

afterAll(() => {
  delete process.env.SERVE_CLIENT;
  delete process.env.CLIENT_DIST_DIR;
  fs.rmSync(dist, { recursive: true, force: true });
  fs.rmSync(emptyDist, { recursive: true, force: true });
});

describe("serving the built client (SERVE_CLIENT=true)", () => {
  let app: Express;
  beforeAll(async () => {
    app = await loadApp({ SERVE_CLIENT: "true", CLIENT_DIST_DIR: dist });
  });

  it("serves index.html at the root, never cached", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("CareerPilot test page");
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("serves index.html for a client-side route, so refreshing /analytics works", async () => {
    const res = await request(app).get("/analytics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("CareerPilot test page");
  });

  it("serves hashed assets with a one-year immutable cache", async () => {
    const res = await request(app).get("/assets/app-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.headers["cache-control"]).toMatch(/max-age=31536000/);
    expect(res.headers["cache-control"]).toMatch(/immutable/);
  });

  it("serves loose files such as the favicon", async () => {
    const res = await request(app).get("/favicon.svg");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/svg/);
  });

  it("answers a missing file with a real 404, not the app page", async () => {
    const res = await request(app).get("/assets/missing.js");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).not.toMatch(/text\/html/);
  });

  it("still answers unknown /api paths with the JSON 404 and no-store", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.success).toBe(false);
  });

  it("does not turn a POST to a page path into the app page", async () => {
    const res = await request(app).post("/analytics");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).not.toMatch(/text\/html/);
  });

  it("keeps the security headers on the pages too", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("when SERVE_CLIENT is off (development and the normal test setup)", () => {
  it("does not serve any page: the root is the JSON 404", async () => {
    const app = await loadApp({ SERVE_CLIENT: undefined, CLIENT_DIST_DIR: undefined });
    const res = await request(app).get("/");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});

describe("a broken hosted setup", () => {
  it("refuses to start when the built client is missing, and says how to fix it", async () => {
    await expect(loadApp({ SERVE_CLIENT: "true", CLIENT_DIST_DIR: emptyDist })).rejects.toThrow(/index\.html/);
  });
});