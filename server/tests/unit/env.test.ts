import path from "node:path";
import { describe, it, expect } from "vitest";
import { parseEnv } from "../../src/config/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(40),
};
const production = { ...base, NODE_ENV: "production", CLIENT_URL: "https://app.example.com" };

describe("parseEnv", () => {
  it("accepts a minimal valid development configuration and fills in defaults", () => {
    const { env, errors } = parseEnv(base);
    expect(errors).toEqual([]);
    expect(env).toMatchObject({
      nodeEnv: "development",
      isProduction: false,
      port: 5000,
      clientOrigins: ["http://localhost:5173"],
      cookieSameSite: "lax",
      trustProxy: 0,
      serveClient: false,
    });
  });

  it("requires JWT_SECRET", () => {
    const result = parseEnv({ ...base, JWT_SECRET: "" });
    expect(result.env).toBeNull();
    expect(result.errors.some((message) => message.includes("JWT_SECRET"))).toBe(true);
  });

  it("requires DATABASE_URL, and rejects prisma+postgres:// URLs", () => {
    expect(parseEnv({ ...base, DATABASE_URL: undefined }).env).toBeNull();
    expect(parseEnv({ ...base, DATABASE_URL: "prisma+postgres://localhost" }).env).toBeNull();
  });

  describe("JWT_SECRET strength", () => {
    it("is only a warning in development", () => {
      const result = parseEnv({ ...base, JWT_SECRET: "short" });
      expect(result.env).not.toBeNull();
      expect(result.warnings).toHaveLength(1);
    });

    it("is an error in production", () => {
      expect(parseEnv({ ...production, JWT_SECRET: "short" }).env).toBeNull();
    });

    it("rejects a placeholder secret in production", () => {
      expect(parseEnv({ ...production, JWT_SECRET: "your_jwt_secret" }).env).toBeNull();
    });

    it("accepts a strong secret in production", () => {
      expect(parseEnv(production).env).not.toBeNull();
    });
  });

  describe("CLIENT_URL", () => {
    it("rejects plain http:// in production (except localhost)", () => {
      expect(parseEnv({ ...production, CLIENT_URL: "http://app.example.com" }).env).toBeNull();
      expect(parseEnv({ ...production, CLIENT_URL: "http://localhost:5173" }).env).not.toBeNull();
    });

    it("removes a trailing slash, which would otherwise silently break CORS", () => {
      const { env } = parseEnv({ ...base, CLIENT_URL: "https://app.example.com/" });
      expect(env?.clientOrigins).toEqual(["https://app.example.com"]);
    });

    it("supports several comma-separated origins", () => {
      const { env } = parseEnv({ ...base, CLIENT_URL: "http://localhost:5173, https://a.example.com" });
      expect(env?.clientOrigins).toEqual(["http://localhost:5173", "https://a.example.com"]);
    });

    it("rejects something that is not a URL", () => {
      expect(parseEnv({ ...base, CLIENT_URL: "not a url" }).env).toBeNull();
    });
  });

  describe("COOKIE_SAME_SITE", () => {
    it("refuses none outside production (browsers only accept it on Secure cookies)", () => {
      expect(parseEnv({ ...base, COOKIE_SAME_SITE: "none" }).env).toBeNull();
    });

    it("allows none in production", () => {
      expect(parseEnv({ ...production, COOKIE_SAME_SITE: "none" }).env?.cookieSameSite).toBe("none");
    });

    it("rejects unknown values", () => {
      expect(parseEnv({ ...base, COOKIE_SAME_SITE: "sometimes" }).env).toBeNull();
    });
  });

  it("rejects a non-numeric or out-of-range PORT", () => {
    expect(parseEnv({ ...base, PORT: "abc" }).env).toBeNull();
    expect(parseEnv({ ...base, PORT: "70000" }).env).toBeNull();
    expect(parseEnv({ ...base, PORT: "8080" }).env?.port).toBe(8080);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(parseEnv({ ...base, NODE_ENV: "staging" }).env).toBeNull();
  });

  it("rejects a bad TRUST_PROXY", () => {
    expect(parseEnv({ ...base, TRUST_PROXY: "-1" }).env).toBeNull();
    expect(parseEnv({ ...base, TRUST_PROXY: "1" }).env?.trustProxy).toBe(1);
  });

  describe("UPLOAD_DIR", () => {
    it("defaults to server/uploads/resumes", () => {
      const { env } = parseEnv(base);
      expect(env?.uploadDir.endsWith(path.join("uploads", "resumes"))).toBe(true);
      expect(path.isAbsolute(env!.uploadDir)).toBe(true);
    });

    it("is always made absolute, so it does not depend on where the server was started", () => {
      const { env } = parseEnv({ ...base, UPLOAD_DIR: "some/relative/dir" });
      expect(path.isAbsolute(env!.uploadDir)).toBe(true);
    });
  });

  describe("SERVE_CLIENT", () => {
    it("is off by default, so development keeps using the Vite dev server", () => {
      expect(parseEnv(base).env?.serveClient).toBe(false);
    });

    it("accepts true and false in any capitalisation", () => {
      expect(parseEnv({ ...base, SERVE_CLIENT: "true" }).env?.serveClient).toBe(true);
      expect(parseEnv({ ...base, SERVE_CLIENT: "TRUE" }).env?.serveClient).toBe(true);
      expect(parseEnv({ ...base, SERVE_CLIENT: "false" }).env?.serveClient).toBe(false);
    });

    it("rejects anything else, instead of silently treating it as off", () => {
      const result = parseEnv({ ...base, SERVE_CLIENT: "yes" });
      expect(result.env).toBeNull();
      expect(result.errors.some((message) => message.includes("SERVE_CLIENT"))).toBe(true);
    });
  });

  describe("CLIENT_DIST_DIR", () => {
    it("defaults to client/dist next to the server folder", () => {
      const { env } = parseEnv(base);
      expect(env?.clientDistDir.endsWith(path.join("client", "dist"))).toBe(true);
      expect(path.isAbsolute(env!.clientDistDir)).toBe(true);
    });

    it("is always made absolute", () => {
      const { env } = parseEnv({ ...base, CLIENT_DIST_DIR: "somewhere/dist" });
      expect(path.isAbsolute(env!.clientDistDir)).toBe(true);
    });
  });

  it("reports every problem at once, not just the first", () => {
    const { errors } = parseEnv({ NODE_ENV: "staging", PORT: "abc" });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});