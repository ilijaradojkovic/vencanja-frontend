import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { CheckEmailPanel } from '@/components/auth/CheckEmailPanel';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Proverite email · Uspomena' };

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const { t } = await getTranslator();

  return (
    <AuthShell>
      <BrandRow />
      <h1 style={{ fontSize: 32 }}>{t('checkEmail.title')}</h1>
      <CheckEmailPanel
        email={email ?? null}
        copy={{
          text: t('checkEmail.text'),
          hint: t('checkEmail.hint'),
          missingEmail: t('checkEmail.missingEmail'),
          resend: t('checkEmail.resend'),
          resent: t('checkEmail.resent'),
          wait: t('checkEmail.wait'),
        }}
      />
      <p className="small muted">
        <a href="/login">{t('checkEmail.backToLogin')}</a>
      </p>
    </AuthShell>
  );
}
