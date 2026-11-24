'use client';

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { HAND, jitter, type AlbumPhoto } from './polaroid';

export const TAPES = [
  'rgba(240,214,160,0.8)',
  'rgba(186,220,205,0.8)',
  'rgba(240,190,196,0.8)',
  'rgba(200,200,235,0.8)',
];

/**
 * One polaroid (UC-46 – UC-49). Sizes S/M use `thumbUrl`; L and the slideshow
 * pass `large` and use the web version `url` (SPEC §7.3).
 */
export function Polaroid({
  photo,
  index = 0,
  width,
  showMessage = false,
  onOpen,
  onExpired,
  large = false,
  tilt = 6,
  shift = 0,
  className = 'ba-polaroid',
  style,
  asDiv = false,
}: {
  photo: AlbumPhoto;
  index?: number;
  width: number | string;
  showMessage?: boolean;
  onOpen?: () => void;
  onExpired: () => void;
  large?: boolean;
  tilt?: number;
  shift?: number;
  className?: string;
  style?: CSSProperties;
  asDiv?: boolean;
}) {
  const { t } = useTranslation('common');
  const src = large ? (photo.url ?? photo.thumbUrl) : (photo.thumbUrl ?? photo.url);
  const rotation = jitter(photo.id, 1) * tilt;
  const dx = jitter(photo.id, 2) * shift;
  const dy = jitter(photo.id, 3) * shift * 0.8;
  const frameStyle = {
    '--r': `${rotation}deg`,
    '--dx': `${dx}px`,
    '--dy': `${dy}px`,
    width,
    containerType: 'inline-size',
    position: 'relative',
    display: 'block',
    padding: 0,
    border: 'none',
    background: 'transparent',
    textAlign: 'center',
    cursor: onOpen ? 'zoom-in' : 'default',
    ...style,
  } as CSSProperties;

  const content = (
    <span style={{ display: 'block', position: 'relative', background: '#FFFFFF', padding: '5cqw 5cqw 0' }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-4.5cqw',
          left: '50%',
          width: '38%',
          height: 'max(10px, 9cqw)',
          transform: `translateX(-50%) rotate(${jitter(photo.id, 9) * 7}deg)`,
          background: TAPES[index % TAPES.length],
          boxShadow: '0 0 1px rgba(0,0,0,0.12)',
        }}
      />
      <span style={{ display: 'block', aspectRatio: '1', overflow: 'hidden', background: '#E9E4DA' }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URLs change hourly (SPEC §7.3)
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            onError={onExpired}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: 'saturate(0.94) contrast(1.03)',
            }}
          />
        ) : null}
      </span>
      <span
        style={{ display: 'block', padding: '4cqw 4px 7cqw', fontFamily: HAND, color: '#3B3A44', lineHeight: 1.05 }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'max(13px, 11cqw)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {photo.senderName}
        </span>
        {showMessage && photo.message ? (
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: 'max(12px, 8.5cqw)',
              marginTop: 2,
              opacity: 0.85,
            }}
          >
            {photo.message}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (onOpen && !asDiv) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={className}
        aria-label={t('lightbox.photoFrom', { name: photo.senderName })}
        style={frameStyle}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} style={frameStyle}>
      {content}
    </div>
  );
}
