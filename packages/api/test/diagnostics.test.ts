import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const original = process.env.DIAGNOSTICS_ENABLED;

const exportBundle = (body: unknown) =>
  app.request('/api/diagnostics/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  process.env.DIAGNOSTICS_ENABLED = 'true';
});

afterEach(() => {
  if (original === undefined) delete process.env.DIAGNOSTICS_ENABLED;
  else process.env.DIAGNOSTICS_ENABLED = original;
});

describe('POST /api/diagnostics/export', () => {
  it('is hidden when diagnostics are disabled', async () => {
    delete process.env.DIAGNOSTICS_ENABLED;
    const response = await exportBundle({ schemaVersion: 1, traceId: TRACE, events: [] });

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('notFound');
  });

  it('rejects an unknown schema version, a bad trace id and oversized payloads', async () => {
    const wrongSchema = await exportBundle({ schemaVersion: 2, traceId: TRACE, events: [] });
    const badTrace = await exportBundle({ schemaVersion: 1, traceId: 'not-hex', events: [] });
    const tooLarge = await exportBundle('x'.repeat(256 * 1024 + 1));

    expect(wrongSchema.status).toBe(422);
    expect(badTrace.status).toBe(422);
    expect(tooLarge.status).toBe(413);
  });

  it('returns one schema-versioned bundle with only allow-listed event fields', async () => {
    const response = await exportBundle({
      schemaVersion: 1,
      traceId: TRACE,
      client: { route: '/dev/diagnostics', language: 'sr' },
      events: [
        {
          at: '2026-11-22T10:00:00.000Z',
          kind: 'request',
          traceId: TRACE,
          method: 'POST',
          route: '/api/spike/validate',
          // Not allow-listed: must not reach the bundle.
          email: 'gost@uspomena.test',
          authorization: 'Bearer super-secret',
          body: '{"message":"private"}',
        },
      ],
    });
    const bundle = await response.json();
    const serialized = JSON.stringify(bundle);

    expect(response.status).toBe(200);
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.traceId).toBe(TRACE);
    expect(bundle.events).toEqual([
      { at: '2026-11-22T10:00:00.000Z', kind: 'request', traceId: TRACE, method: 'POST', route: '/api/spike/validate' },
    ]);
    expect(bundle.warnings).toContain('serverLogsMissing');
    expect(bundle.redactions.length).toBeGreaterThan(0);
    expect(serialized).not.toContain('gost@uspomena.test');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('private');
  });

  it('rejects a malformed JSON body', async () => {
    const response = await exportBundle('not json');
    expect(response.status).toBe(400);
  });
});
