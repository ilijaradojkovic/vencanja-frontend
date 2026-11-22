#!/usr/bin/env node
/**
 * Applies the forward-only Drizzle migrations in `packages/api/db/migrations`
 * (SPEC D3). The connection comes from `DIRECT_URL`; when it is unset the local
 * Supabase CLI stack is used, so M0–M6 need no cloud credentials.
 *
 * Migrations are additive and reviewed in git; nothing here resets or seeds
 * data. `npm run dev:reset` is the only destructive local command.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const apiDir = fileURLToPath(new URL('../packages/api/', import.meta.url));

const run = (command, args, options) =>
  execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });

const localDatabaseUrl = () => {
  try {
    const status = run('npx', ['--no-install', 'supabase', 'status', '-o', 'env'], { cwd: root });
    const match = /^DB_URL="?([^"\n]+)"?/m.exec(status);
    if (!match?.[1]) throw new Error('DB_URL was not reported');
    return match[1];
  } catch (error) {
    throw new Error(
      `No DIRECT_URL set and the local Supabase stack is not running. Run \`npm run supabase:start\` first.\n${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/** The host is printed for orientation, the credentials never are. */
const describeTarget = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return 'the configured database';
  }
};

const directUrl = process.env.DIRECT_URL?.trim();
const url = directUrl || localDatabaseUrl();

process.stdout.write(`Applying migrations to ${describeTarget(url)}${directUrl ? '' : ' (local Supabase)'}\n`);

let exitCode = 0;
try {
  execFileSync('npx', ['--no-install', 'drizzle-kit', 'migrate'], {
    cwd: apiDir,
    env: { ...process.env, DIRECT_URL: url },
    stdio: 'inherit',
  });
} catch {
  exitCode = 1;
  process.stderr.write('Migrations failed; the database was left unchanged. See the error above.\n');
}
process.exit(exitCode);
