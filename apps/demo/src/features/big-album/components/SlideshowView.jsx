import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../../components/Icon';
import { HAND, jitter } from '../utils/polaroid';
import Polaroid from './Polaroid';

const SPEEDS = { 3000: 'fast', 5000: 'normal', 8000: 'slow' };

export default function SlideshowView({ photos, showMessages, dark, fullscreen }) {
  const { t } = useTranslation('bigAlbum');
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(5000);
  const n = photos.length;

  useEffect(() => {
    if (i >= n) setI(0);
  }, [n, i]);

  useEffect(() => {
    if (!playing || n < 2) return undefined;
    const timer = setTimeout(() => setI((x) => (x + 1) % n), speed);
    return () => clearTimeout(timer);
  }, [playing, speed, i, n]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n);
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [n]);

  if (!n) return null;
  const current = photos[i % n];
  const pile = [3, 2, 1].map((k) => photos[(i - k + n * 4) % n]).filter((p) => p && p.id !== current.id);
  const size = fullscreen ? 'min(62vh, 520px)' : 'min(62vw, 440px)';
  const ink = dark ? '#F1E9D8' : '#3B3A44';

  return (
    <div className="stack" style={{ alignItems: 'center', '--gap': '18px', paddingBottom: 10 }}>
      <div style={{ position: 'relative', width: size, margin: '10px auto 0' }}>
        {pile.map((p, k) => (
          <div key={`${p.id}-pile`} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `rotate(${jitter(p.id, 6) * 12}deg) translate(${jitter(p.id, 7) * 18}px, ${jitter(p.id, 8) * 10}px)`, opacity: 0.95 }}>
            <Polaroid photo={p} index={k} width="100%" as="div" tilt={0} className="ba-static" style={{ width: '100%', padding: '5% 5% 0' }} />
          </div>
        ))}
        <div key={current.id} className="ba-drop" style={{ position: 'relative', '--r': `${jitter(current.id, 1) * 4}deg` }}>
          <SlidePolaroid photo={current} showMessage={showMessages} index={i} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', '--gap': '10px', color: ink, position: 'relative', zIndex: 5, marginTop: 8 }}>
        <button className="icon-btn" onClick={() => setI((i - 1 + n) % n)} aria-label={t('common:actions.previous')}><Icon name="chevronLeft" /></button>
        <button className="btn btn-champagne" onClick={() => setPlaying(!playing)} style={{ minWidth: 120 }}>{playing ? t('slideshow.pause') : t('slideshow.play')}</button>
        <button className="icon-btn" onClick={() => setI((i + 1) % n)} aria-label={t('common:actions.next')}><Icon name="chevronRight" /></button>
        <span style={{ fontFamily: HAND, fontSize: 20, minWidth: 80, textAlign: 'center' }} aria-live="polite">{(i % n) + 1} / {n}</span>
        <div className="segmented" role="group" aria-label={t('slideshow.speed')}>
          {Object.entries(SPEEDS).map(([ms, label]) => (
            <button key={ms} type="button" aria-pressed={speed === Number(ms)} onClick={() => setSpeed(Number(ms))}>{t(`slideshow.speeds.${label}`)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlidePolaroid({ photo, showMessage, index }) {
  return (
    <Polaroid photo={photo} index={index} width="100%" as="div" tilt={0} className="ba-static" showMessage={showMessage}
      style={{ width: '100%', padding: '5% 5% 0', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }} />
  );
}
