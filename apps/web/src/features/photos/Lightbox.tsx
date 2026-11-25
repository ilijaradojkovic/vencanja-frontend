'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';

export type LightboxPhoto = {
  id: string;
  url: string | null;
  senderName: string;
  message: string;
  width: number | null;
  height: number | null;
};

/**
 * Enlarged view (UC-35, UC-14): shows the signed web version (`url`, SPEC §7.3).
 * `onNearEnd` lets a paginated list load its next page before the last photo.
 */
export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  onExpired,
  onNearEnd,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onExpired: () => void;
  onNearEnd?: () => void;
}) {
  const { t } = useTranslation('common');
  const photo = photos[index];
  const last = photos.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onIndex(Math.min(last, index + 1));
      if (event.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, last, onClose, onIndex]);

  useEffect(() => {
    if (onNearEnd && index >= last - 2) onNearEnd();
  }, [index, last, onNearEnd]);

  if (!photo) return null;
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.label')}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <button
        type="button"
        className="icon-btn"
        style={{ position: 'absolute', top: 16, right: 16 }}
        onClick={onClose}
        aria-label={t('actions.close')}
      >
        <Icon name="x" />
      </button>
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URLs change hourly (SPEC §7.3)
        <img
          src={photo.url}
          alt={photo.message || t('lightbox.photoFrom', { name: photo.senderName })}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          decoding="async"
          onError={onExpired}
        />
      ) : null}
      <div className="row" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onIndex(index - 1)}
          disabled={index === 0}
          aria-label={t('actions.previous')}
        >
          <Icon name="chevronLeft" />
        </button>
        <div style={{ maxWidth: 480 }}>
          <strong>{photo.senderName}</strong>
          {photo.message ? (
            <p className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>
              „{photo.message}“
            </p>
          ) : null}
          <span className="xs" style={{ opacity: 0.7 }}>
            {index + 1} / {photos.length}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onIndex(index + 1)}
          disabled={index === last}
          aria-label={t('actions.next')}
        >
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
