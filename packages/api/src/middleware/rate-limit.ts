import type { Context, MiddlewareHandler } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import { consumeRateLimit, type RateLimitRule } from '../services/rate-limit.ts';

/**
 * Trusted client IP: Vercel sets `x-real-ip`; the first `x-forwarded-for` hop is
 * only used outside production (local dev and E2E), so a spoofed header cannot
 * bypass the production limits.
 */
export const clientIp = (c: Context<AppEnv>): string => {
  const real = c.req.header('x-real-ip')?.trim();
  if (real) return real;
  if (process.env.NODE_ENV !== 'production') {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return 'unknown';
};

const rateLimited = (c: Context<AppEnv>, retryAfter: number, limit: number) =>
  c.json(errorBody(c, 'tooManyRequests'), 429, {
    'retry-after': String(retryAfter),
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': '0',
  });

/** Fixed-window limiter for the public guest routes (SYS-12), keyed by trusted IP. */
export const rateLimitByIp =
  (rule: () => RateLimitRule): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const current = rule();
    const result = await consumeRateLimit(current, clientIp(c));
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
      return rateLimited(c, retryAfter, result.limit);
    }
    await next();
  };

/** Same limiter for an authenticated scope (onboarding, PATCH /auth/me), keyed by user id. */
export const enforceUserRateLimit = async (
  c: Context<AppEnv>,
  rule: () => RateLimitRule,
  userId: string,
): Promise<Response | null> => {
  const current = rule();
  const result = await consumeRateLimit(current, userId);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  return rateLimited(c, retryAfter, result.limit);
};
