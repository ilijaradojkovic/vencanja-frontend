import { describe, expect, it } from 'vitest';

import { rateLimitKey, windowStart } from '../src/services/rate-limit.ts';

describe('fixed-window rate limiting (SYS-12)', () => {
  it('rounds the window start down to the window size', () => {
    const windowMs = 60_000;
    expect(windowStart(new Date('2026-11-22T10:00:00.000Z'), windowMs).toISOString()).toBe('2026-11-22T10:00:00.000Z');
    expect(windowStart(new Date('2026-11-22T10:00:59.999Z'), windowMs).toISOString()).toBe('2026-11-22T10:00:00.000Z');
    expect(windowStart(new Date('2026-11-22T10:01:00.000Z'), windowMs).toISOString()).toBe('2026-11-22T10:01:00.000Z');

    const tenMinutes = 600_000;
    expect(windowStart(new Date('2026-11-22T10:09:59.000Z'), tenMinutes).toISOString()).toBe(
      '2026-11-22T10:00:00.000Z',
    );
    expect(windowStart(new Date('2026-11-22T10:10:00.000Z'), tenMinutes).toISOString()).toBe(
      '2026-11-22T10:10:00.000Z',
    );
  });

  it('hashes the identifier and includes the scope, never the raw IP or user id', () => {
    const secret = 'unit-test-secret';
    const ipKey = rateLimitKey('public-read', '203.0.113.7', secret);
    const userKey = rateLimitKey('me-patch', '203.0.113.7', secret);

    expect(ipKey).toMatch(/^public-read:[0-9a-f]{64}$/);
    expect(ipKey).not.toContain('203.0.113.7');
    expect(ipKey).not.toBe(rateLimitKey('public-read', '203.0.113.8', secret));
    expect(ipKey).not.toBe(userKey);
    expect(rateLimitKey('public-read', '203.0.113.7', 'other-secret')).not.toBe(ipKey);
    expect(rateLimitKey('public-read', '203.0.113.7', secret)).toBe(ipKey);
  });
});
