import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { env } from '../env.ts';

/**
 * Bounded local diagnostics capture (LOCAL_DEVELOPMENT.md §5): request logs and
 * spans are mirrored to git-ignored JSONL files under `.logs/`, one file per day,
 * pruned after 7 days or when the total exceeds 100 MB. Product behaviour never
 * depends on these files, and they are only written when `DIAGNOSTICS_ENABLED=true`
 * in local development.
 */
export const LOG_DIR = join(process.cwd(), '.logs');
const MAX_DAYS = 7;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_AGE_MS = MAX_DAYS * 86_400_000;

export type DiagnosticLogLine = {
  time?: number;
  level?: number;
  msg?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string | null;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  kind?: string;
  providerId?: string | null;
  err?: { name?: string; message?: string; stack?: string };
};

export const diagnosticsEnabled = (): boolean => env.diagnosticsEnabled() && !env.isProduction();

const today = (): string => new Date().toISOString().slice(0, 10);

const prune = (): void => {
  if (!existsSync(LOG_DIR)) return;
  const now = Date.now();
  let total = 0;
  for (const name of readdirSync(LOG_DIR)) {
    const path = join(LOG_DIR, name);
    const stats = statSync(path);
    total += stats.size;
    if (now - stats.mtimeMs > MAX_AGE_MS || total > MAX_TOTAL_BYTES) {
      try {
        unlinkSync(path);
      } catch {
        // A file being read elsewhere must not break logging.
      }
    }
  }
};

let stream: ReturnType<typeof createWriteStream> | null = null;

/** Pino destination that appends to today's JSONL file. */
export const diagnosticsStream = (): ReturnType<typeof createWriteStream> => {
  if (stream) return stream;
  mkdirSync(LOG_DIR, { recursive: true });
  prune();
  stream = createWriteStream(join(LOG_DIR, `api-${today()}.jsonl`), { flags: 'a' });
  return stream;
};

/** Log lines for one trace, oldest first, from today's and yesterday's files. */
export const readTraceLogs = (traceId: string): DiagnosticLogLine[] => {
  if (!existsSync(LOG_DIR)) return [];
  const files = readdirSync(LOG_DIR)
    .filter((name) => /^api-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()
    .slice(-2);

  const lines: DiagnosticLogLine[] = [];
  for (const name of files) {
    for (const raw of readFileSync(join(LOG_DIR, name), 'utf8').split('\n')) {
      if (!raw.includes(traceId)) continue;
      try {
        const parsed = JSON.parse(raw) as DiagnosticLogLine;
        if (parsed.traceId === traceId) lines.push(parsed);
      } catch {
        // Ignore truncated lines.
      }
    }
  }
  return lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0)).slice(-500);
};

/** Reset for tests. */
export const resetDiagnosticsForTests = (): void => {
  stream?.end();
  stream = null;
};
