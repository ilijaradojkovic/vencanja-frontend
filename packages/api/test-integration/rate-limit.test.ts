import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { profiles, rateLimits } from '../src/db/schema.ts';

/**
 * SYS-12 against the real database: fixed-window buckets, atomic counting under
 * concurrency, hashed keys, localized 429 responses and per-IP/user separation.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
const password = 'integration-123';
const created: string[] = [];
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const createUser = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { locale: 'sr' } }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);
  return user.id;
};

const signIn = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return ((await response.json()) as { access_token?: string }).access_token ?? '';
};

const call = (
  path: string,
  method: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
) =>
  app.request(path, {
    method,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

/** Unique IPs per run, so fixed windows from an earlier local run cannot leak in. */
let ipSuffix = 0;
const randomIp = (): string => {
  ipSuffix += 1;
  return `198.51.${Math.floor(Math.random() * 200) + 1}.${(ipSuffix % 200) + 20}`;
};

const withEnv = async <T>(vars: Record<string, string>, run: () => Promise<T>): Promise<T> => {
  const previous = new Map(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

/** A public event + personal guest to hit the limited routes. */
const setup = async () => {
  const email = unique('rate-owner');
  await createUser(email);
  const token = await signIn(email);
  const onboarding = await call('/api/onboarding', 'POST', {
    body: { type: 'wedding', partner1: 'Ana', partner2: 'Marko', date: '2027-06-12', phone: '064 123 4567' },
    token,
  });
  const wedding = (await onboarding.json()).wedding as { id: string; slug: string };
  const guestResponse = await call(`/api/weddings/${wedding.id}/guests`, 'POST', {
    body: { name: 'Jelena' },
    token,
  });
  const guest = (await guestResponse.json()).guest as { token: string };
  return { token, slug: wedding.slug, guestToken: guest.token };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('public read limit (300/min per IP by default)', () => {
  it('answers 429 with the localized envelope and a Retry-After header', async () => {
    const { slug } = await setup();
    const ip = randomIp();

    await withEnv({ RATE_LIMIT_PUBLIC_READ_PER_MIN: '2' }, async () => {
      const first = await call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': ip } });
      const second = await call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': ip } });
      const third = await call(`/api/public/weddings/${slug}`, 'GET', {
        headers: { 'x-real-ip': ip, 'accept-language': 'en' },
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);

      const body = await third.json();
      expect(body).toMatchObject({ code: 'tooManyRequests', message: 'Too many attempts, please try again shortly.' });
      expect(body.requestId).toBeTruthy();
      expect(body.traceId).toBeTruthy();
      expect(third.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(third.headers.get('x-ratelimit-limit')).toBe('2');
      expect(third.headers.get('x-ratelimit-remaining')).toBe('0');
    });
  });

  it('keeps a separate bucket for another IP and stores only keyed hashes', async () => {
    const { slug } = await setup();
    const limitedIp = randomIp();

    await withEnv({ RATE_LIMIT_PUBLIC_READ_PER_MIN: '1' }, async () => {
      const first = await call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': limitedIp } });
      const second = await call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': limitedIp } });
      const other = await call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': randomIp() } });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(other.status).toBe(200);
    });

    const rows = await getDb().select().from(rateLimits).where(eq(rateLimits.key, rateLimits.key));
    const publicKeys = rows.filter((row) => row.key.startsWith('public-read:'));
    expect(publicKeys.length).toBeGreaterThan(0);
    expect(publicKeys.every((row) => /^public-read:[0-9a-f]{64}$/.test(row.key))).toBe(true);
    expect(publicKeys.some((row) => row.key.includes(limitedIp))).toBe(false);
  });

  it('counts concurrent requests atomically (no double pass)', async () => {
    const { slug } = await setup();
    const ip = randomIp();

    await withEnv({ RATE_LIMIT_PUBLIC_READ_PER_MIN: '2' }, async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => call(`/api/public/weddings/${slug}`, 'GET', { headers: { 'x-real-ip': ip } })),
      );
      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(2);
      expect(statuses.filter((status) => status === 429)).toHaveLength(3);
    });
  });
});

describe('public write limit (30/10 min per IP by default)', () => {
  it('limits RSVP separately from the read bucket', async () => {
    const { guestToken } = await setup();
    const ip = randomIp();

    await withEnv({ RATE_LIMIT_PUBLIC_WRITE_PER_10_MIN: '2', RATE_LIMIT_PUBLIC_READ_PER_MIN: '100' }, async () => {
      const rsvp = () =>
        call(`/api/public/invitations/${guestToken}/rsvp`, 'POST', {
          body: { status: 'no' },
          headers: { 'x-real-ip': ip },
        });
      expect((await rsvp()).status).toBe(200);
      expect((await rsvp()).status).toBe(200);
      const third = await rsvp();
      expect(third.status).toBe(429);
      expect((await third.json()).code).toBe('tooManyRequests');
    });
  });
});

describe('authenticated limit (30/10 min per user by default)', () => {
  it('limits PATCH /auth/me per user and leaves another user alone', async () => {
    const first = await setup();
    const second = await setup();

    await withEnv({ RATE_LIMIT_AUTHENTICATED_PER_10_MIN: '2' }, async () => {
      const patch = (token: string) => call('/api/auth/me', 'PATCH', { body: { locale: 'en' }, token });
      expect((await patch(first.token)).status).toBe(200);
      expect((await patch(first.token)).status).toBe(200);
      expect((await patch(first.token)).status).toBe(429);
      expect((await patch(second.token)).status).toBe(200);
    });
  });
});
