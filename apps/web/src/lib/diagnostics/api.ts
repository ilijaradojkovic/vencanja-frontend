import { currentTraceId, record } from './ring';

const spanId = (): string => crypto.randomUUID().replaceAll('-', '').slice(0, 16);

const routeOf = (path: string): string => path.split('?')[0] ?? path;

/**
 * `fetch` wrapper that joins the current browser trace: it sends a W3C
 * `traceparent`, keeps retries on the same trace and records sanitized request,
 * response and failure events in the diagnostic ring. Only method, normalized
 * route, status, duration and identifiers are recorded.
 */
export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const traceId = currentTraceId();
  const route = routeOf(path);
  const method = init.method ?? 'GET';
  const started = performance.now();
  record({ kind: 'request', method, route });

  try {
    const response = await fetch(path, {
      ...init,
      headers: { ...(init.headers ?? {}), traceparent: `00-${traceId}-${spanId()}-01` },
    });
    record({
      kind: 'response',
      method,
      route,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      requestId: response.headers.get('x-request-id') ?? undefined,
      traceId: response.headers.get('x-trace-id') ?? traceId,
    });
    return response;
  } catch (error) {
    record({ kind: 'error', method, route, code: 'networkError' });
    throw error;
  }
};
