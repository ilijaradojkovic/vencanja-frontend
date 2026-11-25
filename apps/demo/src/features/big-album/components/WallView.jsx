import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { jitter } from '../utils/polaroid';
import Polaroid from './Polaroid';

const STEP = 60;

export default function WallView({ photos, width, showMessages, onOpen }) {
  const { t } = useTranslation('bigAlbum');
  const [limit, setLimit] = useState(STEP);
  const cell = Math.round(width * 0.74);
  const overlapY = Math.round(width * (showMessages ? 0.16 : 0.24));
  const shown = photos.slice(0, limit);

  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))`, columnGap: 0,
        rowGap: 0, padding: `0 ${Math.round(width * 0.18)}px ${overlapY}px`, alignItems: 'start',
      }}>
        {shown.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'center', marginBottom: -overlapY, position: 'relative',
            zIndex: 1 + Math.round((jitter(p.id, 4) + 1) * 20) }}>
            <div style={{ flex: '0 0 auto' }}>
              <Polaroid photo={p} index={i} width={width} showMessage={showMessages} onOpen={() => onOpen(i)} tilt={9} shift={14} />
            </div>
          </div>
        ))}
      </div>
      {photos.length > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: overlapY + 24, position: 'relative', zIndex: 200 }}>
          <button className="btn btn-champagne" onClick={() => setLimit(limit + STEP)}>
            {t('showMore', { count: Math.min(STEP, photos.length - limit), rest: photos.length - limit })}
          </button>
        </div>
      )}
    </>
  );
}
