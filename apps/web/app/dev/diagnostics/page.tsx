import { notFound } from 'next/navigation';

import { DiagnosticsClient } from '@/components/DiagnosticsClient';

export const dynamic = 'force-dynamic';

/**
 * Local developer/testing menu (LOCAL_DEVELOPMENT.md §5). Hidden unless
 * `NEXT_PUBLIC_DIAGNOSTICS_ENABLED=true`, which `dev:bootstrap` sets locally only.
 */
export default function DiagnosticsPage() {
  if (process.env.NEXT_PUBLIC_DIAGNOSTICS_ENABLED !== 'true') notFound();
  return <DiagnosticsClient />;
}
