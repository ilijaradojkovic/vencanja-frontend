import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import { RuleViolation } from '@uspomena/shared';

import { app } from '../src/app.ts';
import { errorHandler, notFoundHandler } from '../src/errors.ts';
import type { AppEnv } from '../src/http.ts';
import { language } from '../src/middleware/language.ts';
import { requestContext } from '../src/middleware/request-context.ts';

const buildApp = () => {
  const testApp = new Hono<AppEnv>().basePath('/api');
  testApp.use('*', requestContext());
  testApp.use('*', language());
  testApp.get('/rule', () => {
    throw new RuleViolation('personsRange', { max: 3 });
  });
  testApp.get('/boom', () => {
    throw new Error('database exploded');
  });
  testApp.notFound(notFoundHandler);
  testApp.onError(errorHandler);
  return testApp;
};

describe('error envelope', () => {
  it('answers an unknown route with the localized envelope', async () => {
    const response = await app.request('/api/unknown', { headers: { 'accept-language': 'en' } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      code: 'notFound',
      message: 'The requested resource was not found.',
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('translates shared rule violations and returns 422 with parameters', async () => {
    const response = await buildApp().request('/api/rule', { headers: { 'accept-language': 'ru' } });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe('personsRange');
    expect(body.message).toBe('Количество человек должно быть от 1 до 3.');
  });

  it('hides internals behind a 500 envelope with correlation ids', async () => {
    const response = await buildApp().request('/api/boom', { headers: { 'accept-language': 'sr' } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('internalError');
    expect(body.message).toBe('Došlo je do greške. Pokušajte ponovo.');
    expect(JSON.stringify(body)).not.toContain('database exploded');
    expect(body.requestId).toBe(response.headers.get('x-request-id'));
    expect(body.traceId).toBe(response.headers.get('x-trace-id'));
  });
});

describe('health route', () => {
  it('reports the database state without leaking configuration', async () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54999/postgres';
    const response = await app.request('/api/health');
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, db: 'error' });
    expect(JSON.stringify(body)).not.toContain('54999');
  });
});
