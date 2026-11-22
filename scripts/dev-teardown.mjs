#!/usr/bin/env node
/**
 * `npm run dev:teardown` — stops the project-owned local services without
 * deleting their volumes (LOCAL_DEVELOPMENT.md §2). Use `npm run dev:reset` when
 * local data should be rebuilt from scratch.
 */
import { log, logStep, stopObservability, supabase, supabaseStatus } from './lib/local-stack.mjs';

logStep('Local observability stack');
stopObservability();

logStep('Local Supabase stack');
if (!supabaseStatus()) {
  log('  – already stopped');
} else if (supabase(['stop']).status !== 0) {
  process.stderr.write('\n✖ `supabase stop` failed. See the output above.\n');
  process.exit(1);
}

log('\nLocal services are stopped; data volumes were kept. Start them again with `npm run dev:services`.');
