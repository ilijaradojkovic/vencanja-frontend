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
  useSignedList,
} from '../src/features/photos/signed-photos';
import { apiFetch } from '../src/lib/diagnostics/api';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedFetch = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Item = { id: string; thumbUrl: string; width: number; height: number };

/** A minimal grid built on the hook: every image reports a load failure to the list. */
function Grid({ load }: { load: () => Promise<Item[]> }) {
  const { data, error, loading, onUrlExpired } = useSignedList(load);
  return (
    <div>
      {loading && <p>loading</p>}
      {error && <p role="alert">{error.message}</p>}
      {data?.map((item) => (
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

const version = (n: number): Item[] => [
  { id: 'a', thumbUrl: `https://storage.test/a.jpg?token=v${n}`, width: 400, height: 300 },
  { id: 'b', thumbUrl: `https://storage.test/b.jpg?token=v${n}`, width: 300, height: 400 },
];

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

describe('useSignedList (SPEC §7.3)', () => {
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

  it('shows the load error', async () => {
    render(<Grid load={async () => Promise.reject(new Error('Nema veze'))} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nema veze');
  });
});

describe('signed photo loaders', () => {
  it('call the photo list and both gallery endpoints through apiFetch', async () => {
    mockedFetch.mockResolvedValueOnce(json({ photos: [{ id: 'p1' }] }));
    expect(await fetchEventPhotos('event-1')).toEqual([{ id: 'p1' }]);
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/weddings/event-1/photos');

    mockedFetch.mockResolvedValueOnce(json({ gallery: { open: true, photos: [] } }));
    expect(await fetchInvitationGallery('tok')).toMatchObject({ open: true });
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/public/invitations/tok/gallery');

    mockedFetch.mockResolvedValueOnce(json({ gallery: { open: false, photos: [] } }));
    expect(await fetchSlugGallery('ana-i-marko')).toMatchObject({ open: false });
    expect(mockedFetch).toHaveBeenLastCalledWith('/api/public/weddings/ana-i-marko/gallery');
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
