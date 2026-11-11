import type { CookieOptions } from "express";
import { env } from "./env";

// The login cookie. Every flag here has a reason:
//  - httpOnly: JavaScript on the page cannot read it, so an XSS bug cannot steal the session.
//  - secure:   only sent over HTTPS in production, so it cannot leak on plain HTTP.
//  - sameSite: "lax" stops other sites from making the browser send it on cross-site POSTs.
//              "none" is only for a client and server on different sites, and then the
//              Origin check in security.middleware.ts becomes the CSRF defence.
export const AUTH_COOKIE_NAME = "token";
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches the 7 day JWT

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.cookieSameSite,
  path: "/",
};