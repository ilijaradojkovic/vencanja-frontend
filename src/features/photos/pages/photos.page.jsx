import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { bulkPhotoStatus, deletePhoto, fetchPhotos, setPhotoStatus } from '../services/photos.service';
import { photosSelectors, selectPhotoCounts } from '../store/photos.store';
import { toast } from 'react-toastify';
import Icon from '../../../components/Icon';
import { ConfirmModal, Lightbox, PageLoading, PhotoStatusBadge, Spinner } from '../../../components/ui';
import { CATEGORIES, formatDateTime } from '../../../utils/format';
import Pagination from '../../../components/Pagination';
import { usePagination } from '../../../utils/usePagination';

const TABS = ['pending', 'approved', 'hidden', 'all'];

export default function Photos() {
  const { t } = useTranslation('photos');
  const dispatch = useAppDispatch();
  const all = useAppSelector(photosSelectors.selectAll);
  const counts = useAppSelector(selectPhotoCounts);
  const status = useAppSelector((s) => s.photos.status);
  const [tab, setTab] = useState('pending');
  const [cat, setCat] = useState('all');
  const [selected, setSelected] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const visible = all.filter((p) => (tab === 'all' || p.status === tab) && (cat === 'all' || p.category === cat));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = visible.length > 0 && visible.every((p) => selected.includes(p.id));
  const pager = usePagination(visible, { storageKey: 'fotografije', defaultSize: 10, resetKey: `${tab}|${cat}` });

  const bulk = async (st) => {
    setBusy(true);
    const res = await dispatch(bulkPhotoStatus({ ids: selected, status: st }));
    setBusy(false);
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t(st === 'approved' ? 'approvedToast' : 'hiddenToast', { count: selected.length }));
      setSelected([]);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    const res = await dispatch(deletePhoto(toDelete.id));
    setBusy(false);
    if (res.meta.requestStatus === 'fulfilled') {
      setToDelete(null);
      setLightbox(null);
      toast.success(t('deletedToast'));
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('eyebrow', { count: counts.all })}</p>
          <h1>{t('common:nav.photos')}</h1>
        </div>
        <button className="btn btn-outline" onClick={() => dispatch(fetchPhotos())} disabled={status === 'loading'}>
          {status === 'loading' ? <Spinner /> : t('common:actions.refresh')}
        </button>
      </div>

      <section className="card stack">
        <div className="row between">
          <div className="chips" role="group" aria-label={t('statusAria')}>
            {TABS.map((k) => (
              <button key={k} className="chip" aria-pressed={tab === k} onClick={() => { setTab(k); setSelected([]); }}>
                {t(`tabs.${k}`)} <span className="count">{counts[k]}</span>
              </button>
            ))}
          </div>
          <select className="select" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('categoryAria')}>
            <option value="all">{t('allCategories')}</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {visible.length > 0 && (
          <div className="row between" style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--bg)' }}>
            <label className="check" style={{ minHeight: 0, padding: 0 }}>
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visible.map((p) => p.id))} />
              {selected.length ? t('selected', { count: selected.length }) : t('selectAll', { count: visible.length })}
            </label>
            <div className="row" style={{ '--gap': '8px' }}>
              <button className="btn btn-primary btn-sm" disabled={!selected.length || busy} onClick={() => bulk('approved')}><Icon name="check" size={16} /> {t('approve')}</button>
              <button className="btn btn-soft btn-sm" disabled={!selected.length || busy} onClick={() => bulk('hidden')}><Icon name="eyeOff" size={16} /> {t('hide')}</button>
            </div>
          </div>
        )}

        {status === 'loading' && !all.length ? <PageLoading /> : visible.length === 0 ? (
          <div className="empty">
            <strong>{tab === 'pending' ? t('allReviewed') : t('none')}</strong>
            <span className="small muted">{t('emptyHint')}</span>
          </div>
        ) : (
          <div className="photo-grid" ref={pager.topRef} style={{ scrollMarginTop: 16 }}>
            {pager.pageItems.map((p) => (
              <div key={p.id} className="photo-card" style={selected.includes(p.id) ? { borderColor: 'var(--green)', boxShadow: '0 0 0 2px var(--green)' } : undefined}>
                <div style={{ position: 'relative' }}>
                  <button className="photo-thumb" onClick={() => setLightbox(visible.indexOf(p))} aria-label={t('invite:gallery.zoom', { name: p.senderName })}>
                    <img src={p.url} alt="" loading="lazy" />
                    <PhotoStatusBadge status={p.status} />
                  </button>
                  <label style={{ position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} style={{ width: 18, height: 18, accentColor: 'var(--green)' }} aria-label={t('select')} />
                  </label>
                </div>
                <div className="stack" style={{ '--gap': '2px', padding: '0 4px' }}>
                  <span className="small" style={{ fontWeight: 500 }}>{p.senderName}</span>
                  <span className="xs muted">{CATEGORIES[p.category]} · {formatDateTime(p.createdAt)}</span>
                  {p.message && <span className="xs" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>„{p.message}“</span>}
                </div>
                <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' }}>
                  {p.status !== 'approved' && <button className="btn btn-primary btn-sm grow" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'approved' }))}>{t('approve')}</button>}
                  {p.status !== 'hidden' && <button className="btn btn-soft btn-sm grow" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'hidden' }))}>{t('hide')}</button>}
                  <button className="icon-btn icon-btn-sm" onClick={() => setToDelete(p)} aria-label={t('deleteAria')}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.setPage} onPageSize={pager.setPageSize}
          sizes={[10, 20, 50, 100]} />
      </section>

      {lightbox !== null && <Lightbox photos={visible} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />}
      {toDelete && (
        <ConfirmModal title={t('deleteTitle')} text={t('deleteText')} busy={busy}
          onClose={() => setToDelete(null)} onConfirm={doDelete} />
      )}
    </>
  );
}
