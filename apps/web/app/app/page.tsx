import { businessDate } from '@uspomena/shared';
import { findEventForOwner, getProfileById, toWeddingPayload } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { getServerAuth } from '@/lib/auth/server';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Pregled · Uspomena' };

const DAY_MS = 86_400_000;

/** Calendar days from today (Europe/Belgrade) to the event date. */
const daysUntil = (date: string): number => {
  const today = Date.parse(`${businessDate()}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / DAY_MS);
};

/**
 * Minimal organizer dashboard for M2: it proves the onboarding redirect and the
 * "N days until the wedding" countdown (S1/S2). The full dashboard, guests and
 * photos arrive in M3. Data comes from the same service the API uses (D11).
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp');

  const profile = await getProfileById(data.user.id);
  if (!profile || !profile.onboardedAt) redirect('/onboarding');

  const event = await findEventForOwner(profile.id);
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
    <AuthShell wide>
      <BrandRow>
        <SignOutButton label={t('dashboard.logout')} />
      </BrandRow>
      {welcome ? <p className="muted small">{t('dashboard.welcome')}</p> : null}
      <h1 style={{ fontSize: 32 }}>{t('dashboard.hello').replace('{{names}}', names)}</h1>
      <p className="stat" data-testid="countdown">
        <span className="eyebrow">
          {wedding.type === 'wedding' ? t('onboarding.wedding') : t('onboarding.celebration')}
        </span>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{countdown}</strong>
      </p>
      <p className="small muted">{wedding.date}</p>
    </AuthShell>
  );
}
