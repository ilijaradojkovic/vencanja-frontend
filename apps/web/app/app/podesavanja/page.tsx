import { getProfileById } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { AccountSettings } from '@/features/settings/AccountSettings';
import { getServerAuth } from '@/lib/auth/server';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Podešavanja · Uspomena' };

export default async function SettingsPage() {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp%2Fpodesavanja');

  const profile = await getProfileById(data.user.id);
  if (!profile) redirect('/onboarding');

  const { t } = await getTranslator();
  return (
    <>
      <h1 style={{ fontSize: 30, marginBottom: 16 }}>{t('settings.title')}</h1>
      <AccountSettings
        profile={{
          id: profile.id,
          role: profile.role,
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
          locale: profile.locale,
          active: profile.active,
          onboardedAt: profile.onboardedAt?.toISOString() ?? null,
          providers: (data.user.app_metadata?.providers as string[] | undefined) ?? [],
        }}
        copy={{
          accountTitle: t('settings.accountTitle'),
          email: t('settings.email'),
          emailHint: t('settings.emailHint'),
          changeEmail: t('settings.changeEmail'),
          newEmail: t('settings.newEmail'),
          awaitingConfirmation: t('settings.awaitingConfirmation'),
          emailSent: t('settings.emailSent'),
          emailError: t('settings.emailError'),
          passwordTitle: t('settings.passwordTitle'),
          currentPassword: t('settings.currentPassword'),
          newPassword: t('settings.newPassword'),
          confirmPassword: t('settings.confirmPassword'),
          changePassword: t('settings.changePassword'),
          setPassword: t('settings.setPassword'),
          setPasswordHint: t('settings.setPasswordHint'),
          passwordChanged: t('settings.passwordChanged'),
          passwordError: t('settings.passwordError'),
          currentPasswordError: t('settings.currentPasswordError'),
          mismatch: t('settings.mismatch'),
          passwordTooShort: t('settings.passwordTooShort'),
          phone: t('phone.label'),
          phoneWillSave: t('phone.willSave'),
          savePhone: t('phone.save'),
          phoneSaved: t('phone.saved'),
          language: t('settings.language'),
          saved: t('settings.saved'),
          retentionNote: t('settings.retentionNote'),
        }}
      />
    </>
  );
}
