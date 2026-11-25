/**
 * Bounded browser diagnostic ring (LOCAL_DEVELOPMENT.md §5). It keeps the most
 * recent 200 sanitized events for the current testing session, in memory only —
 * nothing is uploaded automatically and only allow-listed fields are stored, so
 * payloads, emails, tokens and message bodies never enter it.
 */
export type DiagnosticEventKind = 'action' | 'request' | 'response' | 'error';

export type DiagnosticEvent = {
  at: string;
  kind: DiagnosticEventKind;
  traceId: string;
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  code?: string;
  attempt?: number;
  action?: string;
};

const MAX_EVENTS = 200;

export const newTraceId = (): string => crypto.randomUUID().replaceAll('-', '');

let traceId = newTraceId();
let events: DiagnosticEvent[] = [];

export const currentTraceId = (): string => traceId;

/** A new browser action (form submit, upload batch, …) starts a trace. */
export const startTrace = (action?: string): string => {
  traceId = newTraceId();
  record({ kind: 'action', action: action ?? 'action' });
  return traceId;
};

export const record = (event: Omit<DiagnosticEvent, 'at' | 'traceId'> & { traceId?: string }): void => {
  events.push({ ...event, at: new Date().toISOString(), traceId: event.traceId ?? traceId });
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
};

export const snapshot = (forTrace = traceId): DiagnosticEvent[] => events.filter((event) => event.traceId === forTrace);

export const resetDiagnostics = (): void => {
  events = [];
  traceId = newTraceId();
};
