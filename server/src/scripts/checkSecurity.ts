// Security checks, in two parts.
//
//   Part 1 (no server needed): the pure rules. Config parsing, input validation, the origin
//           rule, PDF detection, token verification.
//   Part 2 (needs `npm run dev` running in another terminal): real HTTP requests against the
//           running server. Headers, error handling, cookies, CSRF, forged tokens, access to
//           other people's data, uploads, and brute-force protection.
//
// Run from the server folder:   npm run check:security
// It creates two temporary users in your development database and deletes them at the end.
// It deliberately trips the login rate limit, so it uses part of the failed-login budget for
// your address (20 per 15 minutes). Running it twice in 15 minutes is fine; a third run will
// be rate limited. If that happens, wait 15 minutes or restart the server.

import fs from "fs";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { env, parseEnv } from "../config/env";
import { signToken, verifyToken } from "../utils/jwt.util";
import { hashPassword } from "../utils/password.util";
import { getUploadDir } from "../services/storage.service";
import { isTrustedOrigin } from "../middleware/security.middleware";
import { looksLikePdf } from "../middleware/upload.middleware";
import {
  normalizeEmail,
  validateLoginInput,
  validateRegisterInput,
} from "../validators/auth.validator";

let failures = 0;
function expect(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

// ------------------------------------------------------------------------------------------
// PART 1: pure rules
// ------------------------------------------------------------------------------------------
function runPureChecks() {
  console.log("\n--- Part 1: pure rules ---");

  // Environment parsing
  const good = { DATABASE_URL: "postgresql://u:p@localhost:5432/db", JWT_SECRET: "x".repeat(40) };
  const prod = { ...good, NODE_ENV: "production", CLIENT_URL: "https://app.example.com" };
  expect("1a. a minimal valid development config is accepted", parseEnv(good).env !== null, parseEnv(good).errors);
  expect("1b. missing JWT_SECRET is an error", parseEnv({ ...good, JWT_SECRET: "" }).errors.some((e) => e.includes("JWT_SECRET")));
  expect("1c. missing DATABASE_URL is an error", parseEnv({ ...good, DATABASE_URL: undefined }).errors.some((e) => e.includes("DATABASE_URL")));
  expect("1d. prisma+postgres:// URL is rejected", parseEnv({ ...good, DATABASE_URL: "prisma+postgres://localhost" }).env === null);
  expect("1e. production accepts a strong secret over https", parseEnv(prod).env !== null, parseEnv(prod).errors);
  expect("1f. production rejects a short secret", parseEnv({ ...prod, JWT_SECRET: "short" }).env === null);
  expect("1g. production rejects a placeholder secret even if long enough", parseEnv({ ...prod, JWT_SECRET: "your_jwt_secret" }).env === null || parseEnv({ ...prod, JWT_SECRET: "your-secret-goes-here-and-is-long-enough!!" }).env === null);
  expect("1h. development only WARNS about a short secret", parseEnv({ ...good, JWT_SECRET: "short" }).warnings.length === 1 && parseEnv({ ...good, JWT_SECRET: "short" }).env !== null);
  expect("1i. production rejects an http:// client URL", parseEnv({ ...prod, CLIENT_URL: "http://app.example.com" }).env === null);
  expect("1j. a trailing slash on CLIENT_URL is normalised away", parseEnv({ ...good, CLIENT_URL: "https://app.example.com/" }).env?.clientOrigins[0] === "https://app.example.com");
  expect("1k. several client origins are supported", parseEnv({ ...good, CLIENT_URL: "http://localhost:5173, https://a.example.com" }).env?.clientOrigins.length === 2);
  expect("1l. COOKIE_SAME_SITE=none is refused outside production", parseEnv({ ...good, COOKIE_SAME_SITE: "none" }).env === null);
  expect("1m. COOKIE_SAME_SITE=none is allowed in production", parseEnv({ ...prod, COOKIE_SAME_SITE: "none" }).env?.cookieSameSite === "none");
  expect("1n. a non-numeric PORT is an error", parseEnv({ ...good, PORT: "abc" }).env === null);
  expect("1o. an unknown NODE_ENV is an error", parseEnv({ ...good, NODE_ENV: "staging" }).env === null);

  // Registration and login input
  const okRegister = { email: "a@b.co", password: "longenough1", name: "Ada" };
  expect("2a. valid registration passes", validateRegisterInput(okRegister) === null);
  expect("2b. a missing body gives a message instead of crashing", typeof validateRegisterInput(undefined) === "string");
  expect("2c. an array body is rejected", typeof validateRegisterInput([1, 2]) === "string");
  expect("2d. a non-string password is rejected", typeof validateRegisterInput({ ...okRegister, password: 12345678 }) === "string");
  expect("2e. an object as email is rejected", typeof validateRegisterInput({ ...okRegister, email: { $ne: "" } }) === "string");
  expect("2f. 7 character password is rejected", typeof validateRegisterInput({ ...okRegister, password: "1234567" }) === "string");
  expect("2g. a 72 byte password is accepted", validateRegisterInput({ ...okRegister, password: "a".repeat(72) }) === null);
  expect("2h. a 73 byte password is rejected (bcrypt would ignore the 73rd)", typeof validateRegisterInput({ ...okRegister, password: "a".repeat(73) }) === "string");
  expect("2i. 30 emoji is only 30 characters but 120 bytes, so it is rejected", typeof validateRegisterInput({ ...okRegister, password: "😀".repeat(30) }) === "string");
  expect("2j. a 255 character email is rejected", typeof validateRegisterInput({ ...okRegister, email: "a".repeat(250) + "@b.co" }) === "string");
  expect("2k. a 101 character name is rejected", typeof validateRegisterInput({ ...okRegister, name: "n".repeat(101) }) === "string");
  expect("2l. login with a missing body gives a message", typeof validateLoginInput(undefined) === "string");
  expect("2m. login with a non-string password is rejected", typeof validateLoginInput({ email: "a@b.co", password: { x: 1 } }) === "string");
  expect("2n. email normalisation trims and lower-cases", normalizeEmail("  Ghost@Gmail.COM ") === "ghost@gmail.com");

  // Origin rule (CSRF)
  const allowed = ["http://localhost:5173"];
  expect("3a. no Origin header is allowed (not a browser)", isTrustedOrigin(undefined, allowed));
  expect("3b. our own origin is allowed", isTrustedOrigin("http://localhost:5173", allowed));
  expect("3c. another site is refused", !isTrustedOrigin("https://evil.example", allowed));
  expect("3d. the literal string null is refused", !isTrustedOrigin("null", allowed));
  expect("3e. a look-alike that starts with our origin is refused", !isTrustedOrigin("http://localhost:5173.evil.example", allowed));

  // PDF detection
  expect("4a. a PDF header is recognised", looksLikePdf(Buffer.from("%PDF-1.7\n...")));
  expect("4b. junk before the header is tolerated, as the PDF spec allows", looksLikePdf(Buffer.from("\n\n  junk %PDF-1.4")));
  expect("4c. HTML is not a PDF", !looksLikePdf(Buffer.from("<html><script>alert(1)</script>")));
  expect("4d. a PDF marker far past the first 1024 bytes does not count", !looksLikePdf(Buffer.concat([Buffer.alloc(2000, 65), Buffer.from("%PDF-")])));
  expect("4e. an empty file is not a PDF", !looksLikePdf(Buffer.alloc(0)));

  // Tokens
  const goodToken = signToken({ userId: "user-1" });
  expect("5a. a token we signed verifies", verifyToken(goodToken).userId === "user-1");
  expect("5b. a token signed with another secret is rejected", throws(() => verifyToken(jwt.sign({ userId: "user-1" }, "some-other-secret-value-1234567890"))));
  const noneToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({ userId: "user-1" })}.`;
  expect("5c. an unsigned (alg none) token is rejected", throws(() => verifyToken(noneToken)));
  expect("5d. a correctly signed token with a non-string userId is rejected", throws(() => verifyToken(jwt.sign({ userId: { admin: true } }, env.jwtSecret))));
  expect("5e. an expired token is rejected", throws(() => verifyToken(jwt.sign({ userId: "u" }, env.jwtSecret, { expiresIn: -10 }))));
  expect("5f. a token signed with a different algorithm is rejected", throws(() => verifyToken(jwt.sign({ userId: "u" }, env.jwtSecret, { algorithm: "HS512" }))));
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// ------------------------------------------------------------------------------------------
// PART 2: a running server
// ------------------------------------------------------------------------------------------
const BASE = process.env.BASE_URL ?? `http://localhost:${env.port}`;

interface Reply {
  status: number;
  body: any;
  headers: Headers;
}

async function call(method: string, path: string, options: { token?: string; body?: unknown; rawBody?: string; origin?: string; form?: FormData } = {}): Promise<Reply> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Cookie = `token=${options.token}`;
  if (options.origin) headers.Origin = options.origin;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed, headers: response.headers };
}

const uploadCount = () => (fs.existsSync(getUploadDir()) ? fs.readdirSync(getUploadDir()).length : 0);

async function runLiveChecks() {
  console.log(`\n--- Part 2: running server at ${BASE} ---`);

  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    expect("0. the server is reachable (start it with `npm run dev` in another terminal)", false);
    return;
  }

  const password = "CorrectHorse1!";
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const emailA = `sec-a-${stamp}@example.test`;
  const emailB = `sec-b-${stamp}@example.test`;
  const hash = await hashPassword(password);
  const userA = await prisma.user.create({ data: { email: emailA, password: hash, name: "Security Test A" } });
  const userB = await prisma.user.create({ data: { email: emailB, password: hash, name: "Security Test B" } });

  try {
    const tokenA = signToken({ userId: userA.id });
    const tokenB = signToken({ userId: userB.id });
    const goodOrigin = env.clientOrigins[0];

    // Headers and error shape
    const health = await call("GET", "/api/health");
    expect("6a. X-Content-Type-Options: nosniff", health.headers.get("x-content-type-options") === "nosniff");
    expect("6b. framing is denied (X-Frame-Options)", Boolean(health.headers.get("x-frame-options")));
    expect("6c. a Content-Security-Policy is sent", Boolean(health.headers.get("content-security-policy")));
    expect("6d. the X-Powered-By: Express header is gone", health.headers.get("x-powered-by") === null);
    expect("6e. API responses are Cache-Control: no-store", health.headers.get("cache-control") === "no-store");

    const missing = await call("GET", "/api/definitely-not-a-route");
    expect("7a. an unknown route is a JSON 404", missing.status === 404 && missing.body?.success === false, missing);
    const badJson = await call("POST", "/api/applications", { token: tokenA, rawBody: "{not json" });
    expect("7b. malformed JSON is a 400, not a 500", badJson.status === 400, badJson);
    const huge = await call("POST", "/api/applications", { token: tokenA, rawBody: JSON.stringify({ company: "x".repeat(200_000) }) });
    expect("7c. an oversized body is a 413", huge.status === 413, huge.status);
    const noBody = await call("POST", "/api/auth/login");
    expect("7d. login with no body is a 400, not a crash", noBody.status === 400, noBody);
    const wrongType = await call("POST", "/api/auth/register", { body: { email: "a@b.co", password: 12345678, name: "x" } });
    expect("7e. register with a numeric password is a 400", wrongType.status === 400, wrongType);

    // Login behaviour
    const unknownEmail = await call("POST", "/api/auth/login", { body: { email: `nobody-${stamp}@example.test`, password } });
    if (unknownEmail.status === 429) {
      // Not a bug: earlier runs used up this address's failed-login budget. Say so once and stop.
      expect("8. the login limiter is not already tripped by earlier runs (wait 15 minutes or restart the server, then run again)", false);
      return;
    }
    const wrongPassword = await call("POST", "/api/auth/login", { body: { email: emailA, password: "wrong-password-1" } });
    expect("8a. unknown email and wrong password give the same status and message", unknownEmail.status === 401 && wrongPassword.status === 401 && unknownEmail.body.message === wrongPassword.body.message, { unknownEmail: unknownEmail.body, wrongPassword: wrongPassword.body });

    const login = await call("POST", "/api/auth/login", { body: { email: emailA, password } });
    const setCookie = (login.headers.getSetCookie?.() ?? []).join(" | ");
    expect("8b. correct login works", login.status === 200, login);
    expect("8c. the login cookie is HttpOnly", /HttpOnly/i.test(setCookie), setCookie);
    expect("8d. the login cookie has a SameSite setting", new RegExp(`SameSite=${env.cookieSameSite}`, "i").test(setCookie), setCookie);
    expect("8e. the login cookie is Secure exactly when running in production", /;\s*Secure/i.test(setCookie) === env.isProduction, setCookie);
    const upper = await call("POST", "/api/auth/login", { body: { email: emailA.toUpperCase(), password } });
    expect("8f. login ignores email capitalisation", upper.status === 200, upper);

    // Authentication
    expect("9a. no cookie means 401", (await call("GET", "/api/applications")).status === 401);
    expect("9b. a token signed with the wrong secret means 401", (await call("GET", "/api/applications", { token: jwt.sign({ userId: userA.id }, "not-the-real-secret-0123456789abcdef") })).status === 401);
    expect("9c. an alg-none token means 401", (await call("GET", "/api/applications", { token: `${b64({ alg: "none", typ: "JWT" })}.${b64({ userId: userA.id })}.` })).status === 401);
    expect("9d. an expired token means 401", (await call("GET", "/api/applications", { token: jwt.sign({ userId: userA.id }, env.jwtSecret, { expiresIn: -10 }) })).status === 401);
    expect("9e. a valid token works", (await call("GET", "/api/applications", { token: tokenA })).status === 200);

    // CSRF origin check
    const evil = await call("POST", "/api/applications", { token: tokenA, origin: "https://evil.example", body: { company: "Evil Corp", position: "Hacker", status: "SAVED" } });
    expect("10a. a POST from another website's origin is blocked with 403", evil.status === 403, evil);
    const evilDelete = await call("DELETE", "/api/applications/anything", { token: tokenA, origin: "https://evil.example" });
    expect("10b. a DELETE from another website's origin is blocked with 403", evilDelete.status === 403, evilDelete.status);
    const fromUs = await call("POST", "/api/applications", { token: tokenA, origin: goodOrigin, body: { company: "Acme Security Test", position: "Engineer", status: "SAVED" } });
    expect("10c. the same POST from our own origin works", fromUs.status === 201, fromUs);

    // Access to other people's data (IDOR). User A owns everything; user B tries to touch it.
    const appA = fromUs.body.data.application ?? fromUs.body.data;
    const applicationId: string = appA.id;
    const interviewA = await call("POST", "/api/interviews", { token: tokenA, body: { applicationId, title: "Round 1", format: "VIDEO", scheduledAt: new Date(Date.now() + 86_400_000).toISOString() } });
    const reminderA = await call("POST", "/api/reminders", { token: tokenA, body: { title: "A's reminder", dueAt: new Date(Date.now() + 86_400_000).toISOString(), applicationId } });
    const resumeA = await prisma.resume.create({ data: { userId: userA.id, fileName: "a.pdf", storedName: `${stamp}-does-not-exist.pdf`, fileSize: 10, extractedText: "React TypeScript" } });
    const interviewId: string = interviewA.body.data.interview.id;
    const reminderId: string = reminderA.body.data.reminder.id;
    const someDate = new Date(Date.now() + 86_400_000).toISOString();

    const attempts: [string, string, string, unknown?][] = [
      ["PUT application", "PUT", `/api/applications/${applicationId}`, { company: "Hijacked", position: "x", status: "SAVED" }],
      ["DELETE application", "DELETE", `/api/applications/${applicationId}`],
      ["PUT interview", "PUT", `/api/interviews/${interviewId}`, { title: "Hijacked", format: "VIDEO", scheduledAt: someDate }],
      ["DELETE interview", "DELETE", `/api/interviews/${interviewId}`],
      ["create interview on A's application", "POST", "/api/interviews", { applicationId, title: "Sneaky", format: "VIDEO", scheduledAt: someDate }],
      ["PATCH reminder", "PATCH", `/api/reminders/${reminderId}/completed`, { completed: true }],
      ["DELETE reminder", "DELETE", `/api/reminders/${reminderId}`],
      ["create reminder on A's application", "POST", "/api/reminders", { title: "Sneaky", dueAt: someDate, applicationId }],
      ["snooze A's follow-up", "POST", `/api/notifications/follow-ups/${applicationId}/snooze`],
      ["download A's resume", "GET", `/api/resumes/${resumeA.id}/download`],
      ["delete A's resume", "DELETE", `/api/resumes/${resumeA.id}`],
      ["make A's resume the default", "PUT", `/api/resumes/${resumeA.id}/default`],
      ["analyse A's resume", "POST", `/api/ai/resume-analysis/${resumeA.id}`],
      ["read A's resume analysis", "GET", `/api/ai/resume-analysis/${resumeA.id}`],
      ["job-match A's resume", "POST", "/api/ai/job-match", { resumeId: resumeA.id, applicationId }],
      ["tailor A's resume", "POST", "/api/ai/resume-tailor", { resumeId: resumeA.id, applicationId }],
      ["interview questions from A's data", "POST", "/api/ai/interview-questions", { resumeId: resumeA.id, applicationId }],
    ];
    for (const [label, method, path, body] of attempts) {
      const reply = await call(method, path, { token: tokenB, origin: goodOrigin, body });
      expect(`11. user B cannot: ${label} (got ${reply.status})`, reply.status === 404, reply.body);
    }

    // B's list endpoints must not include A's rows
    const listB = await call("GET", "/api/applications", { token: tokenB });
    expect("12a. B's application list does not contain A's application", JSON.stringify(listB.body).includes(applicationId) === false);
    const interviewsB = await call("GET", "/api/interviews", { token: tokenB });
    expect("12b. B's interview list is empty", (interviewsB.body.data?.interviews ?? []).length === 0, interviewsB.body);
    const stillThere = await call("GET", "/api/interviews", { token: tokenA });
    expect("12c. A's data is untouched after B's attempts", (stillThere.body.data?.interviews ?? []).length === 1);

    // Upload hardening
    const before = uploadCount();
    const fakePdf = new FormData();
    fakePdf.append("resume", new Blob(["<html><script>alert(1)</script></html>"], { type: "application/pdf" }), "resume.pdf");
    const fake = await call("POST", "/api/resumes", { token: tokenA, origin: goodOrigin, form: fakePdf });
    expect("13a. HTML disguised as a PDF is refused", fake.status === 400 && /not a valid PDF/i.test(fake.body?.message ?? ""), fake);
    const notPdfType = new FormData();
    notPdfType.append("resume", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
    const wrongType2 = await call("POST", "/api/resumes", { token: tokenA, origin: goodOrigin, form: notPdfType });
    expect("13b. a non-PDF content type is refused", wrongType2.status === 400, wrongType2);
    expect("13c. refused uploads leave no file behind on disk", uploadCount() === before, { before, after: uploadCount() });

    // Brute force. Last, because it trips a limiter. Uses an email that does not exist, so it
    // cannot lock out a real account.
    const victim = `brute-${stamp}@example.test`;
    const statuses: number[] = [];
    let lastReply: Reply | null = null;
    for (let i = 0; i < 6; i++) {
      lastReply = await call("POST", "/api/auth/login", { body: { email: victim, password: `guess-${i}-guess` } });
      statuses.push(lastReply.status);
    }
    expect("14a. the first 5 wrong guesses get 401", statuses.slice(0, 5).every((status) => status === 401), statuses);
    expect("14b. the 6th wrong guess is blocked with 429", statuses[5] === 429, statuses);
    expect("14c. the block says how long to wait (Retry-After header and message)", Number(lastReply?.headers.get("retry-after")) > 0 && /Try again in/.test(lastReply?.body?.message ?? ""), lastReply?.body);
    const stillWorks = await call("POST", "/api/auth/login", { body: { email: emailA, password } });
    expect(
      "14d. a different account is NOT blocked by someone else's failures",
      stillWorks.status === 200,
      `${stillWorks.status} ${stillWorks.body?.message ?? ""} (a 429 here means this script was run too often in the last 15 minutes)`
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }); // cascades to everything they own
  }
}

async function main() {
  runPureChecks();
  await runLiveChecks();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});