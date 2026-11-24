'use client';

import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Polaroid } from './Polaroid';
import { HAND, jitter, type AlbumPhoto } from './polaroid';

/** Photos grouped into fanned stacks per guest (UC-47), over the loaded pages. */
export function GuestStacksView({
  photos,
  width,
  dark,
  onOpenGroup,
  onExpired,
}: {
  photos: AlbumPhoto[];
  width: number;
  dark: boolean;
  onOpenGroup: (photos: AlbumPhoto[]) => void;
  onExpired: () => void;
}) {
  const { t } = useTranslation('bigAlbum');
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; photos: AlbumPhoto[] }>();
    for (const photo of photos) {
      const key = photo.guestId || photo.senderName || 'nepoznato';
      if (!map.has(key)) map.set(key, { key, name: photo.senderName || t('guestFallback'), photos: [] });
      map.get(key)?.photos.push(photo);
    }
    return [...map.values()].sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name));
  }, [photos, t]);

  const w = Math.round(width * 0.95);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${w + 70}px, 1fr))`,
        gap: `${Math.round(w * 0.35)}px 24px`,
        padding: '10px 0 20px',
      }}
    >
      {groups.map((group) => {
        const top = group.photos.slice(0, 3);
        const total = group.photos.length;
        return (
          <button
            key={group.key}
            type="button"
            className="ba-stack"
            onClick={() => onOpenGroup(group.photos)}
            aria-label={`${group.name}: ${t('common:count.pictures', { count: total })}`}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'zoom-in',
              justifySelf: 'center',
              width: w + 50,
            }}
          >
            <div style={{ position: 'relative', height: w * 1.28, width: w + 50 }}>
              {[...top].reverse().map((photo, reversed) => {
                const index = top.length - 1 - reversed;
                const fan = ([0, -8, 9][index] ?? 0) + jitter(photo.id, 5) * 3;
                const off = [0, -16, 18][index] ?? 0;
                return (
                  <div
                    key={photo.id}
                    className={`ba-fan ba-fan-${index}`}
                    style={
                      {
                        position: 'absolute',
                        left: 25 + off,
                        top: index * 4,
                        '--fan': `${fan}deg`,
                        '--off': `${off}px`,
                      } as CSSProperties
                    }
                  >
                    <Polaroid
                      photo={photo}
                      index={index}
                      width={w}
                      asDiv
                      tilt={0}
                      className="ba-static"
                      onExpired={onExpired}
                    />
                  </div>
                );
              })}
              {total > 1 ? (
                <span
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: -8,
                    zIndex: 5,
                    minWidth: 34,
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    background: '#C0707A',
                    color: '#fff',
                    fontFamily: HAND,
                    fontWeight: 600,
                    fontSize: 20,
                    boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
                  }}
                >
                  {total}
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontFamily: HAND,
                fontSize: 15,
                marginTop: 4,
                color: dark ? '#E9E0CC' : '#4A3F33',
                opacity: 0.9,
              }}
            >
              {t('common:count.pictures', { count: total })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
