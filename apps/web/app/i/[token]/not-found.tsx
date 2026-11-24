import Link from 'next/link';

import { getTranslator } from '@/lib/i18n/server';

/** UC-70: a localized "invitation not found" page instead of a blank/broken one. */
export default async function InvitationNotFound() {
  const { t } = await getTranslator();
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--green-dark)',
        padding: 20,
      }}
    >
      <div className="card stack" style={{ width: 'min(420px, 100%)', textAlign: 'center', padding: 32 }}>
        <h1 style={{ fontSize: 30 }}>{t('invite:errors.invitationNotFound')}</h1>
        <p className="muted">{t('invite:errors.badLink')}</p>
        <Link href="/" className="btn btn-primary">
          {t('invite:backToHome')}
        </Link>
      </div>
    </main>
  );
}
