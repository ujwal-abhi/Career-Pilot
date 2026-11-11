import dotenv from "dotenv";

// One place that reads process.env, checks it, and exposes typed values.
//
// Why: before this, JWT_SECRET was read with `process.env.JWT_SECRET as string`. If it was
// missing, the server started happily and then failed on the first login with a confusing
// error. It also only worked because another file happened to call dotenv.config() first.
// Now a bad configuration stops the server at startup with a message that says what to fix.

export type SameSite = "lax" | "strict" | "none";

export interface Env {
  nodeEnv: "development" | "production" | "test";
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  clientOrigins: string[]; // exact origins the browser app is served from
  cookieSameSite: SameSite;
  trustProxy: number; // how many reverse proxies sit in front of the server
}

export interface EnvResult {
  env: Env | null; // null when there are errors
  errors: string[];
  warnings: string[];
}

const PLACEHOLDER_SECRETS = /^(secret|changeme|change-me|password|jwt[-_ ]?secret|your[-_ ]?(jwt[-_ ]?)?secret.*)$/i;

// Pure: takes the variables as an argument instead of reading process.env, so it can be
// tested with plain objects.
export function parseEnv(source: Record<string, string | undefined>): EnvResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawNodeEnv = (source.NODE_ENV ?? "development").trim();
  let nodeEnv: Env["nodeEnv"] = "development";
  if (rawNodeEnv === "development" || rawNodeEnv === "production" || rawNodeEnv === "test") {
    nodeEnv = rawNodeEnv;
  } else {
    errors.push(`NODE_ENV must be development, production or test (got "${rawNodeEnv}").`);
  }
  const isProduction = nodeEnv === "production";

  // PORT
  const rawPort = (source.PORT ?? "5000").trim();
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    errors.push(`PORT must be a whole number between 1 and 65535 (got "${rawPort}").`);
  }

  // DATABASE_URL
  const databaseUrl = (source.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    errors.push("DATABASE_URL is required.");
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push("DATABASE_URL must start with postgresql:// (not prisma+postgres://).");
  }

  // JWT_SECRET: this signs every login cookie. Anyone who knows it can forge a login.
  const jwtSecret = (source.JWT_SECRET ?? "").trim();
  if (!jwtSecret) {
    errors.push("JWT_SECRET is required.");
  } else if (isProduction) {
    if (jwtSecret.length < 32) {
      errors.push("JWT_SECRET must be at least 32 characters in production.");
    }
    if (PLACEHOLDER_SECRETS.test(jwtSecret)) {
      errors.push("JWT_SECRET is still a placeholder value. Generate a random one.");
    }
  } else if (jwtSecret.length < 32) {
    warnings.push("JWT_SECRET is shorter than 32 characters. That is tolerated in development but rejected in production.");
  }

  // CLIENT_URL: one or more comma-separated origins. Normalised with new URL().origin so a
  // trailing slash ("https://app.com/") cannot silently break CORS and the origin check.
  const rawClientUrl = (source.CLIENT_URL ?? "http://localhost:5173").trim();
  const clientOrigins: string[] = [];
  for (const part of rawClientUrl.split(",").map((value) => value.trim()).filter(Boolean)) {
    try {
      const url = new URL(part);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (isProduction && url.protocol === "http:" && !isLocal) {
        errors.push(`CLIENT_URL "${part}" must use https:// in production.`);
      }
      clientOrigins.push(url.origin);
    } catch {
      errors.push(`CLIENT_URL contains an invalid URL: "${part}".`);
    }
  }
  if (clientOrigins.length === 0 && errors.every((message) => !message.startsWith("CLIENT_URL"))) {
    errors.push("CLIENT_URL must contain at least one URL.");
  }

  // COOKIE_SAME_SITE
  const rawSameSite = (source.COOKIE_SAME_SITE ?? "lax").trim().toLowerCase();
  let cookieSameSite: SameSite = "lax";
  if (rawSameSite === "lax" || rawSameSite === "strict" || rawSameSite === "none") {
    cookieSameSite = rawSameSite;
  } else {
    errors.push(`COOKIE_SAME_SITE must be lax, strict or none (got "${rawSameSite}").`);
  }
  if (cookieSameSite === "none" && !isProduction) {
    errors.push("COOKIE_SAME_SITE=none needs NODE_ENV=production, because browsers only accept it on Secure cookies.");
  }

  // TRUST_PROXY: number of reverse proxies in front of the app (0 when none).
  const rawTrustProxy = (source.TRUST_PROXY ?? "0").trim();
  const trustProxy = Number(rawTrustProxy);
  if (!/^\d+$/.test(rawTrustProxy) || trustProxy > 10) {
    errors.push(`TRUST_PROXY must be a whole number between 0 and 10 (got "${rawTrustProxy}").`);
  }

  if (errors.length > 0) return { env: null, errors, warnings };

  return {
    env: { nodeEnv, isProduction, port, databaseUrl, jwtSecret, clientOrigins, cookieSameSite, trustProxy },
    errors,
    warnings,
  };
}

function loadEnv(): Env {
  dotenv.config({ quiet: true });
  const result = parseEnv(process.env);

  for (const warning of result.warnings) console.warn(`[config] Warning: ${warning}`);

  if (!result.env) {
    console.error("\nCareerPilot cannot start because the server configuration is invalid:\n");
    for (const error of result.errors) console.error(`  - ${error}`);
    console.error("\nFix server/.env (see server/.env.example) and start again.\n");
    process.exit(1);
  }
  return result.env;
}

export const env: Env = loadEnv();