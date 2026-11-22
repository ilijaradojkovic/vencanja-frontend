import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiagnosticPanel } from '../src/components/DiagnosticPanel';
import { record, resetDiagnostics, startTrace } from '../src/lib/diagnostics/ring';

const details = {
  message: 'Broj osoba mora biti između 1 i 3.',
  code: 'personsRange',
  traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  requestId: '11111111-1111-4111-8111-111111111111',
};

beforeEach(() => {
  resetDiagnostics();
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:diagnostics'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DiagnosticPanel', () => {
  it('shows the localized message with the stable code and correlation IDs', () => {
    render(<DiagnosticPanel details={details} />);

    expect(screen.getByTestId('diagnostic-message')).toHaveTextContent(details.message);
    expect(screen.getByTestId('diagnostic-code')).toHaveTextContent('personsRange');
    expect(screen.getByTestId('diagnostic-trace')).toHaveTextContent(details.traceId);
    expect(screen.getByTestId('diagnostic-request')).toHaveTextContent(details.requestId);
  });

  it('copies the diagnostic IDs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<DiagnosticPanel details={details} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kopiraj ID' }));

    expect(writeText).toHaveBeenCalledWith(`personsRange traceId=${details.traceId} requestId=${details.requestId}`);
    expect(screen.getByTestId('diagnostic-copied')).toBeInTheDocument();
  });

  it('downloads the support bundle with the sanitized browser events of the trace', async () => {
    const trace = startTrace('test-submit');
    record({ kind: 'request', method: 'POST', route: '/api/spike/validate' });
    record({
      kind: 'response',
      method: 'POST',
      route: '/api/spike/validate',
      status: 422,
      requestId: details.requestId,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, traceId: trace, events: [], spans: [], warnings: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiagnosticPanel details={{ ...details, traceId: trace }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Preuzmi dijagnostiku' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      schemaVersion: number;
      traceId: string;
      events: { kind: string }[];
    };

    expect(path).toBe('/api/diagnostics/export');
    expect(body.schemaVersion).toBe(1);
    expect(body.traceId).toBe(trace);
    expect(body.events.map((event) => event.kind)).toEqual(['action', 'request', 'response']);
    expect(String(init.body)).not.toContain(details.message);
  });
});
