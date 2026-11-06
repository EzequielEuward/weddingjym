import { createHash, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Response } from 'express';

export const COOKIE_NAMES = {
  gate: 'wedding_gate',
  guestSession: 'guest_session_id',
  moderator: 'wedding_mod',
} as const;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function safeCompareSecret(provided: string, expected: string): boolean {
  const hashA = createHash('sha256').update(provided).digest();
  const hashB = createHash('sha256').update(expected).digest();
  return timingSafeEqual(hashA, hashB);
}

function baseCookieOptions(isProduction: boolean, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge,
  };
}

export function setGateCookie(res: Response, isProduction: boolean): void {
  res.cookie(COOKIE_NAMES.gate, 'granted', baseCookieOptions(isProduction, THIRTY_DAYS_MS));
}

export function setGuestSessionCookie(
  res: Response,
  sessionId: string,
  isProduction: boolean,
): void {
  res.cookie(
    COOKIE_NAMES.guestSession,
    sessionId,
    baseCookieOptions(isProduction, THIRTY_DAYS_MS),
  );
}

export function setModeratorCookie(res: Response, isProduction: boolean): void {
  res.cookie(
    COOKIE_NAMES.moderator,
    'active',
    baseCookieOptions(isProduction, TWELVE_HOURS_MS),
  );
}

export function clearModeratorCookie(res: Response): void {
  res.clearCookie(COOKIE_NAMES.moderator, { path: '/' });
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(key: string, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) {
      return true;
    }
    return current.count < this.maxAttempts;
  }

  record(key: string, weight = 1, now = Date.now()): boolean {
    const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) {
      this.buckets.set(key, { count: weight, resetAt: now + this.windowMs });
      return weight <= this.maxAttempts;
    }
    current.count += weight;
    return current.count <= this.maxAttempts;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
