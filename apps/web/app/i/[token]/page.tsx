import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getGuestByToken } from '@uspomena/api/server-only';
import type { Language } from '@uspomena/shared';

import { getLocale } from '@/lib/i18n/locale';

// Guest HTML is rendered per request: it carries a personal name and must never
// be cached by Next.js or a CDN (SPEC §3.3).
export const dynamic = 'force-dynamic';

type GuestPageProps = { params: Promise<{ token: string }> };

const COPY: Record<Language, { title: (name: string) => string; intro: string }> = {
  sr: { title: (name) => `Pozivnica · ${name}`, intro: 'Vaša lična pozivnica.' },
  en: { title: (name) => `Invitation · ${name}`, intro: 'Your personal invitation.' },
  ru: { title: (name) => `Приглашение · ${name}`, intro: 'Ваше личное приглашение.' },
};

export const generateMetadata = async ({ params }: GuestPageProps): Promise<Metadata> => {
  const [{ token }, locale] = await Promise.all([params, getLocale()]);
  const guest = getGuestByToken(token);
  if (!guest) return { title: COPY[locale].title(''), robots: { index: false, follow: false } };
  return {
    title: COPY[locale].title(guest.name),
    description: COPY[locale].intro,
    robots: { index: false, follow: false },
    openGraph: { title: COPY[locale].title(guest.name), locale },
  };
};

/**
 * M0 spike placeholder for the guest invitation. M3/M6 port the real invitation
 * (envelope, schedule, RSVP) and the archived state onto this route.
 */
export default async function GuestInvitationPage({ params }: GuestPageProps) {
  const [{ token }, locale] = await Promise.all([params, getLocale()]);
  const guest = getGuestByToken(token);
  if (!guest) notFound();

  return (
    <main>
      <h1>{COPY[locale].title(guest.name)}</h1>
      <p>{COPY[locale].intro}</p>
    </main>
  );
}
