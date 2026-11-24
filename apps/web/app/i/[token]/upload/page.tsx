import { getGuestInvitation } from '@uspomena/api/server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { UploadPage } from '@/features/upload/UploadPage';
import { eventNames } from '@/lib/event';
import { LocaleProvider } from '@/lib/i18n/client';
import { getTranslator } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  const { t } = await getTranslator(invitation?.publicWedding.type ?? 'wedding');
  return {
    title: invitation
      ? `${t('invite:sendPhotos')} · ${eventNames(invitation.publicWedding)}`
      : t('invite:errors.invitationNotFound'),
    robots: { index: false, follow: false },
  };
}

/** UC-65: upload from the guest's personal link (always allowed). */
export default async function GuestUploadRoute({ params }: PageProps) {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  if (!invitation) notFound();
  const { publicGuest, publicWedding } = invitation;
  const { locale } = await getTranslator(publicWedding.type);
  return (
    <LocaleProvider locale={locale} eventType={publicWedding.type}>
      <UploadPage
        token={token}
        wedding={{
          names: eventNames(publicWedding),
          partner1: publicWedding.partner1,
          partner2: publicWedding.partner2,
          allowGeneralUpload: publicWedding.settings.allowGeneralUpload,
          gallery: publicWedding.gallery,
        }}
        guest={{ name: publicGuest.name, notifyEmail: publicGuest.notifyEmail, prefillEmail: publicGuest.prefillEmail }}
      />
    </LocaleProvider>
  );
}
