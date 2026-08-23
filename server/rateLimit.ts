import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { verifyToken } from "./auth";

/**
 * Rate limiting.
 *
 * A daycare sits behind a single public IP address, so counting authenticated
 * requests per IP gave the whole staff one shared budget: the notification poll
 * alone is roughly four requests per minute per signed-in user, so a 30-person
 * daycare spent well over a hundred of them while sitting idle. Authenticated
 * requests are therefore counted per user; only anonymous traffic falls back to the
 * IP, where it is the only identity available.
 *
 * Every limit can be tuned per deployment with the RATE_LIMIT_* variables listed in
 * .env.example, since a small municipality and a large one need different ceilings.
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Count against the signed-in user when the request carries a valid token, and
 * against the IP otherwise.
 *
 * Only the token signature is checked here -- no database lookup -- so this stays
 * cheap enough to run before every request. A forged or expired token falls through
 * to the IP bucket and is rejected later by authenticateToken, so a bad token can
 * never buy a larger budget than an anonymous caller already has.
 */
export function userOrIpKey(req: Request, _res?: Response): string {
  const header = req.headers?.['authorization'];
  const token = typeof header === 'string' ? header.split(' ')[1] : undefined;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) return `user:${decoded.userId}`;
  }

  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

/** General API traffic: per signed-in user, falling back to IP when anonymous. */
export const apiLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: envInt('RATE_LIMIT_MAX', 600),
  keyGenerator: userOrIpKey,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Login carries no token yet, so this is necessarily per IP. skipSuccessfulRequests
 * means only failed attempts count, and per-account lockout (5 attempts) is the
 * primary brute-force defence -- this is the second layer, sized so that a daycare
 * full of people mistyping passwords on a Monday morning is not locked out.
 */
export const authLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('RATE_LIMIT_LOGIN_MAX', 50),
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_RESET_WINDOW_MS', 60 * 60 * 1000),
  max: envInt('RATE_LIMIT_RESET_MAX', 20),
  message: { error: 'Too many password reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Anonymous endpoints backing the login screen's municipality and daycare pickers.
 * Per IP by definition, and a whole daycare may share one.
 */
export const publicApiLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_PUBLIC_WINDOW_MS', 60 * 1000),
  max: envInt('RATE_LIMIT_PUBLIC_MAX', 300),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
