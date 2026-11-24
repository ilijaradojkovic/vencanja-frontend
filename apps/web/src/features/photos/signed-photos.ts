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

export const fetchEventPhotos = async (eventId: string): Promise<Photo[]> =>
  (await jsonOrThrow<{ photos: Photo[] }>(await apiFetch(`/api/weddings/${encodeURIComponent(eventId)}/photos`)))
    .photos;

export const fetchInvitationGallery = async (token: string): Promise<PublicGallery> =>
  (
    await jsonOrThrow<{ gallery: PublicGallery }>(
      await apiFetch(`/api/public/invitations/${encodeURIComponent(token)}/gallery`),
    )
  ).gallery;

export const fetchSlugGallery = async (slug: string): Promise<PublicGallery> =>
  (
    await jsonOrThrow<{ gallery: PublicGallery }>(
      await apiFetch(`/api/public/weddings/${encodeURIComponent(slug)}/gallery`),
    )
  ).gallery;

export type SignedList<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** Reloads the list (and so re-signs every URL). */
  reload: () => Promise<void>;
  /**
   * Passed to every `<img onError>`: a failed image means its signed URL has
   * probably expired, so the list is reloaded. Simultaneous failures share one
   * reload, and right after such a reload further failures are ignored for a
   * cooldown so a broken image cannot loop.
   */
  onUrlExpired: () => void;
};

/**
 * Loads a list whose photo URLs are signed for one hour (SPEC §6.3, §7.3). The
 * list is never kept longer than the URL lifetime: it is reloaded shortly before
 * expiry, when the tab becomes visible again after that point, and when an image
 * fails to load.
 */
export function useSignedList<T>(
  load: () => Promise<T>,
  { ttlMs = SIGNED_URL_TTL_MS, marginMs = SIGNED_URL_REFRESH_MARGIN_MS, cooldownMs = EXPIRED_RELOAD_COOLDOWN_MS } = {},
): SignedList<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const loadedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const expiryReloadAt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const reload = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    const run = (async () => {
      try {
        const next = await loadRef.current();
        if (!mounted.current) return;
        loadedAt.current = Date.now();
        setData(next);
        setError(null);
      } catch (caught) {
        if (mounted.current) setError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        inFlight.current = null;
        if (mounted.current) setLoading(false);
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const refreshAfter = Math.max(ttlMs - marginMs, 0);

  // Proactive refresh before the URLs of the current version expire.
  useEffect(() => {
    if (data === null) return;
    const timer = window.setTimeout(() => void reload(), refreshAfter);
    return () => window.clearTimeout(timer);
  }, [data, refreshAfter, reload]);

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

  return { data, error, loading, reload, onUrlExpired };
}
