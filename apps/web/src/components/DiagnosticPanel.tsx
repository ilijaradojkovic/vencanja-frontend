'use client';

import { useState } from 'react';

import { apiFetch } from '@/lib/diagnostics/api';
import { currentTraceId, snapshot } from '@/lib/diagnostics/ring';

type ErrorDetails = {
  message: string;
  code: string;
  traceId: string;
  requestId: string;
};

/**
 * Tester error details (LOCAL_DEVELOPMENT.md §5): shows the localized message, the
 * stable code and the correlation IDs, and offers "Copy diagnostic ID" and
 * "Download diagnostic report". The download posts the sanitized browser events of
 * the current trace to the local-only export endpoint; the resulting JSON is the
 * support bundle a tester attaches to a bug report.
 */
export function DiagnosticPanel({ details }: { details: ErrorDetails }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'downloading' | 'failed'>('idle');

  const copy = async () => {
    const text = `${details.code} traceId=${details.traceId} requestId=${details.requestId}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      return;
    } catch {
      // WebKit without clipboard permission: fall back to a selection copy.
    }
    try {
      const field = document.createElement('textarea');
      field.value = text;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  const download = async () => {
    setStatus('downloading');
    try {
      const response = await apiFetch('/api/diagnostics/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          traceId: details.traceId || currentTraceId(),
          events: snapshot(details.traceId),
          client: { route: window.location.pathname, language: document.documentElement.lang },
        }),
      });
      if (!response.ok) {
        setStatus('failed');
        return;
      }
      const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `uspomena-diagnostic-${details.traceId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <section aria-label="Detalji greške" data-testid="diagnostic-panel">
      <p data-testid="diagnostic-message">{details.message}</p>
      <p>
        Kod: <code data-testid="diagnostic-code">{details.code}</code>
      </p>
      <p>
        Trace: <code data-testid="diagnostic-trace">{details.traceId}</code>
      </p>
      <p>
        Request: <code data-testid="diagnostic-request">{details.requestId}</code>
      </p>
      <button type="button" onClick={copy}>
        Kopiraj ID
      </button>
      <button type="button" onClick={download}>
        Preuzmi dijagnostiku
      </button>
      {status === 'copied' && <p data-testid="diagnostic-copied">ID je kopiran.</p>}
      {status === 'failed' && <p data-testid="diagnostic-error">Nije uspelo. Pokušajte ponovo.</p>}
    </section>
  );
}
