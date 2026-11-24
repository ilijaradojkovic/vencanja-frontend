import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BigAlbumPage } from '../src/features/photos/album/BigAlbumPage';
import { DashboardPhotos } from '../src/features/photos/DashboardPhotos';
import { GalleryPage } from '../src/features/photos/GalleryPage';
import { PhotosPage } from '../src/features/photos/PhotosPage';
import { apiFetch } from '../src/lib/diagnostics/api';
import { LocaleProvider } from '../src/lib/i18n/client';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedFetch = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const photo = (id: string, status: 'pending' | 'approved' | 'hidden' = 'pending', extra = {}) => ({
  id,
  weddingId: 'event-1',
  guestId: null,
  senderName: `Gost ${id}`,
  category: 'wedding' as const,
  message: `Poruka ${id}`,
  status,
  width: 1600,
  height: 1200,
  sizeBytes: 1000,
  createdAt: '2026-11-24T10:00:00.000Z',
  url: `https://storage.test/web/${id}.jpg?token=s1`,
  thumbUrl: `https://storage.test/thumb/${id}.jpg?token=s1`,
  ...extra,
});

const counts = { pending: 2, approved: 1, hidden: 0, all: 3 };
const withProvider = (ui: React.ReactElement) => render(<LocaleProvider locale="sr">{ui}</LocaleProvider>);

beforeEach(() => {
  mockedFetch.mockReset();
  window.localStorage.clear();
});

describe('PhotosPage (UC-34 – UC-39)', () => {
  it('shows thumbnails with status tabs and counts, enlarges with the web URL and moderates', async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    mockedFetch.mockImplementation(async (raw: string, init?: RequestInit) => {
      const url = String(raw);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === 'GET' && url.startsWith('/api/weddings/event-1/photos')) {
        return json({ photos: [photo('p1'), photo('p2')], nextCursor: null, counts });
      }
      if (method === 'PATCH') return json({ photo: photo('p1', 'approved') });
      if (method === 'POST') return json({ photos: [photo('p1', 'hidden'), photo('p2', 'hidden')] });
      if (method === 'DELETE') return json({ id: 'p2' });
      return json({}, 404);
    });
    withProvider(<PhotosPage eventId="event-1" />);

    const zoom = await screen.findByRole('button', { name: /Uvećaj fotografiju od Gost p1/ });
    const thumb = zoom.querySelector('img');
    expect(thumb).toHaveAttribute('src', 'https://storage.test/thumb/p1.jpg?token=s1');
    expect(thumb).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('button', { name: /Na čekanju/ })).toHaveTextContent('2');
    expect(calls[0]?.url).toBe('/api/weddings/event-1/photos?status=pending&limit=50');

    // The enlarged view uses the web version.
    await userEvent.click(zoom);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://storage.test/web/p1.jpg?token=s1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zatvori' }));

    // Single approve, bulk hide and delete call the API and reload the page.
    // The first "Odobri" is the (disabled) bulk action; the next ones are per photo.
    const [, approve] = screen.getAllByRole('button', { name: 'Odobri' });
    await userEvent.click(approve as HTMLElement);
    await waitFor(() => expect(calls.some((call) => call.method === 'PATCH')).toBe(true));
    expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({
      url: '/api/photos/p1',
      body: { status: 'approved' },
    });

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Odobri' })[1]).toBeEnabled());
    await userEvent.click(screen.getByRole('checkbox', { name: /Izaberi sve/ }));
    expect(await screen.findByText('Izabrano: 2')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Sakrij/ })[0] as HTMLElement);
    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/bulk-status'))).toBe(true));
    expect(calls.find((call) => call.url.endsWith('/bulk-status'))?.body).toEqual({
      ids: ['p1', 'p2'],
      status: 'hidden',
    });

    await userEvent.click(screen.getAllByRole('button', { name: 'Obriši fotografiju' })[1] as HTMLElement);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obriši' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true));
    expect(await screen.findByRole('status')).toHaveTextContent('Fotografija je obrisana');
  });

  it('switches tabs/categories server-side, loads more pages and reloads when an image URL expires', async () => {
    const urls: string[] = [];
    mockedFetch.mockImplementation(async (raw: string) => {
      const url = String(raw);
      urls.push(url);
      if (url.includes('cursor=c2')) return json({ photos: [photo('p3', 'approved')], nextCursor: null, counts });
      return json({ photos: [photo('p1', 'approved')], nextCursor: 'c2', counts });
    });
    withProvider(<PhotosPage eventId="event-1" />);
    await screen.findByRole('button', { name: /Gost p1/ });

    await userEvent.click(screen.getByRole('button', { name: /Odobrene/ }));
    await waitFor(() => expect(urls.at(-1)).toBe('/api/weddings/event-1/photos?status=approved&limit=50'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kategorija' }), 'memories');
    await waitFor(() =>
      expect(urls.at(-1)).toBe('/api/weddings/event-1/photos?status=approved&category=memories&limit=50'),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Učitaj još' }));
    await screen.findByRole('button', { name: /Gost p3/ });
    expect(urls.at(-1)).toContain('cursor=c2');

    const before = urls.length;
    fireEvent.error(screen.getByRole('button', { name: /Gost p3/ }).querySelector('img') as HTMLImageElement);
    // Both loaded pages are re-fetched (re-signed).
    await waitFor(() => expect(urls.length).toBe(before + 2));
  });
});

describe('BigAlbumPage (UC-46 – UC-49)', () => {
  const album = { id: 'event-1', names: 'Ana & Marko', date: '2027-06-12' };

  it('loads approved photos oldest first, uses thumbnails for S/M and web URLs for L and the slideshow', async () => {
    const urls: string[] = [];
    mockedFetch.mockImplementation(async (raw: string) => {
      const url = String(raw);
      urls.push(url);
      if (url.includes('cursor=next')) {
        return json({ photos: [photo('a3', 'approved')], nextCursor: null, counts: { ...counts, approved: 3 } });
      }
      return json({
        photos: [photo('a1', 'approved'), photo('a2', 'approved')],
        nextCursor: 'next',
        counts: { ...counts, approved: 3 },
      });
    });
    withProvider(<BigAlbumPage event={album} />);

    const first = await screen.findByRole('button', { name: 'Fotografija od Gost a1' });
    expect(urls[0]).toBe('/api/weddings/event-1/photos?status=approved&order=asc&limit=60');
    expect(first.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/thumb/a1.jpg'));
    expect(screen.getByText(/2 slike čekaju odobrenje/)).toBeInTheDocument();

    // "Show more" loads the next page.
    await userEvent.click(screen.getByRole('button', { name: /Prikaži još 1 od 1/ }));
    await screen.findByRole('button', { name: 'Fotografija od Gost a3' });

    // Size L switches the wall to the web version.
    await userEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(screen.getByRole('button', { name: 'Fotografija od Gost a1' }).querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/web/a1.jpg'),
    );

    // The slideshow shows the web version; the preference survives in localStorage.
    await userEvent.click(screen.getByRole('button', { name: 'Prezentacija' }));
    expect(screen.getByTestId('slide').querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/web/a1.jpg'),
    );
    expect(window.localStorage.getItem('veliki-album:view')).toBe('"prezentacija"');
    await userEvent.click(screen.getByRole('button', { name: 'Sledeća' }));
    expect(screen.getByTestId('slide').querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/web/a2.jpg'),
    );
  });

  it('prefetches the next page during the slideshow and groups photos per guest', async () => {
    window.localStorage.setItem('veliki-album:view', '"prezentacija"');
    const urls: string[] = [];
    mockedFetch.mockImplementation(async (raw: string) => {
      const url = String(raw);
      urls.push(url);
      if (url.includes('cursor=next')) {
        return json({ photos: [photo('b3', 'approved')], nextCursor: null, counts });
      }
      return json({
        photos: [photo('b1', 'approved', { guestId: 'g1' }), photo('b2', 'approved', { guestId: 'g1' })],
        nextCursor: 'next',
        counts,
      });
    });
    withProvider(<BigAlbumPage event={album} />);
    await screen.findByTestId('slide');
    // With only two slides loaded the next page is requested before the end.
    await waitFor(() => expect(urls.some((url) => url.includes('cursor=next'))).toBe(true));
    await waitFor(() => expect(screen.getByText(/\/ 3$/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Po gostima' }));
    expect(screen.getByRole('button', { name: /Gost b1: 2/ })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Gost b1: 2/ }));
    });
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/web/b1.jpg'),
    );
  });
});

describe('GalleryPage (UC-14, UC-67 – UC-69)', () => {
  const gallery = (open: boolean, photos: unknown[] = [], nextCursor: string | null = null) => ({
    gallery: { open, mode: open ? 'now' : 'manual', opensAt: null, total: 3, nextCursor, photos },
  });

  it('shows the open personal gallery with thumbnails, a total, categories, more pages and the lightbox', async () => {
    const urls: string[] = [];
    mockedFetch.mockImplementation(async (raw: string) => {
      const url = String(raw);
      urls.push(url);
      if (url.includes('cursor=g2')) return json(gallery(true, [photo('g3', 'approved')]));
      return json(gallery(true, [photo('g1', 'approved'), photo('g2', 'approved')], 'g2'));
    });
    withProvider(<GalleryPage token="tok123" names="Ana & Marko" invitation={null} />);

    const zoom = await screen.findByRole('button', { name: 'Uvećaj fotografiju od Gost g1' });
    expect(zoom.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/thumb/g1.jpg'));
    expect(screen.getByText(/3 fotografije od gostiju/)).toBeInTheDocument();
    expect(urls[0]).toBe('/api/public/invitations/tok123/gallery');

    await userEvent.click(screen.getByRole('button', { name: 'Učitaj još' }));
    await screen.findByRole('button', { name: 'Uvećaj fotografiju od Gost g3' });

    await userEvent.click(zoom);
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/web/g1.jpg'),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Zatvori' }));

    await userEvent.click(screen.getByRole('button', { name: 'Sa venčanja' }));
    await waitFor(() => expect(urls.at(-1)).toBe('/api/public/invitations/tok123/gallery?category=wedding'));
  });

  it('shows the closed QR gallery with the notify form and the QR-only error', async () => {
    mockedFetch.mockImplementation(async (raw: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') return json({ notifyEmail: 'gost@uspomena.test' });
      expect(String(raw)).toBe('/api/public/weddings/ana-i-marko/gallery');
      return json(gallery(false));
    });
    withProvider(<GalleryPage slug="ana-i-marko" names="Ana & Marko" invitation={null} />);
    expect(await screen.findByRole('heading', { name: 'Galerija još nije otvorena' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'gost@uspomena.test');
    await userEvent.click(screen.getByRole('button', { name: 'Obavesti me' }));
    expect(await screen.findByText('Obavestićemo vas na gost@uspomena.test.')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/public/weddings/ana-i-marko/notify', expect.anything());
  });

  it('reports an unavailable gallery', async () => {
    mockedFetch.mockResolvedValue(json({ message: 'Galerija je dostupna samo preko ličnog linka.' }, 403));
    withProvider(<GalleryPage slug="x" names="Ana" invitation={null} />);
    expect(await screen.findByRole('heading', { name: 'Galerija nije dostupna' })).toBeInTheDocument();
  });
});

describe('DashboardPhotos', () => {
  it('shows pending thumbnails and moderates them', async () => {
    mockedFetch.mockImplementation(async (raw: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'PATCH') return json({ photo: photo('d1', 'approved') });
      expect(String(raw)).toBe('/api/weddings/event-1/photos?status=pending&limit=4');
      return json({ photos: [photo('d1')], nextCursor: null, counts });
    });
    withProvider(<DashboardPhotos eventId="event-1" />);
    expect(await screen.findByRole('img', { name: 'Poruka d1' })).toHaveAttribute(
      'src',
      expect.stringContaining('/thumb/d1.jpg'),
    );
    expect(screen.getByTestId('photo-stats')).toHaveTextContent('3');
    await userEvent.click(screen.getByRole('button', { name: 'Odobri' }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith('/api/photos/d1', expect.objectContaining({ method: 'PATCH' })),
    );
  });
});
