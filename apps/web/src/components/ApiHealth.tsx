'use client';

import { useEffect, useState } from 'react';

type HealthState = { status: 'loading' } | { status: 'ok'; version: string } | { status: 'error'; code: string };

/**
 * Development-only probe that proves the product talks to the mounted API at
 * `/api/*` (DOD M1). It is not rendered in production builds.
 */
export function ApiHealth() {
  const [state, setState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const probe = async () => {
      try {
        const response = await fetch('/api/health');
        const body: { ok?: boolean; version?: string; code?: string } = await response.json();
        if (!active) return;
        setState(
          response.ok && body.ok
            ? { status: 'ok', version: body.version ?? '' }
            : { status: 'error', code: body.code ?? `http${response.status}` },
        );
      } catch {
        if (active) setState({ status: 'error', code: 'networkError' });
      }
    };

    void probe();
    return () => {
      active = false;
    };
  }, []);

  return (
    <p role="status" data-testid="api-health">
      {state.status === 'loading' && 'API: provera…'}
      {state.status === 'ok' && `API: ok (v${state.version})`}
      {state.status === 'error' && `API: nedostupno (${state.code})`}
    </p>
  );
}
