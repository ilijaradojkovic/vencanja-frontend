import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadAllOriginals, downloadMode, downloadOriginal } from '../src/features/photos/download';
import { DownloadAllModal } from '../src/features/photos/DownloadAllModal';
import { apiFetch } from '../src/lib/diagnostics/api';
import { LocaleProvider } from '../src/lib/i18n/client';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedApi = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const bytesOf = (id: string) => new TextEncoder().encode(`original-bytes-of-${id}-`.repeat(20));
const file = (id: string) => ({
  id,
  filename: `Gost_2027-06-12_${id}.jpg`,
  url: `https://storage.test/original/${id}.jpg?token=t&download=x`,
  size: bytesOf(id).byteLength,
});

/** Minimal central-directory reader: returns entry names and stored bytes. */
const readZip = (zip: Uint8Array): Map<string, Uint8Array> => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('no end of central directory');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const method = view.getUint16(offset + 10, true);
    expect(method).toBe(0); // stored, not recompressed
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(zip.subarray(offset + 46, offset + 46 + nameLength));
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    entries.set(name, zip.slice(start, start + size));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const pages: Record<string, unknown> = {
  first: { photos: [file('a'), file('b')], nextCursor: 'c2', total: 3, totalBytes: 3000 },
  second: { photos: [file('c')], nextCursor: null, total: 3, totalBytes: 3000 },
};

const mockApi = () =>
  mockedApi.mockImplementation(async (raw: string) => {
    const url = String(raw);
    if (url.includes('/photos/originals')) return json(url.includes('cursor=c2') ? pages.second : pages.first);
    if (url.endsWith('/original')) return json({ original: file('single') });
    return json({}, 404);
  });

const storageFetch = vi.fn(async (url: string) => {
  const id = /original\/(\w+)\.jpg/.exec(url)?.[1] ?? '';
  return new Response(bytesOf(id));
});

/** Compares bytes across the jsdom and Node realms (their Uint8Array classes differ). */
const text = (bytes: Uint8Array | undefined) => (bytes ? Buffer.from(bytes).toString('hex') : '');

const concat = (chunks: Uint8Array[]) => {
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
};

beforeEach(() => {
  mockedApi.mockReset();
  storageFetch.mockClear();
  vi.stubGlobal('fetch', storageFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadAllOriginals (UC-85)', () => {
  it('streams one ZIP to the chosen file across pages with the original bytes and names', async () => {
    mockApi();
    const chunks: Uint8Array[] = [];
    const picker = vi.fn(async () => ({
      createWritable: async () =>
        new WritableStream<Uint8Array>({
          write: (chunk) => {
            chunks.push(chunk);
          },
        }),
    }));
    vi.stubGlobal('showSaveFilePicker', picker);
    expect(downloadMode()).toBe('streaming');

    const progress: number[] = [];
    const outcome = await downloadAllOriginals('event-1', 'all', 'uspomena-ana', 3, (p) => progress.push(p.done));
    expect(outcome).toEqual({ mode: 'streaming', archives: 1 });
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'uspomena-ana.zip' }));
    expect(progress).toEqual([0, 1, 2, 3]);
    expect(mockedApi).toHaveBeenCalledWith('/api/weddings/event-1/photos/originals?status=all&limit=100');
    expect(mockedApi).toHaveBeenCalledWith('/api/weddings/event-1/photos/originals?status=all&limit=100&cursor=c2');
    // Signed Storage URLs are fetched directly, never through the API client.
    expect(storageFetch).toHaveBeenCalledTimes(3);

    const entries = readZip(concat(chunks));
    expect([...entries.keys()]).toEqual(['Gost_2027-06-12_a.jpg', 'Gost_2027-06-12_b.jpg', 'Gost_2027-06-12_c.jpg']);
    for (const id of ['a', 'b', 'c']) {
      expect(text(entries.get(`Gost_2027-06-12_${id}.jpg`))).toBe(text(bytesOf(id)));
    }
  });

  it('falls back to bounded ZIP batches when the browser cannot stream to a file (Safari)', async () => {
    mockApi();
    expect(downloadMode()).toBe('batches');
    const saved: { name: string; blob: Blob }[] = [];
    const blobs = new Map<string, Blob>();
    let counter = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:test-${(counter += 1)}`;
      blobs.set(url, blob as Blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, blob: blobs.get(this.href) as Blob });
    });

    // A batch limit just above two files splits three originals into two archives.
    const limit = file('a').size * 2 + 1;
    const outcome = await downloadAllOriginals('event-1', 'approved', 'uspomena-ana', 3, () => {}, undefined, limit);
    expect(outcome).toEqual({ mode: 'batches', archives: 2 });
    expect(saved.map((entry) => entry.name)).toEqual(['uspomena-ana-1.zip', 'uspomena-ana-2.zip']);

    const first = readZip(new Uint8Array(await saved[0]!.blob.arrayBuffer()));
    const second = readZip(new Uint8Array(await saved[1]!.blob.arrayBuffer()));
    expect([...first.keys()]).toEqual(['Gost_2027-06-12_a.jpg', 'Gost_2027-06-12_b.jpg']);
    expect([...second.keys()]).toEqual(['Gost_2027-06-12_c.jpg']);
    expect(text(second.get('Gost_2027-06-12_c.jpg'))).toBe(text(bytesOf('c')));
    expect(text(first.get('Gost_2027-06-12_a.jpg'))).toBe(text(bytesOf('a')));
  });

  it('downloads a single original through its signed URL', async () => {
    mockApi();
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    await downloadOriginal('single');
    expect(mockedApi).toHaveBeenCalledWith('/api/photos/single/original');
    expect(clicked).toEqual([{ href: file('single').url, download: 'Gost_2027-06-12_single.jpg' }]);
  });
});

describe('DownloadAllModal', () => {
  it('shows the size, warns before very large downloads and reports progress', async () => {
    mockedApi.mockImplementation(async (raw: string) => {
      const url = String(raw);
      if (url.includes('limit=1&') || url.endsWith('limit=1')) {
        return json({
          photos: [],
          nextCursor: null,
          total: url.includes('status=all') ? 3 : 2,
          totalBytes: url.includes('status=all') ? 3_500_000_000 : 2_000_000,
        });
      }
      return json(url.includes('cursor=c2') ? pages.second : pages.first);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <LocaleProvider locale="sr">
        <DownloadAllModal eventId="event-1" archiveName="uspomena-ana" onClose={() => {}} />
      </LocaleProvider>,
    );
    expect(await screen.findByTestId('download-summary')).toHaveTextContent('2 fotografije · 2 MB');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/više manjih ZIP fajlova/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sve \(i na čekanju/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('3.5 GB');

    await userEvent.click(screen.getByRole('button', { name: 'Preuzmi' }));
    await waitFor(() => expect(screen.getByTestId('download-progress')).toHaveTextContent('3 / 3'));
    expect(await screen.findByRole('status')).toHaveTextContent('Preuzeto u 1 ZIP fajla.');
  });
});
