import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { NewPasswordForm } from '@/components/auth/NewPasswordForm';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Nova lozinka · Uspomena' };

export default async function NewPasswordPage() {
  const { t } = await getTranslator();

  return (
    <AuthShell>
      <BrandRow />
      <h1 style={{ fontSize: 32 }}>{t('reset.title')}</h1>
      <NewPasswordForm
        copy={{
          text: t('reset.text'),
          newPassword: t('fields.newPassword'),
          passwordConfirm: t('fields.passwordConfirm'),
          submit: t('reset.submit'),
          mismatch: t('reset.mismatch'),
          passwordTooShort: t('reset.passwordTooShort'),
          expired: t('reset.expired'),
          newLink: t('reset.newLink'),
          error: t('reset.error'),
        }}
      />
    </AuthShell>
  );
}
