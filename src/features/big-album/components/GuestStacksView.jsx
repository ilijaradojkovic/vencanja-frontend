import { useMemo } from 'react';
import { HAND, jitter } from '../utils/polaroid';
import { plural } from '../../../utils/format';
import Polaroid from './Polaroid';

/**
 * Po gostima: svaki gost je jedna lepeza od do 3 polaroida (prva slika na vrhu) sa imenom i brojem slika.
 * 100 slika od 25 gostiju = 25 urednih gomilica. Klik otvara samo slike tog gosta.
 */
export default function GuestStacksView({ photos, width, onOpenGroup, dark }) {
  const groups = useMemo(() => {
    const m = new Map();
    photos.forEach((p) => {
      const key = p.guestId || p.senderName || 'nepoznato';
      if (!m.has(key)) m.set(key, { key, name: p.senderName || 'Gost', photos: [] });
      m.get(key).photos.push(p);
    });
    return [...m.values()].sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name));
  }, [photos]);

  const w = Math.round(width * 0.95);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${w + 70}px, 1fr))`, gap: `${Math.round(w * 0.35)}px 24px`, padding: '10px 0 20px' }}>
      {groups.map((g) => {
        const top = g.photos.slice(0, 3);
        const more = g.photos.length;
        return (
          <button key={g.key} type="button" className="ba-stack" onClick={() => onOpenGroup(g.photos)}
            aria-label={`${g.name}: ${more} ${plural(more, 'slika', 'slike', 'slika')}`}
            style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', justifySelf: 'center', width: w + 50 }}>
            <div style={{ position: 'relative', height: w * 1.28, width: w + 50 }}>
              {/* donje kartice lepeze idu prve u DOM-u */}
              {[...top].reverse().map((p, ri) => {
                const i = top.length - 1 - ri; // 0 = gornja
                const fan = [0, -8, 9][i] + jitter(p.id, 5) * 3;
                const off = [0, -16, 18][i];
                return (
                  <div key={p.id} className={`ba-fan ba-fan-${i}`} style={{ position: 'absolute', left: 25 + off, top: i * 4, '--fan': `${fan}deg`, '--off': `${off}px` }}>
                    <Polaroid photo={p} index={i} width={w} as="div" tilt={0} className="ba-static" />
                  </div>
                );
              })}
              {more > 1 && (
                <span style={{ position: 'absolute', right: 6, top: -8, zIndex: 5, minWidth: 34, height: 34, padding: '0 8px', borderRadius: 999, display: 'grid', placeItems: 'center',
                  background: '#C0707A', color: '#fff', fontFamily: HAND, fontWeight: 600, fontSize: 20, boxShadow: '0 3px 8px rgba(0,0,0,0.25)' }}>
                  {more}
                </span>
              )}
            </div>
            <div style={{ fontFamily: HAND, fontSize: 15, marginTop: 4, color: dark ? '#E9E0CC' : '#4A3F33', opacity: 0.9 }}>
              {more} {plural(more, 'slika', 'slike', 'slika')}
            </div>
          </button>
        );
      })}
    </div>
  );
}
