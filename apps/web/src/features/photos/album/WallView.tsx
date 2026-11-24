'use client';

import { Polaroid } from './Polaroid';
import { jitter, type AlbumPhoto } from './polaroid';

/** Overlapping polaroid wall (UC-46); more pages load with the board's "show more". */
export function WallView({
  photos,
  width,
  large,
  showMessages,
  onOpen,
  onExpired,
}: {
  photos: AlbumPhoto[];
  width: number;
  large: boolean;
  showMessages: boolean;
  onOpen: (index: number) => void;
  onExpired: () => void;
}) {
  const cell = Math.round(width * 0.74);
  const overlapY = Math.round(width * (showMessages ? 0.16 : 0.24));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))`,
        columnGap: 0,
        rowGap: 0,
        padding: `0 ${Math.round(width * 0.18)}px ${overlapY}px`,
        alignItems: 'start',
      }}
    >
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: -overlapY,
            position: 'relative',
            zIndex: 1 + Math.round((jitter(photo.id, 4) + 1) * 20),
          }}
        >
          <div style={{ flex: '0 0 auto' }}>
            <Polaroid
              photo={photo}
              index={index}
              width={width}
              large={large}
              showMessage={showMessages}
              onOpen={() => onOpen(index)}
              onExpired={onExpired}
              tilt={9}
              shift={14}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
