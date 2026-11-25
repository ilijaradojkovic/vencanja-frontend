'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { FormError } from '@/components/auth/AuthShell';
import { formatDate } from '@/lib/format';

import { Lightbox } from '../Lightbox';
import { fetchEventPhotos, useSignedPages } from '../signed-photos';
import { GuestStacksView } from './GuestStacksView';
import { HAND, type AlbumPhoto } from './polaroid';
import { SlideshowView } from './SlideshowView';
import { WallView } from './WallView';

const BACKGROUNDS = {
  lan: {
    label: 'linen',
    css: `repeating-linear-gradient(0deg, rgba(120,100,70,0.04) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(120,100,70,0.04) 0 1px, transparent 1px 4px),
      radial-gradient(ellipse at 30% 10%, #F7F1E6, #E6DCC8)`,
    dark: false,
  },
  pluta: {
    label: 'cork',
    css: `radial-gradient(rgba(90,55,25,0.28) 1px, transparent 1.6px) 0 0 / 7px 7px,
      radial-gradient(rgba(255,235,200,0.22) 1px, transparent 1.6px) 3px 4px / 9px 9px,
      radial-gradient(ellipse at 50% 0%, #D2A877, #B98A58)`,
    dark: false,
  },
  drvo: {
    label: 'wood',
    css: `repeating-linear-gradient(90deg, rgba(60,35,15,0.22) 0 2px, transparent 2px 220px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px, rgba(0,0,0,0.04) 13px 14px, transparent 14px 31px),
      linear-gradient(180deg, #B98C62, #A87A50)`,
    dark: false,
  },
  noc: {
    label: 'night',
    css: `radial-gradient(circle, rgba(255,214,140,0.55) 0 2px, transparent 3px) 0 0 / 140px 90px,
      radial-gradient(circle, rgba(255,214,140,0.3) 0 1.5px, transparent 2.5px) 70px 45px / 140px 90px,
      radial-gradient(ellipse at 50% 0%, #2C3532, #161B19)`,
    dark: true,
  },
} as const;
const SIZES = { S: 140, M: 185, L: 240 } as const;
const FILTERS = ['all', 'memories', 'wedding'] as const;
const VIEWS = ['zid', 'gosti', 'prezentacija'] as const;
/** Matches the prototype's wall step; the API caps a page at 100. */
const PAGE_SIZE = 60;

/** Per-viewer display preference (localStorage is only a convenience). */
function usePref<T extends string | boolean>(key: string, initial: T, allowed?: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(`veliki-album:${key}`) ?? 'null') as T | null;
      if (stored === null || (allowed && !allowed.includes(stored)) || typeof stored !== typeof initial) return initial;
      return stored;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(`veliki-album:${key}`, JSON.stringify(next));
      } catch {
        // Storage can be unavailable (private mode); the choice then lasts for the page.
      }
    },
    [key],
  );
  return [value, set];
}

const subscribeNothing = () => () => {};

export type AlbumEvent = { id: string; names: string; date: string };

/**
 * Big album (UC-46 – UC-49): approved photos as a polaroid wall, per-guest
 * stacks or a slideshow, oldest first. Pages load incrementally ("show more",
 * slideshow prefetch); S/M polaroids use `thumbUrl`, L, the lightbox and the
 * slideshow use `url`. Rendered only on the client because display preferences
 * come from localStorage.
 */
export function BigAlbumPage({ event }: { event: AlbumEvent }) {
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return hydrated ? <Board event={event} /> : null;
}

function Board({ event }: { event: AlbumEvent }) {
  const { t, i18n } = useTranslation('bigAlbum');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const [filter, setFilter] = usePref<(typeof FILTERS)[number]>('filter', 'all', FILTERS);
  const [bg, setBg] = usePref<keyof typeof BACKGROUNDS>(
    'bg',
    'lan',
    Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[],
  );
  const [size, setSize] = usePref<keyof typeof SIZES>('size', 'M', Object.keys(SIZES) as (keyof typeof SIZES)[]);
  const [showMessages, setShowMessages] = usePref<boolean>('messages', true);
  const [view, setView] = usePref<(typeof VIEWS)[number]>('view', 'zid', VIEWS);
  const [box, setBox] = useState<{ list: AlbumPhoto[]; index: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    (cursor: string | null) =>
      fetchEventPhotos(event.id, { status: 'approved', order: 'asc', category: filter, limit: PAGE_SIZE }, cursor),
    [event.id, filter],
  );
  const list = useSignedPages(loadPage, filter);
  const photos = list.items;
  const counts = list.meta;
  const loadMore = list.loadMore;
  const needMore = useCallback(() => void loadMore(), [loadMore]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const guestsCount = new Set(photos.map((photo) => photo.guestId || photo.senderName)).size;
  const background = BACKGROUNDS[bg] ?? BACKGROUNDS.lan;
  const width = SIZES[size] ?? SIZES.M;
  const approvedTotal = counts?.approved ?? 0;
  const rest = Math.max(approvedTotal - photos.length, 0);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void boardRef.current?.requestFullscreen?.();
  };

  const segment = <T extends string>(value: T, current: T, set: (value: T) => void, label: string) => (
    <button key={value} type="button" aria-pressed={current === value} onClick={() => set(value)}>
      {label}
    </button>
  );

  return (
    <>
      <style>{`
        .ba-polaroid { transform: translate(var(--dx), var(--dy)) rotate(var(--r)); box-shadow: 0 6px 16px rgba(40,30,20,0.28), 0 1px 3px rgba(40,30,20,0.2);
          transition: transform .18s ease, box-shadow .18s ease; }
        .ba-polaroid:hover, .ba-polaroid:focus-visible { transform: translate(var(--dx), var(--dy)) rotate(0deg) scale(1.07); z-index: 100 !important;
          box-shadow: 0 16px 34px rgba(40,30,20,0.35); outline: none; }
        .ba-polaroid:focus-visible { box-shadow: 0 0 0 3px var(--green), 0 16px 34px rgba(40,30,20,0.35); }
        .ba-static { box-shadow: 0 6px 16px rgba(40,30,20,0.28), 0 1px 3px rgba(40,30,20,0.2); }
        .ba-fan { transform: rotate(var(--fan)); transition: transform .2s ease; }
        .ba-stack:hover .ba-fan-1, .ba-stack:focus-visible .ba-fan-1 { transform: rotate(calc(var(--fan) * 2)) translateX(calc(var(--off) * 1.6)); }
        .ba-stack:hover .ba-fan-2, .ba-stack:focus-visible .ba-fan-2 { transform: rotate(calc(var(--fan) * 2)) translateX(calc(var(--off) * 1.6)); }
        .ba-stack:hover .ba-fan-0, .ba-stack:focus-visible .ba-fan-0 { transform: translateY(-6px) scale(1.03); }
        .ba-stack:focus-visible { outline: 3px solid var(--green); outline-offset: 6px; border-radius: 8px; }
        .ba-drop { transform: rotate(var(--r)); animation: ba-drop .55s cubic-bezier(.2,.8,.25,1.1); }
        @keyframes ba-drop { from { opacity: 0; transform: translateY(-40px) scale(1.12) rotate(calc(var(--r) - 8deg)); } }
        @media (prefers-reduced-motion: reduce) { .ba-polaroid, .ba-fan { transition: none; } .ba-drop { animation: none; } }
      `}</style>

      <div className="page-head row between">
        <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
          <p className="eyebrow">{t('eyebrow', { count: approvedTotal })}</p>
          <h1>{t('common:nav.bigAlbum')}</h1>
        </div>
        <button type="button" className="btn btn-soft" onClick={toggleFullscreen} disabled={!photos.length}>
          <Icon name="eye" size={18} /> {t('showOnScreen')}
        </button>
      </div>

      {counts && counts.pending > 0 ? (
        <div
          className="row"
          style={
            {
              '--gap': '10px',
              padding: '10px 14px',
              borderRadius: 12,
              background: '#FFF7E6',
              border: '1px solid #F0DDB0',
              marginBottom: 14,
            } as CSSProperties
          }
        >
          <Icon name="image" size={18} />
          <span className="small grow">{t('pendingBanner', { count: counts.pending })}</span>
          <Link href="/app/fotografije" className="btn btn-ghost btn-sm">
            {t('review')}
          </Link>
        </div>
      ) : null}

      <div
        className="row"
        style={{ '--gap': '14px', flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' } as CSSProperties}
      >
        <div className="segmented" role="group" aria-label={t('viewAria')}>
          {VIEWS.map((key) => segment(key, view, setView, t(`views.${key}`)))}
        </div>
        <div className="segmented" role="group" aria-label={t('filterAria')}>
          {FILTERS.map((key) => segment(key, filter, setFilter, t(`filters.${key}`)))}
        </div>
        <div className="segmented" role="group" aria-label={t('backgroundAria')}>
          {(Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[]).map((key) =>
            segment(key, bg, setBg, t(`backgrounds.${BACKGROUNDS[key].label}`)),
          )}
        </div>
        {view !== 'prezentacija' ? (
          <div className="segmented" role="group" aria-label={t('sizeAria')}>
            {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((key) => segment(key, size, setSize, key))}
          </div>
        ) : null}
        {view !== 'gosti' ? (
          <label className="check" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={showMessages} onChange={(e) => setShowMessages(e.target.checked)} />{' '}
            {t('guestMessages')}
          </label>
        ) : null}
      </div>

      {list.error ? <FormError>{list.error.message}</FormError> : null}

      <div
        ref={boardRef}
        data-testid="album-board"
        style={{
          background: background.css,
          borderRadius: fullscreen ? 0 : 18,
          padding: 'clamp(20px, 4vw, 56px)',
          minHeight: fullscreen ? '100vh' : 520,
          overflowX: 'hidden',
          overflowY: fullscreen ? 'auto' : 'visible',
          boxShadow: fullscreen ? 'none' : 'inset 0 0 60px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(24px, 4vw, 44px)' }}>
          <div
            style={{
              position: 'relative',
              background: '#FFFBEA',
              padding: '18px 34px 16px',
              textAlign: 'center',
              transform: 'rotate(-1.5deg)',
              boxShadow: '0 6px 16px rgba(40,30,20,0.25)',
              fontFamily: HAND,
              color: '#3B3A44',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 27px, rgba(120,150,200,0.25) 27px 28px)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -9,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#C0707A',
                boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.2)',
              }}
            />
            <div style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 600, lineHeight: 1 }}>{event.names}</div>
            <div style={{ fontSize: 20, marginTop: 4 }}>{formatDate(event.date, locale)}</div>
            {photos.length > 0 ? (
              <div style={{ fontSize: 18, opacity: 0.75 }}>
                {t('boardCount', { photos: filter === 'all' ? approvedTotal : photos.length, guests: guestsCount })}
              </div>
            ) : null}
          </div>
        </div>

        {list.loading && photos.length === 0 ? (
          <p className="small" style={{ textAlign: 'center' }}>
            {t('common:actions.loading')}
          </p>
        ) : photos.length === 0 ? (
          <div
            className="stack"
            style={{
              alignItems: 'center',
              textAlign: 'center',
              padding: '40px 0 60px',
              color: background.dark ? '#F1E9D8' : 'var(--ink)',
            }}
          >
            <Icon name="image" size={36} />
            <strong style={{ fontWeight: 500 }}>{filter !== 'all' ? t('emptyCategory') : t('empty')}</strong>
            <span className="small" style={{ opacity: 0.8 }}>
              {t('emptyHint')}
            </span>
          </div>
        ) : (
          <>
            {view === 'zid' ? (
              <WallView
                photos={photos}
                width={width}
                large={size === 'L'}
                showMessages={showMessages}
                onOpen={(index) => setBox({ list: photos, index })}
                onExpired={list.onUrlExpired}
              />
            ) : null}
            {view === 'gosti' ? (
              <GuestStacksView
                photos={photos}
                width={width}
                dark={background.dark}
                onOpenGroup={(group) => setBox({ list: group, index: 0 })}
                onExpired={list.onUrlExpired}
              />
            ) : null}
            {view === 'prezentacija' ? (
              <SlideshowView
                photos={photos}
                showMessages={showMessages}
                dark={background.dark}
                fullscreen={fullscreen}
                hasMore={list.hasMore}
                onNeedMore={needMore}
                onExpired={list.onUrlExpired}
              />
            ) : null}
            {view !== 'prezentacija' && list.hasMore ? (
              <div
                style={{ display: 'flex', justifyContent: 'center', marginTop: 48, position: 'relative', zIndex: 200 }}
              >
                <button type="button" className="btn btn-champagne" disabled={list.loadingMore} onClick={needMore}>
                  {filter === 'all' && rest > 0
                    ? t('showMore', { count: Math.min(PAGE_SIZE, rest), rest })
                    : t('photos:loadMore')}
                </button>
              </div>
            ) : null}
          </>
        )}

        {box ? (
          <Lightbox
            photos={box.list}
            index={box.index}
            onClose={() => setBox(null)}
            onIndex={(index) => setBox((current) => (current ? { ...current, index } : current))}
            onExpired={list.onUrlExpired}
          />
        ) : null}
        {fullscreen ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={toggleFullscreen}
            style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, background: 'rgba(255,255,255,0.9)' }}
          >
            <Icon name="x" size={16} /> {t('common:actions.close')}
          </button>
        ) : null}
      </div>
    </>
  );
}
