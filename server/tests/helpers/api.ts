import request from "supertest";
import app from "../../src/app";

// A supertest agent for the real Express app. Requests run in memory (no port is opened) but
// go through every middleware, route, controller, service and database query, exactly as a
// browser's request would.
export const api = () => request(app);

// The Set-Cookie header as a list (a response may set several cookies).
export function setCookies(response: { headers: Record<string, unknown> }): string[] {
  const value = response.headers["set-cookie"];
  return Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
}