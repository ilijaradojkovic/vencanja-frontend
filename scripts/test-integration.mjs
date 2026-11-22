#!/usr/bin/env node
/**
 * `npm run test:integration` — API integration tests against the real local
 * Supabase database (DOD M1). There are no mocks here: the stack is started if
 * needed, migrations are applied and the tests use `DATABASE_URL` from the CLI.
 */
import { spawnSync } from 'node:child_process';

import { ensureAuthHookSecret, fail, log, logStep, supabase, supabaseStatus } from './lib/local-stack.mjs';

logStep('Local Supabase stack');
ensureAuthHookSecret();
if (!supabaseStatus() && supabase(['start']).status !== 0) fail('Could not start the local Supabase stack.');

const status = supabaseStatus();
if (!status?.DB_URL) fail('The local Supabase stack did not report its database URL.');

logStep('Migrations');
const migrate = spawnSync('npm', ['run', '--silent', 'db:migrate'], {
  env: { ...process.env, DIRECT_URL: '' },
  stdio: 'inherit',
});
if (migrate.status !== 0) fail('Migrations failed before the integration tests.');

logStep('Integration tests');
const tests = spawnSync('npm', ['run', '--silent', 'test:integration', '-w', '@uspomena/api'], {
  env: { ...process.env, DATABASE_URL: status.DB_URL, APP_VERSION: '0.1.0' },
  stdio: 'inherit',
});
if (tests.status !== 0) process.exit(tests.status ?? 1);

log('\nIntegration tests passed against the local database.');
