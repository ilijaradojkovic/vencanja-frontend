import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics (LOCAL_DEVELOPMENT.md §6). Labels are normalized route
 * templates and stable codes only — never raw paths, tokens, IDs or emails, so
 * cardinality stays bounded and nothing sensitive leaks.
 */
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled by the API.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'API request duration in seconds.',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'API errors by normalized route and stable error code.',
  labelNames: ['route', 'code'] as const,
  registers: [registry],
});

/** Files reserved by upload-ticket requests, by link type and outcome (no IDs or tokens). */
export const photoUploadsTotal = new Counter({
  name: 'photo_uploads_total',
  help: 'Files in upload-ticket requests by link (personal|qr) and outcome.',
  labelNames: ['link', 'outcome'] as const,
  registers: [registry],
});

/** `complete` outcomes: processed, already_done, not_image, too_large, storage_limit, missing, invalid_key, error. */
export const photoProcessingTotal = new Counter({
  name: 'photo_processing_total',
  help: 'Photo completions (sharp processing) by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const photoProcessingDurationSeconds = new Histogram({
  name: 'photo_processing_duration_seconds',
  help: 'Duration of `complete` (download, decode, derivatives, Storage writes) in seconds.',
  labelNames: ['outcome'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 13],
  registers: [registry],
});

/** Unmatched requests and Hono's catch-all share one label. */
export const normalizeRoute = (routePath: string | undefined): string => {
  if (!routePath || routePath === '/*' || routePath === '*') return '/api/*';
  return routePath;
};
