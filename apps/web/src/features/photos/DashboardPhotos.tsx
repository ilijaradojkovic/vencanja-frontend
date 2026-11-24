'use client';

import Link from 'next/link';
import { useCallback, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { FormError } from '@/components/auth/AuthShell';

import { setPhotoStatus } from './actions';
import { SignedPhoto } from './SignedPhoto';
import { fetchEventPhotos, useSignedPages } from './signed-photos';

/**
 * Dashboard "new photos" (UC-11/UC-36): the photo count, the first four pending
 * thumbnails and quick approve/hide.
 */
export function DashboardPhotos({ eventId }: { eventId: string }) {
  const { t } = useTranslation('dashboard');
  const [error, setError] = useState<string | null>(null);
  const loadPage = useCallback(
    (cursor: string | null) => fetchEventPhotos(eventId, { status: 'pending', limit: 4 }, cursor),
    [eventId],
  );
  const list = useSignedPages(loadPage, eventId);
  const counts = list.meta ?? { pending: 0, approved: 0, hidden: 0, all: 0 };

  const moderate = async (id: string, status: 'approved' | 'hidden') => {
    setError(null);
    try {
      await setPhotoStatus(id, status);
      await list.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <section className="card stack" aria-labelledby="pend-h">
      <div className="row between">
        <h2 id="pend-h">{t('newPhotos.title')}</h2>
        <span className="xs muted" data-testid="photo-stats">
          {t('common:nav.photos')}: {counts.all} · {t('stats.pendingPhotos', { count: counts.pending })}
        </span>
        <Link href="/app/fotografije" className="btn btn-ghost btn-sm">
          {t('newPhotos.all', { count: counts.pending })}
        </Link>
      </div>
      {error ? <FormError>{error}</FormError> : null}
      {list.error ? <FormError>{list.error.message}</FormError> : null}
      {list.loading && list.items.length === 0 ? null : list.items.length === 0 ? (
        <div className="empty">
          <strong>{t('newPhotos.allReviewed')}</strong>
          <span className="small muted">{t('newPhotos.emptyHint')}</span>
        </div>
      ) : (
        <div className="photo-grid">
          {list.items.slice(0, 4).map((photo) => (
            <div className="photo-card" key={photo.id}>
              <div className="photo-thumb" style={{ cursor: 'default' }}>
                <SignedPhoto
                  src={photo.thumbUrl}
                  alt={photo.message || t('newPhotos.from', { name: photo.senderName })}
                  width={photo.width}
                  height={photo.height}
                  onExpired={list.onUrlExpired}
                />
              </div>
              <span className="xs muted">{t('newPhotos.fromLabel', { name: photo.senderName })}</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 } as CSSProperties}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void moderate(photo.id, 'approved')}
                >
                  {t('photos:approve')}
                </button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => void moderate(photo.id, 'hidden')}>
                  {t('photos:hide')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
