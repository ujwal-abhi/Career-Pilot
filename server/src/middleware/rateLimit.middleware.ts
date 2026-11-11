import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";
import { normalizeEmail } from "../validators/auth.validator";

// Rate limits slow down guessing and abuse. Counters live in this server's memory, so they
// reset on restart and are not shared if you run several copies of the server. For a single
// instance that is fine; with several instances, move the counters to Redis.

const MINUTE = 60 * 1000;

function tooManyRequests(message: string): Options["handler"] {
  return (req, res, _next, options) => {
    // express-rate-limit attaches `rateLimit` to the request; its type is not merged into Express's.
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const seconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60;
    const minutes = Math.ceil(seconds / 60);
    res.setHeader("Retry-After", String(seconds));
    res.status(options.statusCode).json({
      success: false,
      message: `${message} Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  };
}

// Counted per signed-in user when we know who it is, otherwise per IP address.
function userOrIpKey(req: Request): string {
  return req.userId ? `user:${req.userId}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

// Everything under /api: generous, only there to stop a runaway script. A person clicking
// around uses a few requests a minute.
export const apiLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  handler: tooManyRequests("Too many requests."),
});

// Login, layer 1: failed attempts against ONE account from ONE address. This is what stops
// someone guessing a single password list. The IP is part of the key on purpose: if it were
// only the email, an attacker could lock a real user out by failing on purpose.
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email).slice(0, 254) : "";
    return `${ipKeyGenerator(req.ip ?? "unknown")}|${email}`;
  },
  handler: tooManyRequests("Too many failed sign-in attempts for this account."),
});

// Login, layer 2: failed attempts from ONE address across ALL accounts. This stops
// "password spraying" (one common password tried against many emails).
export const loginIpLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooManyRequests("Too many failed sign-in attempts."),
});

// Creating accounts costs a password hash each (deliberately slow), so cap it per address.
export const registerLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests("Too many accounts created from this address."),
});

// AI features. Today they are rule-based and free, but once a real model is plugged in each
// call costs money, so the limit is already in place. Only POST (the part that generates)
// counts; reading saved results is not limited here.
export const aiLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== "POST",
  keyGenerator: userOrIpKey,
  handler: tooManyRequests("You are generating results too quickly."),
});

// File uploads write to disk and are parsed, so cap them per user.
export const uploadLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: tooManyRequests("Too many uploads."),
});