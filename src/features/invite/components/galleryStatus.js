import { GalleryOpenMode } from '../../../app/config/enums';
import { formatDate } from '../../../utils/format';

export const galleryStatusText = (gallery) => {
  if (!gallery || gallery.open) return 'Galerija je otvorena.';
  if (gallery.mode === GalleryOpenMode.AFTER_WEDDING && gallery.opensAt) return `Galerija se otvara gostima ${formatDate(gallery.opensAt)}.`;
  return 'Galerija se otvara kada je mladenci otvore.';
};
