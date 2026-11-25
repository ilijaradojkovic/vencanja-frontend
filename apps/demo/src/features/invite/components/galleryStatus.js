import { GalleryOpenMode } from '../../../app/config/enums';
import i18n from '../../../app/config/i18n';
import { formatDate } from '../../../utils/format';

export const galleryStatusText = (gallery) => {
  if (!gallery || gallery.open) return i18n.t('invite:gallery.statusOpen');
  if (gallery.mode === GalleryOpenMode.AFTER_WEDDING && gallery.opensAt) return i18n.t('invite:gallery.statusOpensAt', { date: formatDate(gallery.opensAt) });
  return i18n.t('invite:gallery.statusManual');
};
