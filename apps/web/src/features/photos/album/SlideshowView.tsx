'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';

import { Polaroid } from './Polaroid';
import { HAND, jitter, type AlbumPhoto } from './polaroid';

const SPEEDS = { 3000: 'fast', 5000: 'normal', 8000: 'slow' } as const;

/**
 * Slideshow for a TV (UC-48): the web version (`url`), auto-advance with speed,
 * arrows and space. While more pages exist, the next page is requested before
 * the last loaded slide, so playback continues incrementally.
 */
export function SlideshowView({
  photos,
  showMessages,
  dark,
  fullscreen,
  hasMore,
  onNeedMore,
  onExpired,
}: {
  photos: AlbumPhoto[];
  showMessages: boolean;
  dark: boolean;
  fullscreen: boolean;
  hasMore: boolean;
  onNeedMore: () => void;
  onExpired: () => void;
}) {
  const { t } = useTranslation('bigAlbum');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(5000);
  const count = photos.length;
  const index = count ? position % count : 0;

  useEffect(() => {
    if (hasMore && count && index >= count - 3) onNeedMore();
  }, [hasMore, count, index, onNeedMore]);

  useEffect(() => {
    if (!playing || count < 2) return undefined;
    const timer = window.setTimeout(() => setPosition((value) => (value + 1) % count), speed);
    return () => window.clearTimeout(timer);
  }, [playing, speed, position, count]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      if (event.key === 'ArrowRight') setPosition((value) => (value + 1) % Math.max(count, 1));
      if (event.key === 'ArrowLeft') setPosition((value) => (value - 1 + count) % Math.max(count, 1));
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count]);

  const current = photos[index];
  if (!current) return null;
  const pile = [3, 2, 1]
    .map((back) => photos[(index - back + count * 4) % count])
    .filter((photo): photo is AlbumPhoto => Boolean(photo) && photo?.id !== current.id);
  const size = fullscreen ? 'min(62vh, 520px)' : 'min(62vw, 440px)';
  const ink = dark ? '#F1E9D8' : '#3B3A44';

  return (
    <div className="stack" style={{ alignItems: 'center', '--gap': '18px', paddingBottom: 10 } as CSSProperties}>
      <div style={{ position: 'relative', width: size, margin: '10px auto 0' }}>
        {pile.map((photo, back) => (
          <div
            key={`${photo.id}-pile`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `rotate(${jitter(photo.id, 6) * 12}deg) translate(${jitter(photo.id, 7) * 18}px, ${jitter(photo.id, 8) * 10}px)`,
              opacity: 0.95,
            }}
          >
            <Polaroid
              photo={photo}
              index={back}
              width="100%"
              asDiv
              tilt={0}
              className="ba-static"
              onExpired={onExpired}
              style={{ width: '100%', padding: '5% 5% 0' }}
            />
          </div>
        ))}
        <div
          key={current.id}
          className="ba-drop"
          data-testid="slide"
          style={{ position: 'relative', '--r': `${jitter(current.id, 1) * 4}deg` } as CSSProperties}
        >
          <Polaroid
            photo={current}
            index={index}
            width="100%"
            asDiv
            large
            tilt={0}
            className="ba-static"
            showMessage={showMessages}
            onExpired={onExpired}
            style={{ width: '100%', padding: '5% 5% 0', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
          />
        </div>
      </div>

      <div
        className="row"
        style={
          {
            justifyContent: 'center',
            '--gap': '10px',
            color: ink,
            position: 'relative',
            zIndex: 5,
            marginTop: 8,
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPosition((index - 1 + count) % count)}
          aria-label={t('common:actions.previous')}
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          type="button"
          className="btn btn-champagne"
          onClick={() => setPlaying(!playing)}
          style={{ minWidth: 120 }}
        >
          {playing ? t('slideshow.pause') : t('slideshow.play')}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPosition((index + 1) % count)}
          aria-label={t('common:actions.next')}
        >
          <Icon name="chevronRight" />
        </button>
        <span style={{ fontFamily: HAND, fontSize: 20, minWidth: 80, textAlign: 'center' }} aria-live="polite">
          {index + 1} / {count}
          {hasMore ? '+' : ''}
        </span>
        <div className="segmented" role="group" aria-label={t('slideshow.speed')}>
          {Object.entries(SPEEDS).map(([ms, label]) => (
            <button key={ms} type="button" aria-pressed={speed === Number(ms)} onClick={() => setSpeed(Number(ms))}>
              {t(`slideshow.speeds.${label}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
