import { describe, it, expect } from "vitest";
import { api } from "../helpers/api";
import { createUser, useCleanDatabase } from "../helpers/db";

useCleanDatabase();

// Its own file so the address-wide failure counter starts at zero and the exact limit can be
// tested: 20 failed sign-ins are allowed, the 21st is refused.

const login = (email: string, password: string) => api().post("/api/auth/login").send({ email, password });

describe("login: failed attempts from one address across many accounts", () => {
  it("allows exactly 20, then stops password spraying and refuses everyone on that address", async () => {
    const realUser = await createUser("real-user");

    // A different email every time, so the per-account limit never applies.
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const res = await login(`spray-${attempt}@example.com`, "common-password-1");
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }

    const blocked = await login("spray-21@example.com", "common-password-1");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: expect.stringMatching(/^Too many failed sign-in attempts\. Try again in \d+ minutes?\.$/),
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);

    // Only failures are counted, but while the block is active even a correct login is refused.
    expect((await login(realUser.email, realUser.password)).status).toBe(429);
  });
});