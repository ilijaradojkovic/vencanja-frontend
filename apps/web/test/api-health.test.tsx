import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiHealth } from '../src/components/ApiHealth';

const mockFetch = (response: { ok: boolean; status: number; body: unknown }) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiHealth', () => {
  it('shows the API version when /api/health answers ok', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { ok: true, version: '0.1.0', db: 'ok' } });

    render(<ApiHealth />);
    expect(screen.getByRole('status')).toHaveTextContent('API: provera…');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API: ok (v0.1.0)'));
    expect(fetchMock).toHaveBeenCalledWith('/api/health');
  });

  it('shows the error code from the error envelope', async () => {
    mockFetch({
      ok: false,
      status: 503,
      body: { ok: false, code: 'internalError', message: 'x', requestId: 'r', traceId: 't' },
    });

    render(<ApiHealth />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API: nedostupno (internalError)'));
  });

  it('reports a network failure without a response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<ApiHealth />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API: nedostupno (networkError)'));
  });
});
