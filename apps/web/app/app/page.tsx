import { businessDate } from '@uspomena/shared';
import { findEventForOwner, toWeddingPayload } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth/server';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Pregled · Uspomena' };

const DAY_MS = 86_400_000;

/** Calendar days from today (Europe/Belgrade) to the event date. */
const daysUntil = (date: string): number =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${businessDate()}T00:00:00Z`)) / DAY_MS);

/**
 * Minimal organizer dashboard for M2: the welcome and the "N days until the
 * wedding/celebration" countdown (S1/S2). Guests, photos and the sidebar arrive
 * in M3; the data comes from the same service the API uses (D11).
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp');

  const event = await findEventForOwner(data.user.id);
  if (!event) redirect('/onboarding');

  const wedding = toWeddingPayload(event);
  const days = daysUntil(wedding.date);
  const { t } = await getTranslator();
  const { welcome } = await searchParams;

  const names =
    wedding.type === 'wedding'
      ? [wedding.partner1, wedding.partner2].filter(Boolean).join(' & ')
      : [wedding.partner1, wedding.occasion].filter(Boolean).join(' · ');

  const countdown =
    days > 0
      ? (wedding.type === 'wedding' ? t('dashboard.daysLeft') : t('dashboard.celebrationDaysLeft')).replace(
          '{{days}}',
          String(days),
        )
      : wedding.type === 'wedding'
        ? t('dashboard.weddingPassed')
        : t('dashboard.celebrationPassed');

  return (
    <section className="card stack" style={{ '--gap': '10px', maxWidth: 720 } as React.CSSProperties}>
      {welcome ? <p className="muted small">{t('dashboard.welcome')}</p> : null}
      <p className="eyebrow">{wedding.type === 'wedding' ? t('onboarding.wedding') : t('onboarding.celebration')}</p>
      <h1 style={{ fontSize: 32 }}>{t('dashboard.hello').replace('{{names}}', names)}</h1>
      <p data-testid="countdown" style={{ fontFamily: 'var(--serif)', fontSize: 26 }}>
        {countdown}
      </p>
      <p className="small muted">{wedding.date}</p>
    </section>
  );
}
