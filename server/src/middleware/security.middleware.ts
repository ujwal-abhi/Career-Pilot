import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

// Browsers attach an Origin header to every cross-origin request and to every POST, PUT,
// PATCH and DELETE. Scripts (curl, Postman, tests) usually send none.
//
// Pure rule, so it can be tested without a server:
//  - no Origin header     -> allowed. A CSRF attack needs the victim's browser, and a browser
//                            always sends Origin on these requests.
//  - Origin is one of ours -> allowed.
//  - anything else (including the literal string "null") -> refused.
export function isTrustedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (origin === undefined) return true;
  return allowedOrigins.includes(origin);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Defence against CSRF (another website making your browser send an authenticated request).
// SameSite=Lax cookies already block most of it; this check is the second layer and is what
// protects you if the cookie ever has to become SameSite=None for a cross-site deployment.
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (isTrustedOrigin(req.headers.origin, env.clientOrigins)) return next();
  return res.status(403).json({ success: false, message: "Request blocked: untrusted origin." });
}

// API responses can contain someone's private data. "no-store" tells browsers and any proxy
// in between never to keep a copy.
export function noStore(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  next();
}