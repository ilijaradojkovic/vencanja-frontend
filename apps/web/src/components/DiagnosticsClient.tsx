'use client';

import { useState } from 'react';

import { DiagnosticPanel } from '@/components/DiagnosticPanel';
import { apiFetch } from '@/lib/diagnostics/api';
import { currentTraceId, snapshot, startTrace, type DiagnosticEvent } from '@/lib/diagnostics/ring';

type ErrorDetails = { message: string; code: string; traceId: string; requestId: string };

/**
 * Local developer/testing menu (LOCAL_DEVELOPMENT.md §5). It triggers a real
 * validation failure against the mounted API and shows the error details with the
 * copy/download actions, plus the current browser event ring.
 */
export function DiagnosticsClient() {
  const [persons, setPersons] = useState('9');
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTrace('diagnostics-demo-submit');
    const response = await apiFetch('/api/spike/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'sr' },
      body: JSON.stringify({ persons }),
    });
    const body = (await response.json()) as Partial<ErrorDetails>;
    setEvents(snapshot());
    setError(
      response.ok
        ? null
        : {
            message: body.message ?? 'Greška',
            code: body.code ?? 'unknown',
            traceId: body.traceId ?? currentTraceId(),
            requestId: body.requestId ?? '',
          },
    );
  };

  return (
    <main>
      <h1>Dijagnostika (lokalno)</h1>
      <p>Alat za testiranje: izaziva stvarnu grešku validacije i prikazuje detalje za prijavu problema.</p>
      <form onSubmit={submit}>
        <label htmlFor="persons">Broj osoba (dozvoljeno 1–3)</label>
        <input id="persons" name="persons" value={persons} onChange={(changed) => setPersons(changed.target.value)} />
        <button type="submit">Pošalji neispravan zahtev</button>
      </form>
      {error ? <DiagnosticPanel details={error} /> : null}
      <h2>Poslednji događaji</h2>
      <ol data-testid="diagnostic-events">
        {events.map((item) => (
          <li key={`${item.at}-${item.kind}-${item.route ?? item.action ?? ''}`}>
            {item.kind} {item.method ?? ''} {item.route ?? item.action ?? ''} {item.status ?? ''} {item.code ?? ''}
          </li>
        ))}
      </ol>
    </main>
  );
}
