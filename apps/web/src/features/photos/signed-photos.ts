'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/diagnostics/api';

/** Signed read URLs are valid for one hour (SPEC §6.3). */
export const SIGNED_URL_TTL_MS = 60 * 60 * 1000;
/** Lists are refreshed this long before their URLs expire. */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;
/**
 * After a reload caused by a failed image, another one is allowed only once this
 * much time has passed, so a permanently broken image cannot cause a reload loop.
 */
export const EXPIRED_RELOAD_COOLDOWN_MS = 30 * 1000;

/** Organizer photo (`GET /weddings/:id/photos`); `url` is the web version. */
export type Photo = {
  id: string;
  weddingId: string;
  guestId: string | null;
  senderName: string;
  category: 'memories' | 'wedding';
  message: string;
  status: 'pending' | 'approved' | 'hidden';
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: string;
  url: string | null;
  thumbUrl: string | null;
};

export type PublicGalleryPhoto = {
  id: string;
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  senderName: string;
  message: string;
  category: 'memories' | 'wedding';
  createdAt: string;
};

export type PublicGallery = {
  open: boolean;
  mode: 'now' | 'after_wedding' | 'manual';
  opensAt: string | null;
  /** Approved photos in the category, across all pages. */
  total: number;
  nextCursor: string | null;
  photos: PublicGalleryPhoto[];
};

export class ApiLoadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const jsonOrThrow = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new ApiLoadError(body.message ?? `HTTP ${response.status}`, response.status, body.code);
  return body as T;
};

/** One cursor page of a signed photo list (SPEC §6.3). */
export type SignedPage<T, M = undefined> = { items: T[]; nextCursor: string | null; meta: M };

export type PhotoCounts = { pending: number; approved: number; hidden: number; all: number };

export type PhotoFilters = {
  status?: 'pending' | 'approved' | 'hidden' | 'all';
  category?: 'memories' | 'wedding' | 'all';
  guestId?: string;
  order?: 'asc' | 'desc';
  limit?: number;
};

const query = (params: Record<string, string | number | undefined | null>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const fetchEventPhotos = async (
  eventId: string,
  filters: PhotoFilters = {},
  cursor: string | null = null,
): Promise<SignedPage<Photo, PhotoCounts>> => {
  const body = await jsonOrThrow<{ photos: Photo[]; nextCursor: string | null; counts: PhotoCounts }>(
    await apiFetch(`/api/weddings/${encodeURIComponent(eventId)}/photos${query({ ...filters, cursor })}`),
  );
  return { items: body.photos, nextCursor: body.nextCursor, meta: body.counts };
};

export type GalleryMeta = Omit<PublicGallery, 'photos' | 'nextCursor'>;

const galleryPage = async (path: string): Promise<SignedPage<PublicGalleryPhoto, GalleryMeta>> => {
  const { gallery } = await jsonOrThrow<{ gallery: PublicGallery }>(await apiFetch(path));
  const { photos, nextCursor, ...meta } = gallery;
  return { items: photos, nextCursor, meta };
};

type GalleryFilters = { category?: 'memories' | 'wedding' | 'all'; limit?: number };

export const fetchInvitationGallery = (token: string, filters: GalleryFilters = {}, cursor: string | null = null) =>
  galleryPage(`/api/public/invitations/${encodeURIComponent(token)}/gallery${query({ ...filters, cursor })}`);

export const fetchSlugGallery = (slug: string, filters: GalleryFilters = {}, cursor: string | null = null) =>
  galleryPage(`/api/public/weddings/${encodeURIComponent(slug)}/gallery${query({ ...filters, cursor })}`);

export type SignedPages<T, M> = {
  items: T[];
  /** Metadata of the first page (counts, gallery state). */
  meta: M | null;
  error: Error | null;
  /** The first page is loading. */
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  /** Re-fetches every loaded page, which re-signs all URLs. */
  reload: () => Promise<void>;
  /**
   * Passed to every `<img onError>`: a failed image means its signed URL has
   * probably expired, so the loaded pages are reloaded. Simultaneous failures
   * share one reload, and right after such a reload further failures are ignored
   * for a cooldown so a broken image cannot loop.
   */
  onUrlExpired: () => void;
};

/**
 * Loads a cursor-paginated list whose photo URLs are signed for one hour (SPEC
 * §6.3, §7.3). Pages are added with `loadMore`; the loaded pages are never kept
 * longer than the URL lifetime: they are re-fetched shortly before expiry, when the
 * tab becomes visible again after that point, and when an image fails to load.
 * Changing `key` (for example a filter) starts again from the first page.
 */
export function useSignedPages<T, M>(
  loadPage: (cursor: string | null) => Promise<SignedPage<T, M>>,
  key: string,
  { ttlMs = SIGNED_URL_TTL_MS, marginMs = SIGNED_URL_REFRESH_MARGIN_MS, cooldownMs = EXPIRED_RELOAD_COOLDOWN_MS } = {},
): SignedPages<T, M> {
  // Pages are stored with the key they were loaded for, so a new key shows nothing
  // stale before its first page arrives.
  const [state, setState] = useState<{ key: string; pages: SignedPage<T, M>[] }>({ key, pages: [] });
  const keyRef = useRef(key);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signedAt, setSignedAt] = useState(0);
  const loadRef = useRef(loadPage);
  const pagesRef = useRef<SignedPage<T, M>[]>([]);
  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const expiryReloadAt = useRef(0);
  const generation = useRef(0);

  useEffect(() => {
    loadRef.current = loadPage;
  }, [loadPage]);

  const commit = useCallback((next: SignedPage<T, M>[]) => {
    pagesRef.current = next;
    loadedAt.current = Date.now();
    setSignedAt(loadedAt.current);
    setState({ key: keyRef.current, pages: next });
    setError(null);
  }, []);

  /** Fetches `count` pages from the start (at least one). */
  const fetchFromStart = useCallback(
    (count: number): Promise<void> => {
      if (inFlight.current) return inFlight.current;
      const run = generation.current;
      if (pagesRef.current.length === 0) setLoading(true);
      const task = (async () => {
        try {
          const next: SignedPage<T, M>[] = [];
          let cursor: string | null = null;
          do {
            const page = await loadRef.current(cursor);
            next.push(page);
            cursor = page.nextCursor;
          } while (cursor && next.length < count);
          if (run === generation.current) commit(next);
        } catch (caught) {
          if (run === generation.current) setError(caught instanceof Error ? caught : new Error(String(caught)));
        } finally {
          inFlight.current = null;
          if (run === generation.current) setLoading(false);
        }
      })();
      inFlight.current = task;
      return task;
    },
    [commit],
  );

  const reload = useCallback(() => fetchFromStart(Math.max(pagesRef.current.length, 1)), [fetchFromStart]);

  // First page, and again whenever the key (filters) changes.
  useEffect(() => {
    generation.current += 1;
    keyRef.current = key;
    inFlight.current = null;
    pagesRef.current = [];
    void fetchFromStart(1);
    return () => {
      generation.current += 1;
    };
  }, [key, fetchFromStart]);

  const loadMore = useCallback(async (): Promise<void> => {
    const last = pagesRef.current.at(-1);
    if (!last?.nextCursor || inFlight.current) return;
    const run = generation.current;
    setLoadingMore(true);
    const task = (async () => {
      try {
        const page = await loadRef.current(last.nextCursor);
        if (run !== generation.current) return;
        // Older pages keep their (earlier) signing time: refresh is scheduled from
        // the oldest one.
        pagesRef.current = [...pagesRef.current, page];
        setState({ key: keyRef.current, pages: pagesRef.current });
      } catch (caught) {
        if (run === generation.current) setError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        inFlight.current = null;
        if (run === generation.current) setLoadingMore(false);
      }
    })();
    inFlight.current = task;
    return task;
  }, []);

  const refreshAfter = Math.max(ttlMs - marginMs, 0);

  // Proactive refresh before the oldest loaded page's URLs expire.
  useEffect(() => {
    if (!signedAt) return;
    const timer = window.setTimeout(() => void reload(), Math.max(signedAt + refreshAfter - Date.now(), 0));
    return () => window.clearTimeout(timer);
  }, [signedAt, refreshAfter, reload]);

  // Timers are throttled in background tabs and sleeping phones.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && loadedAt.current && Date.now() - loadedAt.current >= refreshAfter) {
        void reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshAfter, reload]);

  const onUrlExpired = useCallback(() => {
    if (inFlight.current) return;
    if (expiryReloadAt.current && Date.now() - expiryReloadAt.current < cooldownMs) return;
    expiryReloadAt.current = Date.now();
    void reload();
  }, [cooldownMs, reload]);

  const pages = state.key === key ? state.pages : [];
  return {
    items: pages.flatMap((page) => page.items),
    meta: pages[0]?.meta ?? null,
    error,
    loading,
    loadingMore,
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore,
    reload,
    onUrlExpired,
  };
}
