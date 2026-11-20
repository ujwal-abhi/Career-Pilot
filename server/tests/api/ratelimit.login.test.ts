import { describe, it, expect } from "vitest";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase } from "../helpers/db";

useCleanDatabase();

// Login has TWO limiters that share this file's one address: 5 failures per account, and 20
// failures per address across all accounts. A blocked request still counts towards the
// address total, so this file is written to stay under 20 in total (about 14). Anything that
// needs the address-wide limit lives in ratelimit.login-ip.test.ts, which has its own counters.

const login = (email: string, password: string) => api().post("/api/auth/login").send({ email, password });
const WRONG_PASSWORD = "wrong-password-1";

describe("login: failed attempts against one account", () => {
  it("does not count successful logins", async () => {
    const user = await createUser("success");
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      expect((await login(user.email, user.password)).status, `login ${attempt}`).toBe(200);
    }
    expect((await login(user.email, WRONG_PASSWORD)).status).toBe(401); // the first failure, not the ninth attempt
  });

  it("locks the account after 5 failures, refuses even the right password, and leaves other accounts alone", async () => {
    const victim = await createUser("victim");
    const bystander = await createUser("bystander");

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await login(victim.email, WRONG_PASSWORD);
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }

    const blocked = await login(victim.email, WRONG_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many failed sign-in attempts for this account\. Try again in \d+ minutes?\.$/),
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);

    // The lock holds even when the attacker finally guesses right...
    expect((await login(victim.email, victim.password)).status).toBe(429);
    // ...but it is only that one account, so nobody else is locked out by the attack.
    expect((await login(bystander.email, bystander.password)).status).toBe(200);
  });

  it("counts the same account whatever capitals or spaces the email is typed with", async () => {
    const user = await createUser("caps");
    const variants = [user.email, user.email.toUpperCase(), ` ${user.email} `, user.email, user.email.toUpperCase()];
    for (const email of variants) {
      expect((await login(email, WRONG_PASSWORD)).status).toBe(401);
    }
    expect((await login(user.email, WRONG_PASSWORD)).status).toBe(429);
  });
});