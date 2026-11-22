/**
 * Server configuration (docs/mvp/ENVIRONMENT.md §2). Values are read lazily so
 * that bundling the API during `next build` never needs runtime secrets; a
 * missing or invalid required variable fails at the first request with a clear
 * server-side error instead of silently selecting an insecure default.
 */
const read = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const required = (name: string): string => {
  const value = read(name);
  if (!value) {
    throw new Error(`${name} is not set. See docs/mvp/ENVIRONMENT.md and apps/web/.env.example.`);
  }
  return value;
};

const integer = (name: string, fallback: number): number => {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}".`);
  }
  return value;
};

export const env = {
  databaseUrl: () => required('DATABASE_URL'),
  appUrl: () => read('APP_URL') ?? 'http://localhost:3000',
  version: () => read('APP_VERSION') ?? '0.1.0',
  nodeEnv: () => read('NODE_ENV') ?? 'development',
  isProduction: () => (read('NODE_ENV') ?? 'development') === 'production',
  retentionMonthsDefault: () => integer('RETENTION_MONTHS_DEFAULT', 3),
  eventStorageLimitMbDefault: () => integer('EVENT_STORAGE_LIMIT_MB_DEFAULT', 50),
  maxUploadMb: () => integer('MAX_UPLOAD_MB', 30),
};
