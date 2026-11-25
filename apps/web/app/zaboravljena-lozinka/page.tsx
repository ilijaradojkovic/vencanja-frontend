import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Zaboravljena lozinka · Uspomena' };

export default async function ForgotPasswordPage() {
  const { t } = await getTranslator();

  return (
    <AuthShell>
      <BrandRow />
      <h1 style={{ fontSize: 32 }}>{t('forgot.title')}</h1>
      <ForgotPasswordForm
        copy={{
          text: t('forgot.text'),
          submit: t('forgot.submit'),
          sent: t('forgot.sent'),
          email: t('fields.email'),
        }}
      />
      <p className="small muted">
        <a href="/login">{t('forgot.backToLogin')}</a>
      </p>
    </AuthShell>
  );
}
