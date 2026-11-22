#!/usr/bin/env node
/**
 * `npm run dev:services` — restarts the local services without touching data
 * (LOCAL_DEVELOPMENT.md §2): the Supabase CLI stack and, once provisioned, the
 * Prometheus/Grafana stack. No migrations, no seeds, nothing destructive.
 */
import { log, logSkip, logStep, startObservability, supabase, supabaseStatus } from './lib/local-stack.mjs';

logStep('Local Supabase stack');
if (supabaseStatus()) {
  logSkip('already running');
} else if (supabase(['start']).status !== 0) {
  process.stderr.write('\n✖ `supabase start` failed. See the output above.\n');
  process.exit(1);
} else {
  log('  ✓ started');
}

logStep('Local observability stack');
startObservability();

log('\nServices are up. Data was not changed: use `npm run dev:reset` to rebuild local data.');
