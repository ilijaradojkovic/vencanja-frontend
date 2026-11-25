import { randomUUID } from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../http.ts';

/** W3C trace context, version 00 (SPEC §8.6). */
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE = /^0{32}$/;
const HEX = 16;

const randomHex = (bytes: number): string =>
  randomUUID()
    .replaceAll('-', '')
    .slice(0, bytes * 2);

/**
 * Creates the correlation identifiers for a request: a fresh `requestId` per
 * request and a W3C `traceId` inherited from a valid `traceparent` header or
 * generated when the header is missing or invalid. Both are echoed back and
 * stored on the context for logs, metrics and error bodies (D17).
 */
export const requestContext = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const requestId = randomUUID();
  const traceparent = TRACEPARENT.exec(c.req.header('traceparent') ?? '');
  const inheritedTrace = traceparent?.[1];
  const traceId = inheritedTrace && !ZERO_TRACE.test(inheritedTrace) ? inheritedTrace : randomHex(16);
  const spanId = randomHex(HEX / 2);
  const parentSpanId = traceparent?.[2] ?? null;
  const startedAt = Date.now();

  c.set('requestId', requestId);
  c.set('traceId', traceId);
  c.set('spanId', spanId);
  c.set('parentSpanId', parentSpanId);
  c.set('startedAt', startedAt);

  c.header('x-request-id', requestId);
  c.header('x-trace-id', traceId);
  c.header('traceparent', `00-${traceId}-${spanId}-01`);

  await next();
};
