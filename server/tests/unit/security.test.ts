import jwt from "jsonwebtoken";
import { describe, it, expect } from "vitest";
import { env } from "../../src/config/env";
import { signToken, verifyToken } from "../../src/utils/jwt.util";
import { hashPassword, comparePassword, DUMMY_PASSWORD_HASH } from "../../src/utils/password.util";
import { isTrustedOrigin } from "../../src/middleware/security.middleware";
import { looksLikePdf } from "../../src/middleware/upload.middleware";

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("isTrustedOrigin (CSRF rule)", () => {
  const allowed = ["http://localhost:5173"];

  it("allows a request with no Origin header (not a browser, so not a CSRF attack)", () => {
    expect(isTrustedOrigin(undefined, allowed)).toBe(true);
  });

  it("allows our own origin", () => {
    expect(isTrustedOrigin("http://localhost:5173", allowed)).toBe(true);
  });

  it.each([
    ["another site", "https://evil.example"],
    ["the literal string null (sandboxed iframes, some redirects)", "null"],
    ["a look-alike that starts with our origin", "http://localhost:5173.evil.example"],
    ["the right host on the wrong port", "http://localhost:3000"],
    ["the right host on the wrong scheme", "https://localhost:5173"],
  ])("refuses %s", (_label, origin) => {
    expect(isTrustedOrigin(origin, allowed)).toBe(false);
  });
});

describe("looksLikePdf", () => {
  it("recognises a PDF header", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.7\n..."))).toBe(true);
  });

  it("tolerates junk before the header, as the PDF specification allows", () => {
    expect(looksLikePdf(Buffer.from("\n\n  junk %PDF-1.4"))).toBe(true);
  });

  it("rejects HTML, plain text and an empty file", () => {
    expect(looksLikePdf(Buffer.from("<html><script>alert(1)</script>"))).toBe(false);
    expect(looksLikePdf(Buffer.from("just some text"))).toBe(false);
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
  });

  it("ignores a marker hidden past the first 1024 bytes", () => {
    const sneaky = Buffer.concat([Buffer.alloc(2000, 65), Buffer.from("%PDF-")]);
    expect(looksLikePdf(sneaky)).toBe(false);
  });
});

describe("JWT sign and verify", () => {
  it("round-trips a token we signed", () => {
    expect(verifyToken(signToken({ userId: "user-1" })).userId).toBe("user-1");
  });

  it("signs with HS256 and a 7 day lifetime", () => {
    const decoded = jwt.decode(signToken({ userId: "u" }), { complete: true });
    expect(decoded?.header.alg).toBe("HS256");
    const payload = decoded?.payload as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ userId: "user-1" }, "some-other-secret-value-1234567890");
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects an unsigned (alg: none) token", () => {
    const unsigned = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ userId: "user-1" })}.`;
    expect(() => verifyToken(unsigned)).toThrow();
  });

  it("rejects a token signed with a different algorithm, even with the right secret", () => {
    const token = jwt.sign({ userId: "u" }, env.jwtSecret, { algorithm: "HS512" });
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects an expired token", () => {
    const token = jwt.sign({ userId: "u" }, env.jwtSecret, { expiresIn: -10 });
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects a correctly signed token whose userId is not a string", () => {
    const token = jwt.sign({ userId: { admin: true } }, env.jwtSecret);
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects garbage", () => {
    expect(() => verifyToken("not-a-token")).toThrow();
    expect(() => verifyToken("")).toThrow();
  });
});

describe("passwords", () => {
  it("never stores the plain password, and verifies the right one only", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toContain("correct-horse-battery");
    expect(hash.startsWith("$2")).toBe(true); // a bcrypt hash
    expect(await comparePassword("correct-horse-battery", hash)).toBe(true);
    expect(await comparePassword("wrong-password", hash)).toBe(false);
  });

  it("salts every hash, so the same password gives different hashes", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("has a dummy hash that is a real bcrypt hash (so an unknown email costs the same time as a wrong password)", async () => {
    expect(DUMMY_PASSWORD_HASH.startsWith("$2")).toBe(true);
    expect(await comparePassword("anything", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});