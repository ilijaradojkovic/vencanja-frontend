import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { SignupForm } from '@/components/auth/SignupForm';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Napravi nalog · Uspomena' };

export default async function SignupPage() {
  const { locale, t } = await getTranslator();

  return (
    <AuthShell>
      <BrandRow />
      <h1 style={{ fontSize: 32 }}>{t('signup.title')}</h1>
      <SignupForm
        locale={locale}
        copy={{
          email: t('fields.email'),
          password: t('fields.password'),
          passwordHint: t('signup.passwordHint'),
          submit: t('signup.submit'),
          passwordTooShort: t('signup.passwordTooShort'),
          invalidEmail: t('signup.invalidEmail'),
          termsRequired: t('signup.termsRequired'),
          termsBefore: t('signup.termsBefore'),
          termsLink: t('signup.termsLink'),
          termsJoin: t('signup.termsJoin'),
          privacyLink: t('signup.privacyLink'),
          error: t('signup.error'),
        }}
      />
      <p className="small muted">
        {t('signup.hasAccount')} <a href="/login">{t('signup.login')}</a>
      </p>
    </AuthShell>
  );
}
