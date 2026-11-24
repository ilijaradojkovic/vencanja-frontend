import { getGuestInvitation } from '@uspomena/api/server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GalleryPage } from '@/features/photos/GalleryPage';
import { eventNames } from '@/lib/event';
import { LocaleProvider } from '@/lib/i18n/client';
import { getTranslator } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ token: string }> };

/**
 * UC-14/UC-67: the guest's personal gallery. Photos (signed URLs) are loaded by
 * the client and never appear in the HTML metadata; `proxy.ts` sets
 * `Cache-Control: private, no-store`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  const { t } = await getTranslator(invitation?.publicWedding.type ?? 'wedding');
  return {
    title: invitation
      ? `${t('invite:gallery.title')} · ${eventNames(invitation.publicWedding)}`
      : t('invite:errors.invitationNotFound'),
    robots: { index: false, follow: false },
  };
}

export default async function GuestGalleryRoute({ params }: PageProps) {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  if (!invitation) notFound();
  const { publicGuest, publicWedding } = invitation;
  const { locale } = await getTranslator(publicWedding.type);
  return (
    <LocaleProvider locale={locale} eventType={publicWedding.type}>
      <GalleryPage
        token={token}
        names={eventNames(publicWedding)}
        invitation={publicWedding.invitation}
        notifyEmail={publicGuest.notifyEmail}
        prefillEmail={publicGuest.prefillEmail}
      />
    </LocaleProvider>
  );
}
