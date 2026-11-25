import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { rateLimits } from '../db/schema.ts';
import { env } from '../env.ts';
import { getLogger } from '../logger.ts';

export type RateLimitRule = {
  /** Stable scope name; it is part of the bucket key. */
  scope: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

/** Start of the fixed window that contains `now` (SPEC §8.2 uses fixed windows). */
export const windowStart = (now: Date, windowMs: number): Date =>
  new Date(Math.floor(now.getTime() / windowMs) * windowMs);

/**
 * Keyed hash of the identifier (IP or user id) so `rate_limits` never stores a
 * reusable raw IP/token. The scope is included to separate buckets.
 */
export const rateLimitKey = (scope: string, identifier: string, secret: string = env.rateLimitSecret()): string =>
  `${scope}:${createHmac('sha256', secret).update(`${scope}|${identifier}`).digest('hex')}`;

/**
 * Increments the bucket with one atomic upsert and reports whether the request is
 * allowed. Concurrent requests see distinct counts because the increment happens
 * in the database (`insert … on conflict do update set count = count + 1`).
 */
export const consumeRateLimit = async (
  rule: RateLimitRule,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> => {
  const start = windowStart(now, rule.windowMs);
  const key = rateLimitKey(rule.scope, identifier);
  const resetAt = new Date(start.getTime() + rule.windowMs);
  const remainingFor = (count: number): RateLimitResult => ({
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
  });

  try {
    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, windowStart: start, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.key, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });
    return remainingFor(row?.count ?? 1);
  } catch (error) {
    // A broken limiter must not take the public site down; log without the key.
    getLogger().error(
      { scope: rule.scope, err: { name: (error as Error).name, message: (error as Error).message } },
      'rate limit check failed; allowing the request',
    );
    return remainingFor(1);
  }
};
