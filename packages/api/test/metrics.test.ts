import { afterEach, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';

import { app } from '../src/app.ts';
import { createLogger } from '../src/logger.ts';
import { normalizeRoute } from '../src/metrics.ts';

const METRICS_ENV = ['METRICS_ENABLED', 'METRICS_TOKEN'] as const;
const original = Object.fromEntries(METRICS_ENV.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of METRICS_ENV) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

const enableMetrics = (token = 'local-metrics-token') => {
  process.env.METRICS_ENABLED = 'true';
  process.env.METRICS_TOKEN = token;
};

describe('/api/metrics', () => {
  it('is hidden when metrics are disabled', async () => {
    delete process.env.METRICS_ENABLED;
    const response = await app.request('/api/metrics');

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('notFound');
  });

  it('requires the bearer token', async () => {
    enableMetrics();
    const noToken = await app.request('/api/metrics');
    const wrongToken = await app.request('/api/metrics', { headers: { authorization: 'Bearer nope' } });

    expect(noToken.status).toBe(401);
    expect(wrongToken.status).toBe(401);
    expect((await noToken.json()).code).toBe('unauthorized');
  });

  it('fails closed when the token is missing from the configuration', async () => {
    process.env.METRICS_ENABLED = 'true';
    delete process.env.METRICS_TOKEN;
    const response = await app.request('/api/metrics');

    expect(response.status).toBe(503);
  });

  it('serves Prometheus metrics with normalized route labels', async () => {
    enableMetrics();
    await app.request('/api/spike/echo');
    await app.request('/api/unknown-route');

    const response = await app.request('/api/metrics', { headers: { authorization: 'Bearer local-metrics-token' } });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('route="/api/spike/echo"');
    expect(text).toContain('route="/api/*"');
    expect(text).not.toContain('unknown-route');
  });
});

describe('normalizeRoute', () => {
  it('keeps route templates and collapses unmatched paths', () => {
    expect(normalizeRoute('/api/health')).toBe('/api/health');
    expect(normalizeRoute('/api/guests/:id')).toBe('/api/guests/:id');
    expect(normalizeRoute('/api/*')).toBe('/api/*');
    expect(normalizeRoute('/*')).toBe('/api/*');
    expect(normalizeRoute(undefined)).toBe('/api/*');
  });
});

describe('logger redaction', () => {
  it('never writes tokens, cookies or authorization headers', () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });

    const previousLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'info';
    const logger = createLogger(stream);
    logger.info(
      {
        requestId: 'r1',
        traceId: 't1',
        headers: { authorization: 'Bearer super-secret', cookie: 'sb-session=secret' },
        token: 'guest-token',
      },
      'request',
    );

    expect(output).toContain('[redacted]');
    expect(output).not.toContain('super-secret');
    expect(output).not.toContain('sb-session');
    expect(output).not.toContain('guest-token');
    expect(output).toContain('"requestId":"r1"');

    if (previousLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previousLevel;
  });
});
