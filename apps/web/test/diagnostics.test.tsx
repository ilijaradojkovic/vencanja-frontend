import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiagnosticPanel } from '../src/components/DiagnosticPanel';
import { DiagnosticsClient } from '../src/components/DiagnosticsClient';
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

  it('falls back to a selection copy when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

    render(<DiagnosticPanel details={details} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kopiraj ID' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByTestId('diagnostic-copied')).toBeInTheDocument();
  });

  it('reports a failed download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}), headers: { get: () => null } }),
    );

    render(<DiagnosticPanel details={details} />);
    await userEvent.click(screen.getByRole('button', { name: 'Preuzmi dijagnostiku' }));

    await waitFor(() => expect(screen.getByTestId('diagnostic-error')).toBeInTheDocument());
  });
});

describe('DiagnosticsClient', () => {
  const respond = (status: number, body: unknown) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: async () => body,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('shows the error details and recorded events after a validation failure', async () => {
    respond(422, {
      message: 'Broj osoba mora biti između 1 i 3.',
      code: 'personsRange',
      traceId: 'a'.repeat(32),
      requestId: 'r-1',
    });

    render(<DiagnosticsClient />);
    await userEvent.click(screen.getByRole('button', { name: 'Pošalji neispravan zahtev' }));

    await waitFor(() => expect(screen.getByTestId('diagnostic-panel')).toBeInTheDocument());
    expect(screen.getByTestId('diagnostic-code')).toHaveTextContent('personsRange');
    expect(screen.getByTestId('diagnostic-events').textContent).toContain('request');
  });

  it('does not show error details when the request succeeds', async () => {
    respond(200, { ok: true, persons: 2 });

    render(<DiagnosticsClient />);
    await userEvent.click(screen.getByRole('button', { name: 'Pošalji neispravan zahtev' }));

    await waitFor(() => expect(screen.getByTestId('diagnostic-events').textContent).toContain('response'));
    expect(screen.queryByTestId('diagnostic-panel')).not.toBeInTheDocument();
  });
});
