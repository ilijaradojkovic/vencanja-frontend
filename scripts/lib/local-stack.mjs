/**
 * Shared helpers for the local development lifecycle scripts (LOCAL_DEVELOPMENT.md).
 * Everything here targets the local Supabase CLI stack only and never touches a
 * hosted environment.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SUPABASE_DIR = fileURLToPath(new URL('../../supabase/', import.meta.url));
export const OBSERVABILITY_COMPOSE = fileURLToPath(
  new URL('../../infra/observability/docker-compose.yml', import.meta.url),
);
export const SEED_FILE = fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url));
export const SEEDS_DIR = fileURLToPath(new URL('../../supabase/seeds/', import.meta.url));

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal']);

export const log = (message = '') => process.stdout.write(`${message}\n`);
export const logStep = (message) => process.stdout.write(`\n▸ ${message}\n`);
export const logSkip = (message) => process.stdout.write(`  – ${message}\n`);

export const fail = (message) => {
  process.stderr.write(`\n✖ ${message}\n`);
  process.exit(1);
};

export const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });

export const capture = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

const AUTH_HOOK_SECRET_FILE = fileURLToPath(new URL('../../supabase/.auth-hook-secret', import.meta.url));

/** Local Send Email Hook secret (Standard Webhooks `whsec_…`), git-ignored. */
export const readAuthHookSecret = () => {
  const fileValue = existsSync(AUTH_HOOK_SECRET_FILE) ? readFileSync(AUTH_HOOK_SECRET_FILE, 'utf8').trim() : '';
  // CI provides the CLI form (`v1,whsec_…`); the file and the API use the bare value.
  const value = fileValue || process.env.SUPABASE_AUTH_HOOK_SECRET?.trim() || '';
  return value.startsWith('v1,') ? value.slice(3) : value;
};

export const ensureAuthHookSecret = () => {
  const existing = readAuthHookSecret();
  if (existing) return existing;
  const secret = `whsec_${randomBytes(24).toString('base64')}`;
  if (existsSync(AUTH_HOOK_SECRET_FILE) && statSync(AUTH_HOOK_SECRET_FILE).isDirectory()) {
    rmSync(AUTH_HOOK_SECRET_FILE, { recursive: true, force: true });
  }
  writeFileSync(AUTH_HOOK_SECRET_FILE, `${secret}\n`, { mode: 0o600 });
  return secret;
};

/**
 * The CLI expects `secrets = "v1,whsec_<base64>"`, while the API verifies against the
 * bare `whsec_<base64>` value, so the helper adds the `v1,` prefix for the CLI only.
 */
export const supabase = (args, options = {}) => {
  const secret = readAuthHookSecret();
  if (!secret) fail('No local auth hook secret. Run `npm run dev:bootstrap` before starting the stack.');
  return run('npx', ['--no-install', 'supabase', ...args], {
    ...options,
    env: { ...supabaseEnv(), ...(options.env ?? {}) },
  });
};

/** Minimal reader for the numeric ports in `supabase/config.toml`. */
const configPort = (section, fallback) => {
  const configPath = `${SUPABASE_DIR}config.toml`;
  if (!existsSync(configPath)) return fallback;
  const lines = readFileSync(configPath, 'utf8').split('\n');
  let current = '';
  for (const line of lines) {
    const heading = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      continue;
    }
    if (current !== section) continue;
    const port = /^\s*port\s*=\s*(\d+)\s*$/.exec(line);
    if (port?.[1]) return Number(port[1]);
  }
  return fallback;
};

export const LOCAL_PORTS = {
  api: configPort('api', 54321),
  db: configPort('db', 54322),
  studio: configPort('studio', 54323),
  mail: configPort('local_smtp', 54324),
};

const projectId = () => {
  const configPath = `${SUPABASE_DIR}config.toml`;
  if (!existsSync(configPath)) return null;
  const match = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(readFileSync(configPath, 'utf8'));
  return match?.[1] ?? null;
};

/** `supabase status -o json` as an object, or null when the stack is not running. */
/**
 * Environment for every Supabase CLI call: the local config references the Send
 * Email Hook secret, so it must exist and be passed as `v1,whsec_…`.
 */
export const supabaseEnv = () => ({ ...process.env, SUPABASE_AUTH_HOOK_SECRET: `v1,${ensureAuthHookSecret()}` });

export const supabaseStatus = () => {
  try {
    const output = capture('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { env: supabaseEnv() });
    const start = output.indexOf('{');
    if (start < 0) return null;
    return JSON.parse(output.slice(start));
  } catch {
    return null;
  }
};

export const isLocalDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return false;
    if (!LOCAL_HOSTNAMES.has(parsed.hostname)) return false;
    return Number(parsed.port || 5432) === LOCAL_PORTS.db;
  } catch {
    return false;
  }
};

/**
 * Refuses to seed or reset anything that is not the local Supabase database.
 * The check is host/port based on purpose: `NODE_ENV` is never used as evidence
 * of safety (LOCAL_DEVELOPMENT.md §2).
 */
export const requireLocalDatabase = (purpose, url) => {
  if (!url) fail(`${purpose} refused: no local database found. Run \`npm run supabase:start\` first.`);
  if (!isLocalDatabaseUrl(url)) {
    fail(
      `${purpose} refused: ${url.replace(/\/\/[^@]*@/, '//***@')} is not the local Supabase database ` +
        `(${LOCAL_PORTS.db}). This command only ever targets local development data.`,
    );
  }
  return url;
};

/**
 * Writes the local product configuration to apps/web/.env.local (git-ignored).
 * Values come from the running local stack, so nothing here is a real secret.
 */
export const writeLocalEnv = (status) => {
  const file = fileURLToPath(new URL('../../apps/web/.env.local', import.meta.url));
  const metricsTokenFile = fileURLToPath(new URL('../../infra/observability/metrics-token', import.meta.url));
  const metricsToken = randomBytes(24).toString('hex');
  mkdirSync(fileURLToPath(new URL('../../infra/observability/', import.meta.url)), { recursive: true });
  // Docker creates a directory when a bind-mount source is missing; replace it.
  if (existsSync(metricsTokenFile) && statSync(metricsTokenFile).isDirectory()) {
    rmSync(metricsTokenFile, { recursive: true, force: true });
  }
  writeFileSync(metricsTokenFile, `${metricsToken}\n`, { mode: 0o600 });
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL ?? '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? '',
    SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY ?? '',
    DATABASE_URL: status.DB_URL ?? '',
    APP_URL: 'http://localhost:3000',
    EMAIL_DRIVER: 'smtp',
    SMTP_URL: `smtp://127.0.0.1:${LOCAL_PORTS.mail + 1}`,
    EMAIL_FROM: 'Uspomena <noreply@uspomena.test>',
    SUPABASE_AUTH_HOOK_SECRET: ensureAuthHookSecret(),
    METRICS_ENABLED: 'true',
    METRICS_TOKEN: metricsToken,
    DIAGNOSTICS_ENABLED: 'true',
    NEXT_PUBLIC_DIAGNOSTICS_ENABLED: 'true',
  };
  const body = [
    '# Generated by `npm run dev:bootstrap` for the local Supabase stack.',
    '# Git-ignored; regenerate instead of editing. Names: docs/mvp/ENVIRONMENT.md.',
    ...Object.entries(values).map(([name, value]) => `${name}=${value}`),
    '',
  ].join('\n');
  writeFileSync(file, body, { mode: 0o600 });
  return file;
};

export const portIsFree = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (free) => {
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(false));
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(true));
  });

export const nodeVersionLine = () => {
  const expected = existsSync(`${ROOT}.nvmrc`) ? readFileSync(`${ROOT}/.nvmrc`, 'utf8').trim() : '';
  return { expected, actual: process.versions.node };
};

export const dockerIsRunning = () => {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
};

export const startObservability = () => {
  if (!existsSync(OBSERVABILITY_COMPOSE)) {
    logSkip('observability stack not provisioned yet (added by the local metrics task)');
    return;
  }
  if (run('docker', ['compose', '-f', OBSERVABILITY_COMPOSE, 'up', '-d']).status !== 0) {
    fail('Could not start the local Prometheus/Grafana stack.');
  }
};

export const stopObservability = () => {
  if (!existsSync(OBSERVABILITY_COMPOSE)) {
    logSkip('observability stack not provisioned yet');
    return;
  }
  run('docker', ['compose', '-f', OBSERVABILITY_COMPOSE, 'down']);
};

export const seedTargetContainer = () => {
  const id = projectId();
  return id ? `supabase_db_${id}` : null;
};
