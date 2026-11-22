#!/usr/bin/env node
/**
 * Applies the documented local seed files only (LOCAL_DEVELOPMENT.md §3). The
 * seed fixtures live in `supabase/seed.sql` and `supabase/seeds/*.sql`; they are
 * idempotent and target the local Supabase database exclusively.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import {
  SEED_FILE,
  SEEDS_DIR,
  fail,
  log,
  logStep,
  requireLocalDatabase,
  seedTargetContainer,
  supabaseStatus,
} from './lib/local-stack.mjs';
import { spawnSync } from 'node:child_process';

const status = supabaseStatus();
if (!status?.DB_URL) {
  fail('The local Supabase stack is not running. Run `npm run supabase:start` first.');
}

const databaseUrl = process.env.DIRECT_URL?.trim() || status.DB_URL;
requireLocalDatabase('Seeding', databaseUrl);

const files = [
  ...(existsSync(SEED_FILE) ? [SEED_FILE] : []),
  ...(existsSync(SEEDS_DIR)
    ? readdirSync(SEEDS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => `${SEEDS_DIR}${name}`)
    : []),
];

logStep('Local seeds');
if (files.length === 0) {
  log('  – no seed files yet (added by the local seed task)');
  process.exit(0);
}

const container = seedTargetContainer();
if (!container) fail('Could not resolve the local Supabase database container from supabase/config.toml.');

for (const file of files) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'],
    {
      input: readFileSync(file),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  if (result.status !== 0)
    fail(`Seed file ${file.replace(process.cwd(), '.')} failed; nothing was rolled back automatically.`);
  log(`  ✓ ${file.slice(file.lastIndexOf('/') + 1)}`);
}

log(`\nSeeds applied: ${files.length} file(s)`);
