import { getGuestInvitation } from '@uspomena/api/server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InvitationExperience } from '@/features/invite/InvitationExperience';
import { eventNames } from '@/lib/event';
import { LocaleProvider } from '@/lib/i18n/client';
import { getTranslator } from '@/lib/i18n/server';

type PageProps = { params: Promise<{ token: string }> };

/**
 * UC-58/UC-59: the personal invitation is rendered on the server with the guest's
 * data and per-request locale/event overlay, `noindex`, and link-preview metadata
 * that never contains the guest name, token or photo URLs. `proxy.ts` sets
 * `Cache-Control: private, no-store`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  const { locale, t } = await getTranslator(invitation?.publicWedding.type ?? 'wedding');
  if (!invitation) {
    return { title: t('invite:errors.invitationNotFound'), robots: { index: false, follow: false } };
  }
  const names = eventNames(invitation.publicWedding);
  return {
    title: t('invite:meta.title', { names }),
    description: t('invite:meta.description'),
    robots: { index: false, follow: false },
    openGraph: {
      title: t('invite:meta.title', { names }),
      description: t('invite:meta.description'),
      locale,
      type: 'website',
    },
  };
}

export default async function GuestInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const invitation = await getGuestInvitation(token);
  if (!invitation) notFound();

  const { publicGuest, publicWedding } = invitation;
  const { locale } = await getTranslator(publicWedding.type);

  return (
    <LocaleProvider locale={locale} eventType={publicWedding.type}>
      <InvitationExperience token={token} initialGuest={publicGuest} wedding={publicWedding} />
    </LocaleProvider>
  );
}
