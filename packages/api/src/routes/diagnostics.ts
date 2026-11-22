import { Hono } from 'hono';

import { diagnosticsEnabled, readTraceLogs, type DiagnosticLogLine } from '../diagnostics/store.ts';
import { env } from '../env.ts';
import { errorBody, type AppEnv } from '../http.ts';

/** Client events are copied through an allow-list, so nothing sensitive can ride along. */
const EVENT_KEYS = [
  'at',
  'kind',
  'traceId',
  'spanId',
  'parentSpanId',
  'requestId',
  'route',
  'method',
  'status',
  'durationMs',
  'code',
  'attempt',
  'action',
] as const;

const TRACE_ID = /^[0-9a-f]{32}$/;
const MAX_BODY_BYTES = 256 * 1024;

type ClientEvent = Record<string, string | number | null>;

const sanitizeEvent = (event: unknown): ClientEvent | null => {
  if (!event || typeof event !== 'object') return null;
  const source = event as Record<string, unknown>;
  const clean: ClientEvent = {};
  for (const key of EVENT_KEYS) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 200);
    else if (typeof value === 'number' || value === null) clean[key] = value;
  }
  return clean;
};

const spanOf = (line: DiagnosticLogLine) => ({
  at: line.time ? new Date(line.time).toISOString() : null,
  spanId: line.spanId ?? null,
  parentSpanId: line.parentSpanId ?? null,
  requestId: line.requestId ?? null,
  route: line.route ?? null,
  method: line.method ?? null,
  status: line.status ?? null,
  durationMs: line.durationMs ?? null,
  kind: line.kind ?? null,
  error: line.err
    ? { name: line.err.name ?? null, message: line.err.message ?? null, stack: line.err.stack ?? null }
    : null,
});

/**
 * `POST /api/diagnostics/export` — local-only tester support bundle
 * (LOCAL_DEVELOPMENT.md §5). It combines the sanitized browser events the tester
 * already holds with the matching local server spans/logs into one
 * schema-versioned JSON document. Outside local development, or when
 * `DIAGNOSTICS_ENABLED` is not `true`, it answers `404`. It never reads arbitrary
 * logs, never accepts a query language and never returns payloads or secrets.
 */
export const diagnosticsRoutes = new Hono<AppEnv>().post('/diagnostics/export', async (c) => {
  if (!diagnosticsEnabled()) return c.json(errorBody(c, 'notFound'), 404);

  const raw = await c.req.text();
  if (raw.length > MAX_BODY_BYTES) return c.json(errorBody(c, 'badRequest'), 413);

  let payload: { schemaVersion?: unknown; traceId?: unknown; events?: unknown; client?: unknown };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return c.json(errorBody(c, 'badRequest'), 400);
  }

  if (payload.schemaVersion !== 1) return c.json(errorBody(c, 'badRequest'), 422);
  if (typeof payload.traceId !== 'string' || !TRACE_ID.test(payload.traceId)) {
    return c.json(errorBody(c, 'badRequest'), 422);
  }
  if (!Array.isArray(payload.events) || payload.events.length > 500) {
    return c.json(errorBody(c, 'badRequest'), 422);
  }

  const events = payload.events.map(sanitizeEvent).filter((event): event is ClientEvent => event !== null);
  const serverLines = readTraceLogs(payload.traceId);
  const warnings: string[] = [];
  if (serverLines.length === 0) warnings.push('serverLogsMissing');

  const requestIds = [
    ...new Set([
      ...events.map((event) => event.requestId).filter((id): id is string => typeof id === 'string'),
      ...serverLines.map((line) => line.requestId).filter((id): id is string => typeof id === 'string'),
    ]),
  ];

  return c.json(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      environment: env.nodeEnv(),
      appVersion: env.version(),
      traceId: payload.traceId,
      requestIds,
      client: typeof payload.client === 'object' && payload.client !== null ? payload.client : {},
      events: events.sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? ''))),
      spans: serverLines.map(spanOf),
      logs: serverLines,
      warnings,
      redactions: [
        'authorization and cookie headers',
        'tokens and signed URLs',
        'email addresses, names and phone numbers',
        'invitation and photo message bodies',
        'request and response payloads',
      ],
    },
    200,
    { 'cache-control': 'no-store' },
  );
});
