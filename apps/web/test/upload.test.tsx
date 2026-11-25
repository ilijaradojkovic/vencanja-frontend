import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadPage, type UploadWedding } from '../src/features/upload/UploadPage';
import { screenFiles, sendOne, type PutResult, type Transport } from '../src/features/upload/upload-engine';
import { apiFetch } from '../src/lib/diagnostics/api';
import { LocaleProvider } from '../src/lib/i18n/client';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedApi = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const wedding: UploadWedding = {
  names: 'Ana & Marko',
  partner1: 'Ana',
  partner2: 'Marko',
  allowGeneralUpload: true,
  gallery: { open: false, mode: 'manual', opensAt: null, viaQr: true },
};

const jpeg = (name: string, size = 1000) => {
  const file = new File([new Uint8Array(Math.min(size, 10))], name, { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

type Calls = { tickets: unknown[]; completes: string[] };

/** API double: tickets per file, `complete` answers from a per-photo script. */
const mockApi = (completeScript: Record<string, (string | number)[]> = {}): Calls => {
  const calls: Calls = { tickets: [], completes: [] };
  mockedApi.mockImplementation(async (raw: string, init?: RequestInit) => {
    const url = String(raw);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith('/uploads')) {
      calls.tickets.push(body);
      return json(
        {
          uploads: (body.files as { name: string }[]).map((file, index) => ({
            photoId: `photo-${index}`,
            uploadUrl: `https://storage.test/upload/${index}?token=t`,
            uploadKey: `key-${index}`,
          })),
        },
        201,
      );
    }
    const complete = /uploads\/(photo-\d+)\/complete/.exec(url);
    if (complete) {
      const id = complete[1] as string;
      calls.completes.push(id);
      const next = completeScript[id]?.shift() ?? 200;
      if (next === 200) return json({ id, status: 'pending' });
      if (next === 'missing') return json({ message: 'Fajl nije stigao.', code: 'uploadNotFound' }, 422);
      if (next === 'notImage') return json({ message: 'Ovo nije slika.', code: 'notImage' }, 422);
      return json({ message: 'Greška' }, Number(next));
    }
    if (url.endsWith('/notify')) return json({ notifyEmail: body.email });
    return json({}, 404);
  });
  return calls;
};

const renderPage = (props: Partial<React.ComponentProps<typeof UploadPage>> = {}) =>
  render(
    <LocaleProvider locale="sr">
      <UploadPage
        token="tok"
        wedding={wedding}
        guest={{ name: 'Jelena', notifyEmail: '', prefillEmail: '' }}
        retryDelays={[0, 0, 0]}
        {...props}
      />
    </LocaleProvider>,
  );

const choose = (files: File[]) => fireEvent.change(screen.getByTestId('file-input'), { target: { files } });

beforeEach(() => {
  mockedApi.mockReset();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${Math.random()}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('screenFiles (SPEC §7.1 step 1)', () => {
  it('rejects HEIC, other types and files over 30 MB', () => {
    const heic = new File(['x'], 'IMG_1.HEIC', { type: '' });
    const heicTyped = new File(['x'], 'a.jpg', { type: 'image/heic' });
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const big = jpeg('big.jpg', 30 * 1024 * 1024 + 1);
    const ok = jpeg('ok.jpg', 30 * 1024 * 1024);
    const png = new File(['x'], 'b.png', { type: 'image/png' });
    const { accepted, rejected } = screenFiles([heic, heicTyped, pdf, big, ok, png]);
    expect(accepted.map((file) => file.name)).toEqual(['ok.jpg', 'b.png']);
    expect(rejected).toEqual([
      { name: 'IMG_1.HEIC', reason: 'heic' },
      { name: 'a.jpg', reason: 'heic' },
      { name: 'doc.pdf', reason: 'type' },
      { name: 'big.jpg', reason: 'size' },
    ]);
  });
});

describe('sendOne (SPEC §7.1 step 5)', () => {
  const ticket = { photoId: 'photo-0', uploadUrl: 'https://storage.test/u', uploadKey: 'k' };

  it('tries complete before re-uploading after an ambiguous PUT, on the same photo id', async () => {
    const calls = mockApi({ 'photo-0': ['missing', 200] });
    const results: PutResult[] = ['ambiguous', 'stored'];
    const transport = vi.fn<Transport>(async () => results.shift() ?? 'stored');
    const state = await sendOne(ticket, jpeg('a.jpg'), () => {}, { transport, delays: [0, 0, 0] });
    expect(state).toEqual({ phase: 'done', status: 'pending' });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.every(([url]) => url === ticket.uploadUrl)).toBe(true);
    // complete (probe, said missing) → re-PUT → complete.
    expect(calls.completes).toEqual(['photo-0', 'photo-0']);
  });

  it('does not re-upload when the ambiguous PUT actually stored the file', async () => {
    const calls = mockApi({ 'photo-0': [200] });
    const transport = vi.fn<Transport>(async () => 'ambiguous');
    const state = await sendOne(ticket, jpeg('a.jpg'), () => {}, { transport, delays: [0, 0, 0] });
    expect(state.phase).toBe('done');
    expect(transport).toHaveBeenCalledTimes(1);
    expect(calls.completes).toEqual(['photo-0']);
  });

  it('gives up after three retries and treats an existing object as uploaded', async () => {
    mockApi({ 'photo-0': ['missing', 'missing', 'missing'] });
    const transport = vi.fn<Transport>(async () => 'ambiguous');
    expect((await sendOne(ticket, jpeg('a.jpg'), () => {}, { transport, delays: [0, 0, 0] })).phase).toBe('failed');
    expect(transport).toHaveBeenCalledTimes(4);

    const calls = mockApi();
    const exists = vi.fn<Transport>(async () => 'exists');
    expect((await sendOne(ticket, jpeg('a.jpg'), () => {}, { transport: exists, delays: [0] })).phase).toBe('done');
    expect(calls.completes).toEqual(['photo-0']);
  });

  it('stops on a final complete error (the server removed the photo)', async () => {
    mockApi({ 'photo-0': ['notImage'] });
    const state = await sendOne(ticket, jpeg('a.jpg'), () => {}, { transport: async () => 'stored', delays: [0] });
    expect(state).toEqual({ phase: 'rejected', message: 'Ovo nije slika.' });
  });
});

describe('UploadPage (UC-65, UC-66)', () => {
  it('shows rejected files, sends at most three at a time with progress and thanks with the count', async () => {
    const calls = mockApi();
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: (() => void)[] = [];
    const transport: Transport = (_url, file, onProgress) =>
      new Promise((resolve) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        onProgress(file.size / 2);
        releases.push(() => {
          inFlight -= 1;
          resolve('stored');
        });
      });
    renderPage({ transport });

    choose([
      jpeg('a.jpg'),
      jpeg('b.jpg'),
      new File(['x'], 'c.heic', { type: 'image/heic' }),
      jpeg('d.jpg'),
      jpeg('e.jpg', 31 * 1024 * 1024),
      jpeg('f.jpg'),
    ]);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('c.heic: HEIC nije podržan');
    expect(alert).toHaveTextContent('e.jpg je veća od 30 MB');
    expect(screen.getAllByTestId('upload-tile')).toHaveLength(4);

    const addListener = vi.spyOn(window, 'addEventListener');
    await userEvent.click(screen.getByRole('button', { name: /Pošalji 4 fotografije/ }));
    await waitFor(() => expect(releases).toHaveLength(3));
    expect(maxInFlight).toBe(3);
    expect(calls.tickets[0]).toMatchObject({
      category: 'wedding',
      senderName: 'Jelena',
      files: [
        { name: 'a.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'b.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'd.jpg', type: 'image/jpeg', size: 1000 },
        { name: 'f.jpg', type: 'image/jpeg', size: 1000 },
      ],
    });
    expect(screen.getAllByText('Šalje se… 50%')).toHaveLength(3);
    expect(screen.getByText('Čeka')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ukupan napredak slanja' })).toHaveAttribute('aria-valuenow', '38');
    // Leaving mid-upload asks for confirmation.
    expect(addListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    while (releases.length) {
      releases.shift()?.();
      await waitFor(() => expect(inFlight).toBeLessThanOrEqual(3));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(await screen.findByRole('heading', { name: 'Hvala vam!' })).toBeInTheDocument();
    expect(screen.getByText(/Poslali ste 4 fotografije/)).toBeInTheDocument();
    expect(calls.completes).toHaveLength(4);
  });

  it('retries automatically, then offers "Try again" and "Skip" for the failed file only', async () => {
    const calls = mockApi({ 'photo-1': ['missing', 'missing', 'missing', 'missing', 200] });
    let failSecond = true;
    const transport: Transport = async (url) => (url.includes('/upload/1') && failSecond ? 'ambiguous' : 'stored');
    renderPage({ transport });
    choose([jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg')]);
    await userEvent.click(screen.getByRole('button', { name: /Pošalji 3 fotografije/ }));

    const failure = await screen.findByText(/1 fotografija nije poslata/);
    const box = failure.closest('[role="alert"]') as HTMLElement;
    expect(within(box).getByText(/b\.jpg/)).toBeInTheDocument();
    expect(calls.tickets).toHaveLength(1);

    // "Try again" reuses the same photo id; no new tickets are requested.
    failSecond = false;
    await userEvent.click(within(box).getByRole('button', { name: 'Pokušaj ponovo' }));
    expect(await screen.findByText(/Poslali ste 3 fotografije/)).toBeInTheDocument();
    expect(calls.tickets).toHaveLength(1);
    expect(calls.completes.filter((id) => id === 'photo-1').length).toBeGreaterThan(1);
  });

  it('thanks with the successful count after a rejected file is skipped, and subscribes to notify', async () => {
    const calls = mockApi({ 'photo-0': ['notImage'] });
    renderPage({ transport: async () => 'stored' });
    choose([jpeg('broken.jpg'), jpeg('ok.jpg')]);
    await userEvent.click(screen.getByRole('checkbox', { name: /Obavesti me kad galerija bude otvorena/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Email za obaveštenje' }), 'jelena@uspomena.test');
    await userEvent.click(screen.getByRole('button', { name: /Pošalji 2 fotografije/ }));

    const box = (await screen.findByText(/broken\.jpg · Ovo nije slika\./)).closest('[role="alert"]') as HTMLElement;
    expect(within(box).queryByRole('button', { name: 'Pokušaj ponovo' })).not.toBeInTheDocument();
    await userEvent.click(within(box).getByRole('button', { name: 'Preskoči' }));
    expect(await screen.findByText(/Poslali ste 1 fotografija/)).toBeInTheDocument();
    expect(await screen.findByText(/Javićemo vam na jelena@uspomena.test/)).toBeInTheDocument();
    expect(calls.completes).toEqual(['photo-0', 'photo-1']);
  });

  it('shows the ticket error (storage limit) and keeps the files', async () => {
    mockedApi.mockResolvedValue(json({ message: 'Prostor za fotografije je popunjen.', code: 'storageLimit' }, 403));
    renderPage({ transport: async () => 'stored' });
    choose([jpeg('a.jpg')]);
    await userEvent.click(screen.getByRole('button', { name: /Pošalji 1 fotografija/ }));
    expect(await screen.findByText('Prostor za fotografije je popunjen.')).toBeInTheDocument();
    expect(screen.getAllByTestId('upload-tile')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Pošalji 1 fotografija/ })).toBeEnabled();
  });

  it('shows "uploads are turned off" on a QR link when QR uploads are disabled', () => {
    renderPage({
      token: undefined,
      slug: 'ana-i-marko',
      guest: null,
      wedding: { ...wedding, allowGeneralUpload: false },
    });
    expect(screen.getByRole('heading', { name: 'Slanje je isključeno' })).toBeInTheDocument();
  });
});
