'use client';

import Link from 'next/link';
import { useCallback, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotifyForm } from '@/features/invite/InvitationExperience';
import { formatDate } from '@/lib/format';
import { envelopeColor } from '@/templates';

import { Lightbox } from './Lightbox';
import { SignedPhoto } from './SignedPhoto';
import { fetchInvitationGallery, fetchSlugGallery, useSignedPages, type GalleryMeta } from './signed-photos';

const CATEGORIES = ['memories', 'wedding'] as const;

/**
 * Guest gallery (UC-14, UC-67 – UC-69) for the personal link (`token`) or the QR
 * link (`slug`). Approved photos load in pages of 50 (thumbnails in the grid, the
 * web version in the lightbox); while the gallery is closed it shows when it
 * opens and the "notify me" form.
 */
export function GalleryPage({
  token,
  slug,
  names,
  invitation,
  notifyEmail: initialNotifyEmail = '',
  prefillEmail = '',
}: {
  token?: string;
  slug?: string;
  names: string;
  /** The event's invitation look; its envelope color is the accent. */
  invitation: { templateId?: string; accentColor?: string } | null;
  notifyEmail?: string;
  prefillEmail?: string;
}) {
  const { t, i18n } = useTranslation('invite');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const accent = envelopeColor(invitation);
  const [category, setCategory] = useState<'all' | (typeof CATEGORIES)[number]>('all');
  const [index, setIndex] = useState<number | null>(null);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);

  const loadPage = useCallback(
    (cursor: string | null) =>
      token ? fetchInvitationGallery(token, { category }, cursor) : fetchSlugGallery(slug ?? '', { category }, cursor),
    [token, slug, category],
  );
  const list = useSignedPages(loadPage, category);
  const gallery: GalleryMeta | null = list.meta;
  const photos = list.items;
  const backTo = token ? `/i/${token}` : null;
  const uploadTo = token ? `/i/${token}/upload` : `/w/${slug ?? ''}/upload`;

  const statusText = (meta: GalleryMeta) =>
    meta.open
      ? t('gallery.statusOpen')
      : meta.mode === 'after_wedding' && meta.opensAt
        ? t('gallery.statusOpensAt', { date: formatDate(meta.opensAt, locale) })
        : t('gallery.statusManual');

  return (
    <div className="guest-page">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          {backTo ? (
            <Link href={backTo} className="icon-btn" aria-label={t('backToInvitation')}>
              <Icon name="chevronLeft" />
            </Link>
          ) : (
            <span style={{ width: 44 }} />
          )}
          <div className="stack" style={{ '--gap': '0', textAlign: 'center' } as CSSProperties}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>
              {names}
            </span>
            <span className="xs muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('gallery.title')}
            </span>
          </div>
          <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' } as CSSProperties}>
            <LanguageSwitcher current={locale} label="Jezik" />
            <Link href={uploadTo} className="icon-btn" aria-label={t('sendPhotos')}>
              <Icon name="upload" />
            </Link>
          </div>
        </header>

        {list.error ? (
          <div className="stack" style={{ padding: '56px 20px', textAlign: 'center' } as CSSProperties}>
            <h1 style={{ fontSize: 28 }}>{t('gallery.unavailable')}</h1>
            <p className="muted">{list.error.message}</p>
          </div>
        ) : !gallery ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            {t('common:actions.loading')}
          </p>
        ) : !gallery.open ? (
          <div
            className="stack"
            style={
              {
                maxWidth: 520,
                margin: '0 auto',
                padding: '56px 20px',
                '--gap': '16px',
                textAlign: 'center',
              } as CSSProperties
            }
          >
            <span
              style={{
                alignSelf: 'center',
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--surface-2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--gold)',
              }}
            >
              <Icon name="lock" size={30} />
            </span>
            <h1 style={{ fontSize: 32 }}>{t('gallery.notOpen')}</h1>
            <p style={{ color: 'var(--ink-2)' }}>{statusText(gallery)}</p>
            {notifyEmail ? (
              <p className="small muted">{t('gallery.willNotify', { email: notifyEmail })}</p>
            ) : (
              <div className="card stack" style={{ textAlign: 'left' }}>
                <strong style={{ fontWeight: 500 }}>{t('gallery.notifyTitle')}</strong>
                <NotifyForm
                  token={token}
                  slug={slug}
                  initialEmail={prefillEmail}
                  accent={accent}
                  onDone={setNotifyEmail}
                />
              </div>
            )}
            <Link href={uploadTo} className="btn btn-outline btn-lg">
              <Icon name="upload" /> {t('gallery.sendYours')}
            </Link>
          </div>
        ) : (
          <div className="stack" style={{ padding: '20px 16px 48px', '--gap': '16px' } as CSSProperties}>
            <div className="row between">
              <span className="small muted">
                {t('gallery.fromGuests', { photos: t('common:count.photos', { count: gallery.total }) })}
              </span>
              <div className="chips" role="group" aria-label={t('gallery.categoryAria')}>
                {(['all', ...CATEGORIES] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="chip"
                    aria-pressed={category === key}
                    onClick={() => setCategory(key)}
                  >
                    {key === 'all' ? t('gallery.all') : t(`common:category.${key}`)}
                  </button>
                ))}
              </div>
            </div>
            {photos.length === 0 ? (
              <div className="empty">
                <strong>{category !== 'all' ? t('gallery.emptyCategory') : t('gallery.empty')}</strong>
              </div>
            ) : (
              <div className="photo-grid">
                {photos.map((photo, position) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="photo-thumb"
                    onClick={() => setIndex(position)}
                    aria-label={t('gallery.zoom', { name: photo.senderName })}
                  >
                    <SignedPhoto
                      src={photo.thumbUrl}
                      alt=""
                      width={photo.width}
                      height={photo.height}
                      onExpired={list.onUrlExpired}
                    />
                  </button>
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
                {t('photos:loadMore')}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {index !== null ? (
        <Lightbox
          photos={photos}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
          onExpired={list.onUrlExpired}
          onNearEnd={list.hasMore ? () => void list.loadMore() : undefined}
        />
      ) : null}
    </div>
  );
}
