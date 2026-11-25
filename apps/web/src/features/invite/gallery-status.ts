import type { Language } from '@uspomena/shared';

import { formatDate } from '@/lib/format';

type GalleryState = { open: boolean; mode: 'now' | 'after_wedding' | 'manual'; opensAt: string | null };
type Translate = (key: string, params?: { date: string }) => string;

/**
 * "Galerija se otvara gostima 13. jun 2027." for the invitation, gallery and upload
 * pages. Serbian dates already end with a dot (and Russian ones with "г."), so a
 * sentence-final dot is not doubled.
 */
export const galleryStatusText = (t: Translate, gallery: GalleryState, locale: Language): string => {
  if (gallery.open) return t('invite:gallery.statusOpen');
  if (gallery.mode === 'after_wedding' && gallery.opensAt) {
    return t('invite:gallery.statusOpensAt', { date: formatDate(gallery.opensAt, locale) }).replace(/\.\.$/, '.');
  }
  return t('invite:gallery.statusManual');
};
