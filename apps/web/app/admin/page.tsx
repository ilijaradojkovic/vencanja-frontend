import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Nalozi · Uspomena' };

/**
 * Placeholder for the superadmin area: sign-in redirects here for `role:
 * superadmin`, and the real accounts table, account creation and
 * password/deactivation actions are the remaining M2 tasks.
 */
export default async function AdminPage() {
  const { t } = await getTranslator();

  return (
    <AuthShell wide>
      <BrandRow>
        <SignOutButton label={t('dashboard.logout')} />
      </BrandRow>
      <h1 style={{ fontSize: 32 }}>Nalozi</h1>
      <p className="muted small">Superadmin area — the accounts table arrives with the rest of M2.</p>
    </AuthShell>
  );
}
