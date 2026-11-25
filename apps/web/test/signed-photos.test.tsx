import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SignedPhoto } from '../src/features/photos/SignedPhoto';
import {
  ApiLoadError,
  EXPIRED_RELOAD_COOLDOWN_MS,
  fetchEventPhotos,
  fetchInvitationGallery,
  fetchSlugGallery,
  SIGNED_URL_REFRESH_MARGIN_MS,
  SIGNED_URL_TTL_MS,
  useSignedPages,
  type SignedPage,
} from '../src/features/photos/signed-photos';
import { apiFetch } from '../src/lib/diagnostics/api';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedFetch = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Item = { id: string; thumbUrl: string; width: number; height: number };

/** A minimal grid built on the hook: every image reports a load failure to the list. */
function Grid({
  load,
  filter = 'all',
}: {
  load: (cursor: string | null) => Promise<SignedPage<Item>>;
  filter?: string;
}) {
  const { items, error, loading, hasMore, loadMore, loadingMore, onUrlExpired } = useSignedPages(load, filter);
  return (
    <div>
      {loading && <p>loading</p>}
      {error && <p role="alert">{error.message}</p>}
      {hasMore && (
        <button type="button" onClick={() => void loadMore()} disabled={loadingMore}>
          more
        </button>
      )}
      {items.map((item) => (
        <SignedPhoto
          key={item.id}
          src={item.thumbUrl}
          alt={item.id}
          width={item.width}
          height={item.height}
          onExpired={onUrlExpired}
        />
      ))}
    </div>
  );
}

const item = (id: string, n: number): Item => ({
  id,
  thumbUrl: `https://storage.test/${id}.jpg?token=v${n}`,
  width: 400,
  height: 300,
});
const page = (items: Item[], nextCursor: string | null = null): SignedPage<Item> => ({
  items,
  nextCursor,
  meta: undefined,
});
const version = (n: number): SignedPage<Item> => page([item('a', n), item('b', n)]);

afterEach(() => {
  vi.useRealTimers();
  mockedFetch.mockReset();
});

describe('SignedPhoto', () => {
  it('renders a lazy, async-decoded img with intrinsic size and reports load errors', () => {
    const onExpired = vi.fn();
    render(
      <SignedPhoto
        src="https://storage.test/x.jpg?token=t"
        alt="Foto"
        width={400}
        height={300}
        onExpired={onExpired}
      />,
    );
    const img = screen.getByRole('img', { name: 'Foto' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('width', '400');
    expect(img).toHaveAttribute('height', '300');
    fireEvent.error(img);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without a URL', () => {
    const { container } = render(<SignedPhoto src={null} alt="x" width={null} height={null} onExpired={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('useSignedPages (SPEC §7.3)', () => {
  it('reloads the list once when images fail, and a broken image cannot loop', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    const load = vi.fn(async () => version(++calls));
    render(<Grid load={load} />);

    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'a' })).toHaveAttribute('src', expect.stringContaining('v1')),
    );
    // Two images failing at once (both URLs expired) trigger a single reload.
    fireEvent.error(screen.getByRole('img', { name: 'a' }));
    fireEvent.error(screen.getByRole('img', { name: 'b' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'a' })).toHaveAttribute('src', expect.stringContaining('v2')),
    );
    expect(load).toHaveBeenCalledTimes(2);

    // A failure right after that reload (a genuinely broken image) is ignored…
    fireEvent.error(screen.getByRole('img', { name: 'b' }));
    fireEvent.error(screen.getByRole('img', { name: 'b' }));
    expect(load).toHaveBeenCalledTimes(2);

    // …but after the cooldown an expired URL reloads the list again.
    vi.setSystemTime(Date.now() + EXPIRED_RELOAD_COOLDOWN_MS + 1);
    fireEvent.error(screen.getByRole('img', { name: 'b' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'b' })).toHaveAttribute('src', expect.stringContaining('v3')),
    );
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('refreshes before the one-hour URLs expire and when a stale tab becomes visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    const load = vi.fn(async () => version(++calls));
    render(<Grid load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await screen.findByRole('img', { name: 'a' });

    await act(async () => {
      vi.advanceTimersByTime(SIGNED_URL_TTL_MS - SIGNED_URL_REFRESH_MARGIN_MS - 1000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    // A tab that slept past the refresh point reloads as soon as it is visible.
    vi.setSystemTime(Date.now() + SIGNED_URL_TTL_MS);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  });

  it('loads further pages, re-signs every loaded page on expiry and restarts when the key changes', async () => {
    let signing = 1;
    const load = vi.fn(async (cursor: string | null) =>
      cursor === null ? page([item('a', signing)], 'c2') : page([item('b', signing)], null),
    );
    const { rerender } = render(<Grid load={load} />);
    await screen.findByRole('img', { name: 'a' });
    expect(screen.queryByRole('img', { name: 'b' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'more' }));
    await screen.findByRole('img', { name: 'b' });
    expect(load).toHaveBeenLastCalledWith('c2');
    expect(screen.queryByRole('button', { name: 'more' })).not.toBeInTheDocument();

    // Expiry re-fetches both loaded pages, so the second page is re-signed too.
    signing = 2;
    fireEvent.error(screen.getByRole('img', { name: 'b' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'b' })).toHaveAttribute('src', expect.stringContaining('v2')),
    );
    expect(screen.getByRole('img', { name: 'a' })).toHaveAttribute('src', expect.stringContaining('v2'));
    expect(load).toHaveBeenCalledTimes(4);

    // A new filter key starts over from the first page only.
    rerender(<Grid load={load} filter="approved" />);
    await waitFor(() => expect(screen.queryByRole('img', { name: 'b' })).not.toBeInTheDocument());
    expect(screen.getByRole('img', { name: 'a' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(5);
    expect(load).toHaveBeenLastCalledWith(null);
  });

  it('shows the load error', async () => {
    render(<Grid load={async () => Promise.reject(new Error('Nema veze'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nema veze');
  });
});

describe('signed photo loaders', () => {
  it('call the photo list and both gallery endpoints through apiFetch with filters and cursor', async () => {
    const counts = { pending: 1, approved: 0, hidden: 0, all: 1 };
    mockedFetch.mockResolvedValueOnce(json({ photos: [{ id: 'p1' }], nextCursor: 'n1', counts }));
    expect(await fetchEventPhotos('event-1')).toEqual({ items: [{ id: 'p1' }], nextCursor: 'n1', meta: counts });
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/weddings/event-1/photos');

    mockedFetch.mockResolvedValueOnce(json({ photos: [], nextCursor: null, counts }));
    await fetchEventPhotos('event-1', { status: 'pending', category: 'all', order: 'asc' }, 'n1');
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/weddings/event-1/photos?status=pending&order=asc&cursor=n1');

    mockedFetch.mockResolvedValueOnce(
      json({ gallery: { open: true, mode: 'now', opensAt: null, total: 3, nextCursor: 'g2', photos: [] } }),
    );
    expect(await fetchInvitationGallery('tok', { category: 'memories' })).toEqual({
      items: [],
      nextCursor: 'g2',
      meta: { open: true, mode: 'now', opensAt: null, total: 3 },
    });
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/public/invitations/tok/gallery?category=memories');

    mockedFetch.mockResolvedValueOnce(
      json({ gallery: { open: false, mode: 'manual', opensAt: null, total: 0, nextCursor: null, photos: [] } }),
    );
    expect((await fetchSlugGallery('ana-i-marko', {}, 'g2')).meta).toMatchObject({ open: false });
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/public/weddings/ana-i-marko/gallery?cursor=g2');
  });

  it('throw the API message and code on failure', async () => {
    mockedFetch.mockResolvedValueOnce(
      json({ message: 'Galerija je samo za goste.', code: 'galleryPersonalOnly' }, 403),
    );
    const failure = await fetchSlugGallery('x').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiLoadError);
    expect(failure).toMatchObject({ message: 'Galerija je samo za goste.', status: 403, code: 'galleryPersonalOnly' });
  });
});
