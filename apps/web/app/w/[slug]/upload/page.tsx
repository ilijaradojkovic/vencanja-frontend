import { eventBySlug, toPublicWedding } from '@uspomena/api/server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UploadPage } from '@/features/upload/UploadPage';
import { eventNames } from '@/lib/event';
import { LocaleProvider } from '@/lib/i18n/client';
import { getTranslator } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await eventBySlug(slug);
  const { t } = await getTranslator(event?.type ?? 'wedding');
  return {
    title: event ? `${t('invite:sendPhotos')} · ${eventNames(toPublicWedding(event))}` : t('invite:errors.badLink'),
    robots: { index: false, follow: false },
  };
}

/** UC-66: QR upload; shows "Uploads are turned off" when `allowGeneralUpload` is off (UC-56). */
export default async function QrUploadRoute({ params }: PageProps) {
  const { slug } = await params;
  const event = await eventBySlug(slug);
  if (!event) notFound();
  const wedding = toPublicWedding(event);
  const { locale } = await getTranslator(wedding.type);
  return (
    <LocaleProvider locale={locale} eventType={wedding.type}>
      <UploadPage
        slug={slug}
        wedding={{
          names: eventNames(wedding),
          partner1: wedding.partner1,
          partner2: wedding.partner2,
          allowGeneralUpload: wedding.settings.allowGeneralUpload,
          gallery: wedding.gallery,
        }}
      />
    </LocaleProvider>
  );
}
