import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';

afterAll(async () => {
  await closeDb();
});

describe('GET /api/health against the local stack', () => {
  it('answers ok with correlation headers', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, version: '0.1.0', db: 'ok' });
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('runs on a migrated database with RLS enabled and no policies', async () => {
    const tables = await getDb().execute<{ tablename: string; rowsecurity: boolean }>(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    );
    const names = tables.map((table) => table.tablename);

    expect(names).toEqual(['email_log', 'events', 'guests', 'photo_subscribers', 'photos', 'profiles', 'rate_limits']);
    expect(tables.every((table) => table.rowsecurity)).toBe(true);

    const policies = await getDb().execute<{ count: number }>(
      sql`select count(*)::int as count from pg_policies where schemaname = 'public'`,
    );
    expect(policies[0]?.count).toBe(0);
  });

  it('keeps the error envelope in front of a real database connection', async () => {
    const response = await app.request('/api/unknown', { headers: { 'accept-language': 'en' } });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'notFound' });
  });
});
