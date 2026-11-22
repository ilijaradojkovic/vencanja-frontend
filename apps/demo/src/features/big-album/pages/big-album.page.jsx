import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectApprovedPhotos, selectPhotoCounts } from '../../photos/store/photos.store';
import { fetchRequests } from '../../requests/services/requests.service';
import { Lightbox } from '../../../components/ui';
import Icon from '../../../components/Icon';
import { formatDate, REQUEST_STATUS } from '../../../utils/format';
import { HAND } from '../utils/polaroid';
import BigAlbumRequestModal from '../components/BigAlbumRequestModal';
import WallView from '../components/WallView';
import GuestStacksView from '../components/GuestStacksView';
import SlideshowView from '../components/SlideshowView';
import { eventNames } from '../../../utils/event';

const BACKGROUNDS = {
  lan: {
    label: 'linen',
    css: `repeating-linear-gradient(0deg, rgba(120,100,70,0.04) 0 1px, transparent 1px 4px),
      repeating-linear-gradient(90deg, rgba(120,100,70,0.04) 0 1px, transparent 1px 4px),
      radial-gradient(ellipse at 30% 10%, #F7F1E6, #E6DCC8)`,
  },
  pluta: {
    label: 'cork',
    css: `radial-gradient(rgba(90,55,25,0.28) 1px, transparent 1.6px) 0 0 / 7px 7px,
      radial-gradient(rgba(255,235,200,0.22) 1px, transparent 1.6px) 3px 4px / 9px 9px,
      radial-gradient(ellipse at 50% 0%, #D2A877, #B98A58)`,
  },
  drvo: {
    label: 'wood',
    css: `repeating-linear-gradient(90deg, rgba(60,35,15,0.22) 0 2px, transparent 2px 220px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px, rgba(0,0,0,0.04) 13px 14px, transparent 14px 31px),
      linear-gradient(180deg, #B98C62, #A87A50)`,
  },
  noc: {
    label: 'night',
    css: `radial-gradient(circle, rgba(255,214,140,0.55) 0 2px, transparent 3px) 0 0 / 140px 90px,
      radial-gradient(circle, rgba(255,214,140,0.3) 0 1.5px, transparent 2.5px) 70px 45px / 140px 90px,
      radial-gradient(ellipse at 50% 0%, #2C3532, #161B19)`,
    dark: true,
  },
};
const SIZES = { S: 140, M: 185, L: 240 };
const FILTERS = ['all', 'memories', 'wedding'];
const VIEWS = ['zid', 'gosti', 'prezentacija'];

function usePref(key, initial) {
  const [v, setV] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`veliki-album:${key}`)) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((x) => {
    setV(x);
    try {
      localStorage.setItem(`veliki-album:${key}`, JSON.stringify(x));
    } catch {
    }
  }, [key]);
  return [v, set];
}

export default function BigAlbumPage() {
  const { t } = useTranslation('bigAlbum');
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const approved = useAppSelector(selectApprovedPhotos);
  const pending = useAppSelector(selectPhotoCounts).pending;
  const requests = useAppSelector((s) => s.requests);

  const [filter, setFilter] = usePref('filter', 'all');
  const [bg, setBg] = usePref('bg', 'lan');
  const [size, setSize] = usePref('size', 'M');
  const [showMessages, setShowMessages] = usePref('messages', true);
  const [view, setView] = usePref('view', 'zid');
  const [box, setBox] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    if (requests.status === 'idle') dispatch(fetchRequests());
  }, [dispatch, requests.status]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const photos = useMemo(
    () => approved
      .filter((p) => filter === 'all' || p.category === filter)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [approved, filter],
  );
  const guestsCount = useMemo(() => new Set(photos.map((p) => p.guestId || p.senderName)).size, [photos]);
  const activeRequest = requests.items.find((r) => r.type === 'big_album' && r.status !== 'done');
  const background = BACKGROUNDS[bg] || BACKGROUNDS.lan;
  const width = SIZES[size] || SIZES.M;
  const closeLightbox = useCallback(() => setBox(null), []);
  const setBoxIndex = useCallback((index) => setBox((b) => (b ? { ...b, index } : b)), []);
  const closeRequest = useCallback(() => setRequestOpen(false), []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else boardRef.current?.requestFullscreen?.();
  };

  const seg = (value, current, set, label) => (
    <button key={value} type="button" aria-pressed={current === value} onClick={() => set(value)}>{label}</button>
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

      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('eyebrow', { count: approved.length })}</p>
          <h1>{t('common:nav.bigAlbum')}</h1>
        </div>
        <div className="row">
          <button className="btn btn-soft" onClick={toggleFullscreen} disabled={!photos.length}>
            <Icon name="eye" size={18} /> {t('showOnScreen')}
          </button>
          <button className="btn btn-primary" onClick={() => setRequestOpen(true)} disabled={!approved.length}>
            <Icon name="sparkle" size={18} /> {t('doItForUs')}
          </button>
        </div>
      </div>

      {(pending > 0 || activeRequest) && (
        <div className="stack" style={{ '--gap': '8px', marginBottom: 14 }}>
          {pending > 0 && (
            <div className="row" style={{ '--gap': '10px', padding: '10px 14px', borderRadius: 12, background: '#FFF7E6', border: '1px solid #F0DDB0' }}>
              <Icon name="image" size={18} />
              <span className="small grow">{t('pendingBanner', { count: pending })}</span>
              <Link to="/app/fotografije" className="btn btn-ghost btn-sm">{t('review')}</Link>
            </div>
          )}
          {activeRequest && (
            <div className="row" style={{ '--gap': '10px', padding: '10px 14px', borderRadius: 12, background: 'var(--bg)' }}>
              <Icon name="sparkle" size={18} />
              <span className="small grow">{t('activeRequest', { style: activeRequest.style })} <strong style={{ fontWeight: 500 }}>{REQUEST_STATUS[activeRequest.status] || activeRequest.status}</strong></span>
              <Link to="/app/custom-dizajn" className="btn btn-ghost btn-sm">{t('common:actions.details')}</Link>
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ '--gap': '14px', flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div className="segmented" role="group" aria-label={t('viewAria')}>
          {VIEWS.map((k) => seg(k, view, setView, t(`views.${k}`)))}
        </div>
        <div className="segmented" role="group" aria-label={t('filterAria')}>
          {FILTERS.map((k) => seg(k, filter, setFilter, t(`filters.${k}`)))}
        </div>
        <div className="segmented" role="group" aria-label={t('backgroundAria')}>
          {Object.entries(BACKGROUNDS).map(([k, v]) => seg(k, bg, setBg, t(`backgrounds.${v.label}`)))}
        </div>
        {view !== 'prezentacija' && (
          <div className="segmented" role="group" aria-label={t('sizeAria')}>
            {Object.keys(SIZES).map((k) => seg(k, size, setSize, k))}
          </div>
        )}
        {view !== 'gosti' && (
          <label className="check" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={showMessages} onChange={(e) => setShowMessages(e.target.checked)} /> {t('guestMessages')}
          </label>
        )}
      </div>

      <div ref={boardRef} style={{
        background: background.css, borderRadius: fullscreen ? 0 : 18, padding: 'clamp(20px, 4vw, 56px)',
        minHeight: fullscreen ? '100vh' : 520, overflowX: 'hidden', overflowY: fullscreen ? 'auto' : 'visible', boxShadow: fullscreen ? 'none' : 'inset 0 0 60px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(24px, 4vw, 44px)' }}>
          <div style={{ position: 'relative', background: '#FFFBEA', padding: '18px 34px 16px', textAlign: 'center', transform: 'rotate(-1.5deg)',
            boxShadow: '0 6px 16px rgba(40,30,20,0.25)', fontFamily: HAND, color: '#3B3A44',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 27px, rgba(120,150,200,0.25) 27px 28px)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: '#C0707A', boxShadow: 'inset -3px -3px 0 rgba(0,0,0,0.2)' }} />
            <div style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 600, lineHeight: 1 }}>{eventNames(wedding)}</div>
            <div style={{ fontSize: 20, marginTop: 4 }}>{formatDate(wedding.date)}</div>
            {photos.length > 0 && <div style={{ fontSize: 18, opacity: 0.75 }}>{t('boardCount', { photos: photos.length, guests: guestsCount })}</div>}
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '40px 0 60px', color: background.dark ? '#F1E9D8' : 'var(--ink)' }}>
            <Icon name="image" size={36} />
            <strong style={{ fontWeight: 500 }}>{filter !== 'all' ? t('emptyCategory') : t('empty')}</strong>
            <span className="small" style={{ opacity: 0.8 }}>{t('emptyHint')}</span>
          </div>
        ) : (
          <>
            {view === 'zid' && <WallView photos={photos} width={width} showMessages={showMessages} onOpen={(index) => setBox({ list: photos, index })} />}
            {view === 'gosti' && <GuestStacksView photos={photos} width={width} dark={background.dark} onOpenGroup={(list) => setBox({ list, index: 0 })} />}
            {view === 'prezentacija' && <SlideshowView photos={photos} showMessages={showMessages} dark={background.dark} fullscreen={fullscreen} />}
          </>
        )}

        {box && <Lightbox photos={box.list} index={box.index} onClose={closeLightbox} onIndex={setBoxIndex} />}
        {fullscreen && (
          <button className="btn btn-sm" onClick={toggleFullscreen} style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, background: 'rgba(255,255,255,0.9)' }}>
            <Icon name="x" size={16} /> {t('common:actions.close')}
          </button>
        )}
      </div>

      {requestOpen && (
        <BigAlbumRequestModal photoCount={photos.length} background={t(`backgrounds.${background.label}`).toLowerCase()} scopeLabel={t(`filters.${filter}`).toLowerCase()}
          showMessages={showMessages} onClose={closeRequest} />
      )}
    </>
  );
}
