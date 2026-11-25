import { eventBySlug, toPublicWedding } from '@uspomena/api/server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GalleryPage } from '@/features/photos/GalleryPage';
import { eventNames } from '@/lib/event';
import { LocaleProvider } from '@/lib/i18n/client';
import { getTranslator } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ slug: string }> };

/** UC-67/UC-69: the QR gallery; unavailable when `galleryViaQr` is off. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await eventBySlug(slug);
  const { t } = await getTranslator(event?.type ?? 'wedding');
  return {
    title: event
      ? `${t('invite:gallery.title')} · ${eventNames(toPublicWedding(event))}`
      : t('invite:gallery.unavailable'),
    robots: { index: false, follow: false },
  };
}

export default async function QrGalleryRoute({ params }: PageProps) {
  const { slug } = await params;
  const event = await eventBySlug(slug);
  if (!event) notFound();
  const wedding = toPublicWedding(event);
  const { locale } = await getTranslator(wedding.type);
  return (
    <LocaleProvider locale={locale} eventType={wedding.type}>
      <GalleryPage slug={slug} names={eventNames(wedding)} invitation={wedding.invitation} />
    </LocaleProvider>
  );
}
