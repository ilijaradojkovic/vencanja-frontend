#!/usr/bin/env node
/**
 * `npm run dev:reset` — rebuilds the local stack from scratch, then migrates and
 * seeds (LOCAL_DEVELOPMENT.md §2). Destructive, therefore guarded twice:
 *
 *   1. `ALLOW_LOCAL_RESET=1` must be supplied for this command;
 *   2. the target must be the local Supabase stack (host/port allow-list, never
 *      inferred from NODE_ENV).
 *
 * `DIRECT_URL` is deliberately ignored: a reset only ever touches local data.
 */
import {
  LOCAL_PORTS,
  fail,
  log,
  logStep,
  ensureAuthHookSecret,
  requireLocalDatabase,
  run,
  startObservability,
  supabase,
  supabaseStatus,
} from './lib/local-stack.mjs';

const ALLOW = 'ALLOW_LOCAL_RESET=1';

logStep('Local reset guard');
if (process.env.ALLOW_LOCAL_RESET !== '1') {
  fail(
    `Refusing to reset local data. This deletes the local database and Storage files.\n` +
      `Re-run with ${ALLOW} npm run dev:reset if that is what you want.`,
  );
}
if (process.env.DIRECT_URL?.trim()) {
  fail(
    'Refusing to reset while DIRECT_URL is set: reset must always target the local stack. ' +
      'Unset DIRECT_URL and run again.',
  );
}
const before = supabaseStatus();
if (!before) fail(`The local Supabase stack is not running. Start it with \`npm run supabase:start\` first.`);
requireLocalDatabase('Local reset', before.DB_URL);
log(`  ✓ ${ALLOW} supplied and ${LOCAL_PORTS.db} is the local database`);

logStep('Recreating the local stack');
ensureAuthHookSecret();
if (supabase(['stop', '--no-backup']).status !== 0) fail('Could not stop the local stack.');
if (supabase(['start']).status !== 0) fail('Could not start a clean local stack.');
const status = supabaseStatus();
if (!status) fail('The local Stack did not report its status after starting.');
requireLocalDatabase('Local reset', status.DB_URL);

logStep('Observability');
startObservability();

logStep('Migrations');
if (run('npm', ['run', '--silent', 'db:migrate'], { env: { ...process.env, DIRECT_URL: '' } }).status !== 0) {
  fail('Migrations failed after the reset.');
}

logStep('Seeds');
if (run('npm', ['run', '--silent', 'db:seed'], { env: { ...process.env, DIRECT_URL: '' } }).status !== 0) {
  fail('Seeding failed after the reset.');
}

log('\nLocal data was rebuilt. The API, Studio and local mailbox are available again.');
