import jwt from "jsonwebtoken";
import { describe, it, expect } from "vitest";
import prisma from "../../src/config/db";
import { env } from "../../src/config/env";
import { hashPassword } from "../../src/utils/password.util";
import { api, setCookies } from "../helpers/api";
import { createUser, cookieFor, useCleanDatabase, TEST_PASSWORD } from "../helpers/db";

useCleanDatabase();

// Register is limited to 10 per hour per address, so this file registers on purpose only a
// handful of times; everything else uses createUser(), which writes straight to the database.

describe("POST /api/auth/register", () => {
  it("creates the account, logs the user in with a secure cookie, and never returns the password", async () => {
    const res = await api().post("/api/auth/register").send({ email: "ada@example.com", password: "correct-horse-battery", name: "Ada" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({ id: expect.any(String), email: "ada@example.com", name: "Ada" });
    expect(JSON.stringify(res.body)).not.toContain("correct-horse-battery");
    expect(JSON.stringify(res.body)).not.toContain("$2"); // no bcrypt hash either

    const cookie = setCookies(res).find((value) => value.startsWith("token="));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i); // JavaScript on the page cannot read it
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Secure/i); // Secure only in production, which tests are not
  });

  it("stores only a bcrypt hash of the password", async () => {
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(stored.password).not.toBe("correct-horse-battery");
    expect(stored.password.startsWith("$2")).toBe(true);
  });

  it("normalises the email: trimmed and lower-cased", async () => {
    const res = await api().post("/api/auth/register").send({ email: "  Grace.Hopper@Example.COM ", password: TEST_PASSWORD, name: "  Grace " });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("grace.hopper@example.com");
    expect(res.body.data.user.name).toBe("Grace");
  });

  it("refuses a duplicate email, even in different capitals", async () => {
    const res = await api().post("/api/auth/register").send({ email: "ADA@example.com", password: TEST_PASSWORD, name: "Imposter" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "An account with this email already exists." });
    expect(await prisma.user.count({ where: { email: { equals: "ada@example.com", mode: "insensitive" } } })).toBe(1);
  });

  it.each([
    ["no body at all", undefined],
    ["a short password", { email: "short@example.com", password: "1234567", name: "S" }],
    ["a malformed email", { email: "nope", password: TEST_PASSWORD, name: "S" }],
    ["a password that is not a string", { email: "num@example.com", password: 12345678, name: "S" }],
  ])("returns 400 for %s and creates nothing", async (_label, body) => {
    const before = await prisma.user.count();
    const res = await api().post("/api/auth/register").send(body as object);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe("string");
    expect(await prisma.user.count()).toBe(before);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with the right password and sets the cookie", async () => {
    const user = await createUser("login");
    const res = await api().post("/api/auth/login").send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(setCookies(res).some((value) => value.startsWith("token=") && /HttpOnly/i.test(value))).toBe(true);
  });

  it("the cookie it sets actually authenticates later requests", async () => {
    const user = await createUser("session");
    const login = await api().post("/api/auth/login").send({ email: user.email, password: user.password });
    const cookie = setCookies(login)[0].split(";")[0];
    const me = await api().get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);
  });

  it("accepts the email in any capitalisation, with spaces around it", async () => {
    const user = await createUser("caps");
    const res = await api().post("/api/auth/login").send({ email: `  ${user.email.toUpperCase()} `, password: user.password });
    expect(res.status).toBe(200);
  });

  it("still logs in an older account whose email was saved with capital letters", async () => {
    await prisma.user.create({
      data: { email: "Legacy.User@Example.com", name: "Legacy", password: await hashPassword("old-account-pass") },
    });
    const res = await api().post("/api/auth/login").send({ email: "legacy.user@example.com", password: "old-account-pass" });
    expect(res.status).toBe(200);
  });

  it("gives the SAME answer for a wrong password and an unknown email (so emails cannot be discovered)", async () => {
    const user = await createUser("enum");
    const wrongPassword = await api().post("/api/auth/login").send({ email: user.email, password: "wrong-password-1" });
    const unknownEmail = await api().post("/api/auth/login").send({ email: "nobody-here@example.com", password: "wrong-password-1" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.message).toBe("Invalid email or password.");
    expect(setCookies(wrongPassword)).toEqual([]);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await api().post("/api/auth/login").send({ email: "a@b.co" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the signed-in user", async () => {
    const user = await createUser("me");
    const res = await api().get("/api/auth/me").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: user.id, email: user.email, name: user.name });
  });

  it("rejects a request with no cookie", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Not authenticated." });
  });

  it("rejects garbage, a token signed with another secret, and an unsigned token", async () => {
    const forged = jwt.sign({ userId: "x" }, "an-attackers-own-secret-value-123456");
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"userId":"x"}').toString("base64url")}.`;
    for (const token of ["garbage", forged, unsigned]) {
      const res = await api().get("/api/auth/me").set("Cookie", `token=${token}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired session.");
    }
  });

  it("rejects an expired token", async () => {
    const user = await createUser("expired");
    const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: -60 });
    const res = await api().get("/api/auth/me").set("Cookie", `token=${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a valid token whose user no longer exists", async () => {
    const user = await createUser("deleted");
    await prisma.user.delete({ where: { id: user.id } });
    const res = await api().get("/api/auth/me").set("Cookie", cookieFor(user.id));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie", async () => {
    const user = await createUser("logout");
    const res = await api().post("/api/auth/logout").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    const cleared = setCookies(res).find((value) => value.startsWith("token="));
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("works even when nobody is logged in", async () => {
    expect((await api().post("/api/auth/logout")).status).toBe(200);
  });
});