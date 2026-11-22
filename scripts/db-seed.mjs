#!/usr/bin/env node
/**
 * Applies the documented local seeds only (LOCAL_DEVELOPMENT.md §3).
 *
 * 1. Any `supabase/seed.sql` / `supabase/seeds/*.sql` files, via `psql` in the local
 *    database container with `ON_ERROR_STOP=1`.
 * 2. The TypeScript fixture runner in `packages/api/src/db/seed.ts`, which creates
 *    verified Auth users through the Admin API, upserts deterministic rows and
 *    uploads real image files into the private `photos` bucket.
 *
 * Everything targets the local Supabase stack exclusively, sends no email and is
 * idempotent, so it can run after every bootstrap or reset.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import {
  ROOT,
  SEED_FILE,
  SEEDS_DIR,
  fail,
  log,
  logStep,
  requireLocalDatabase,
  seedTargetContainer,
  supabaseStatus,
} from './lib/local-stack.mjs';

const status = supabaseStatus();
if (!status?.DB_URL) {
  fail('The local Supabase stack is not running. Run `npm run supabase:start` first.');
}

const databaseUrl = process.env.DIRECT_URL?.trim() || status.DB_URL;
requireLocalDatabase('Seeding', databaseUrl);

const sqlFiles = [
  ...(existsSync(SEED_FILE) ? [SEED_FILE] : []),
  ...(existsSync(SEEDS_DIR)
    ? readdirSync(SEEDS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => `${SEEDS_DIR}${name}`)
    : []),
];

if (sqlFiles.length > 0) {
  const container = seedTargetContainer();
  if (!container) fail('Could not resolve the local Supabase database container from supabase/config.toml.');
  logStep('SQL seeds');
  for (const file of sqlFiles) {
    const result = spawnSync(
      'docker',
      ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
      { input: readFileSync(file), stdio: ['pipe', 'inherit', 'inherit'] },
    );
    if (result.status !== 0) fail(`Seed file ${file.replace(ROOT, '.')} failed.`);
    log(`  ✓ ${file.slice(file.lastIndexOf('/') + 1)}`);
  }
}

logStep('Fixture seeds');
const seedScript = `${ROOT}packages/api/src/db/seed.ts`;
const serviceKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
if (!serviceKey) fail('The local stack did not report a service-role key.');

const result = spawnSync(process.execPath, [seedScript], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SUPABASE_URL: status.API_URL ?? '',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  },
});
if (result.status !== 0) fail('The fixture seed runner failed. See the output above.');
