import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import type { AppEnv } from '../src/http.ts';
import { language } from '../src/middleware/language.ts';
import { requestContext } from '../src/middleware/request-context.ts';

const buildApp = () => {
  const app = new Hono<AppEnv>().basePath('/api');
  app.use('*', requestContext());
  app.use('*', language());
  app.get('/echo', (c) =>
    c.json({
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
      spanId: c.get('spanId'),
      parentSpanId: c.get('parentSpanId'),
      language: c.get('language'),
    }),
  );
  return app;
};

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';

describe('requestContext', () => {
  it('creates and echoes request, trace and span identifiers', async () => {
    const response = await buildApp().request('/api/echo');
    const body = await response.json();

    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(body.requestId).toBe(response.headers.get('x-request-id'));
    expect(body.traceId).toBe(response.headers.get('x-trace-id'));
    expect(body.parentSpanId).toBeNull();
  });

  it('inherits a valid W3C trace id and keeps the parent span', async () => {
    const response = await buildApp().request('/api/echo', {
      headers: { traceparent: `00-${TRACE}-00f067aa0ba902b7-01` },
    });
    const body = await response.json();

    expect(body.traceId).toBe(TRACE);
    expect(body.parentSpanId).toBe('00f067aa0ba902b7');
    expect(response.headers.get('x-trace-id')).toBe(TRACE);
    expect(body.spanId).not.toBe('00f067aa0ba902b7');
  });

  it('ignores malformed and all-zero trace ids', async () => {
    for (const traceparent of ['not-a-traceparent', `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`]) {
      const response = await buildApp().request('/api/echo', { headers: { traceparent } });
      const body = await response.json();
      expect(body.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(body.traceId).not.toBe('0'.repeat(32));
    }
  });
});

describe('language middleware', () => {
  it('resolves Accept-Language and falls back to Serbian', async () => {
    const english = await (
      await buildApp().request('/api/echo', { headers: { 'accept-language': 'en-GB,en;q=0.9' } })
    ).json();
    const unknown = await (await buildApp().request('/api/echo', { headers: { 'accept-language': 'de-DE' } })).json();

    expect(english.language).toBe('en');
    expect(unknown.language).toBe('sr');
  });
});
