import { getProfileById } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/AppShell';
import { getServerAuth } from '@/lib/auth/server';
import { getTranslator } from '@/lib/i18n/server';

/**
 * Organizer shell and the single server-side onboarding redirect (API 409 is the
 * real boundary). The signed-out redirect is already handled by `proxy.ts`.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp');

  const profile = await getProfileById(data.user.id);
  if (!profile || !profile.onboardedAt) redirect('/onboarding');
  // UC-05: the superadmin belongs in /admin, an organizer in /app.
  if (profile.role === 'superadmin') redirect('/admin');

  const { t } = await getTranslator();
  return (
    <AppShell
      nav={{ dashboard: t('app.nav.dashboard'), settings: t('app.nav.settings') }}
      hasPhone={Boolean(profile.phone)}
      logoutLabel={t('dashboard.logout')}
      phoneCopy={{
        title: t('phone.requiredTitle'),
        text: t('phone.requiredText'),
        label: t('phone.label'),
        save: t('phone.save'),
        willSave: t('phone.willSave'),
        logout: t('onboarding.logout'),
      }}
    >
      {children}
    </AppShell>
  );
}
