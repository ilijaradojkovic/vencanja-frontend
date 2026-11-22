import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Prijava · Uspomena' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const { t } = await getTranslator();

  return (
    <AuthShell>
      <BrandRow />
      <h1 style={{ fontSize: 32 }}>{t('login.title')}</h1>
      {error === 'linkExpired' ? <div className="form-error">{t('login.linkExpired')}</div> : null}
      <LoginForm
        next={next ?? null}
        copy={{
          email: t('fields.email'),
          password: t('fields.password'),
          submit: t('login.submit'),
          error: t('login.error'),
          disabled: t('login.disabled'),
          rateLimited: t('login.rateLimited'),
          google: t('login.google'),
          unverified: t('login.unverified'),
          resend: t('login.resend'),
          resent: t('login.resent'),
          wait: t('login.resendWait'),
        }}
      />
      <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
        <a className="small" href="/zaboravljena-lozinka">
          {t('login.forgot')}
        </a>
        <p className="small muted">
          {t('login.noAccount')} <a href="/registracija">{t('login.signup')}</a>
        </p>
      </div>
    </AuthShell>
  );
}
