'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { ConfirmDialog } from '@/components/Modal';
import { FormError } from '@/components/auth/AuthShell';
import { formatDateTime } from '@/lib/format';

import { bulkPhotoStatus, deletePhoto, setPhotoStatus } from './actions';
import { Lightbox } from './Lightbox';
import { SignedPhoto } from './SignedPhoto';
import { fetchEventPhotos, useSignedPages, type Photo, type PhotoFilters } from './signed-photos';

const TABS = ['pending', 'approved', 'hidden', 'all'] as const;
const CATEGORIES = ['memories', 'wedding'] as const;
const PAGE_SIZE = 50;

export function PhotoStatusBadge({ status }: { status: Photo['status'] }) {
  const { t } = useTranslation('common');
  const map = { pending: 'badge-pending', approved: 'badge-yes', hidden: 'badge-no' } as const;
  return <span className={`badge ${map[status]}`}>{t(`photoStatus.${status}`)}</span>;
}

/**
 * Organizer Photos (UC-34 – UC-39): status tabs with server counts, category
 * filter, selection with bulk approve/hide, per-photo approve/hide/delete and the
 * enlarged view. Grids use `thumbUrl`, the lightbox `url`; pages of 50 load on
 * demand and expired signed URLs reload the loaded pages.
 */
export function PhotosPage({ eventId }: { eventId: string }) {
  const { t, i18n } = useTranslation('photos');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const [tab, setTab] = useState<(typeof TABS)[number]>('pending');
  const [category, setCategory] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPage = useCallback(
    (cursor: string | null) => {
      const filters: PhotoFilters = { status: tab, category, limit: PAGE_SIZE };
      return fetchEventPhotos(eventId, filters, cursor);
    },
    [eventId, tab, category],
  );
  const list = useSignedPages(loadPage, `${tab}|${category}`);
  const photos = list.items;
  const counts = list.meta ?? { pending: 0, approved: 0, hidden: 0, all: 0 };
  const allSelected = photos.length > 0 && photos.every((photo) => selected.includes(photo.id));

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await list.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const bulk = (status: 'approved' | 'hidden') =>
    run(
      async () => {
        await bulkPhotoStatus(eventId, selected, status);
        setSelected([]);
      },
      t(status === 'approved' ? 'approvedToast' : 'hiddenToast', { count: selected.length }),
    );

  const doDelete = () =>
    run(async () => {
      if (!toDelete) return;
      await deletePhoto(toDelete.id);
      setToDelete(null);
      setLightbox(null);
    }, t('deletedToast'));

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="page-head row between">
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <p className="eyebrow">{t('eyebrow', { count: counts.all })}</p>
          <h1>{t('common:nav.photos')}</h1>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void list.reload()} disabled={list.loading}>
          {t('common:actions.refresh')}
        </button>
      </div>

      <section className="card stack">
        <div className="row between">
          <div className="chips" role="group" aria-label={t('statusAria')}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key);
                  setSelected([]);
                }}
              >
                {t(`tabs.${key}`)} <span className="count">{counts[key]}</span>
              </button>
            ))}
          </div>
          <select
            className="select"
            style={{ width: 'auto' }}
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            aria-label={t('categoryAria')}
          >
            <option value="all">{t('allCategories')}</option>
            {CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {t(`common:category.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {notice ? (
          <p className="small" role="status">
            {notice}
          </p>
        ) : null}
        {actionError ? <FormError>{actionError}</FormError> : null}
        {list.error ? <FormError>{list.error.message}</FormError> : null}

        {photos.length > 0 ? (
          <div className="row between" style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--bg)' }}>
            <label className="check" style={{ minHeight: 0, padding: 0 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : photos.map((photo) => photo.id))}
              />
              {selected.length ? t('selected', { count: selected.length }) : t('selectAll', { count: photos.length })}
            </label>
            <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!selected.length || busy}
                onClick={() => void bulk('approved')}
              >
                <Icon name="check" size={16} /> {t('approve')}
              </button>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={!selected.length || busy}
                onClick={() => void bulk('hidden')}
              >
                <Icon name="eyeOff" size={16} /> {t('hide')}
              </button>
            </div>
          </div>
        ) : null}

        {list.loading && photos.length === 0 ? (
          <p className="muted small">{t('common:actions.loading')}</p>
        ) : photos.length === 0 ? (
          <div className="empty">
            <strong>{tab === 'pending' ? t('allReviewed') : t('none')}</strong>
            <span className="small muted">{t('emptyHint')}</span>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="photo-card"
                style={
                  selected.includes(photo.id)
                    ? { borderColor: 'var(--green)', boxShadow: '0 0 0 2px var(--green)' }
                    : undefined
                }
              >
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="photo-thumb"
                    onClick={() => setLightbox(index)}
                    aria-label={t('invite:gallery.zoom', { name: photo.senderName })}
                  >
                    <SignedPhoto
                      src={photo.thumbUrl}
                      alt=""
                      width={photo.width}
                      height={photo.height}
                      onExpired={list.onUrlExpired}
                    />
                    <PhotoStatusBadge status={photo.status} />
                  </button>
                  <label
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.92)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(photo.id)}
                      onChange={() => toggle(photo.id)}
                      style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
                      aria-label={t('select')}
                    />
                  </label>
                </div>
                <div className="stack" style={{ '--gap': '2px', padding: '0 4px' } as React.CSSProperties}>
                  <span className="small" style={{ fontWeight: 500 }}>
                    {photo.senderName}
                  </span>
                  <span className="xs muted">
                    {t(`common:category.${photo.category}`)} · {formatDateTime(photo.createdAt, locale)}
                  </span>
                  {photo.message ? (
                    <span className="xs" style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>
                      „{photo.message}“
                    </span>
                  ) : null}
                </div>
                <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' } as React.CSSProperties}>
                  {photo.status !== 'approved' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm grow"
                      disabled={busy}
                      onClick={() => void run(() => setPhotoStatus(photo.id, 'approved'))}
                    >
                      {t('approve')}
                    </button>
                  ) : null}
                  {photo.status !== 'hidden' ? (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm grow"
                      disabled={busy}
                      onClick={() => void run(() => setPhotoStatus(photo.id, 'hidden'))}
                    >
                      {t('hide')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => setToDelete(photo)}
                    aria-label={t('deleteAria')}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {list.hasMore ? (
          <button
            type="button"
            className="btn btn-outline"
            style={{ alignSelf: 'center' }}
            disabled={list.loadingMore}
            onClick={() => void list.loadMore()}
          >
            {t('loadMore')}
          </button>
        ) : null}
      </section>

      {lightbox !== null ? (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onExpired={list.onUrlExpired}
          onNearEnd={list.hasMore ? () => void list.loadMore() : undefined}
        />
      ) : null}
      {toDelete ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          text={t('deleteText')}
          confirmLabel={t('common:actions.delete')}
          cancelLabel={t('common:actions.cancel')}
          closeLabel={t('common:actions.close')}
          busy={busy}
          onConfirm={() => void doDelete()}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </div>
  );
}
