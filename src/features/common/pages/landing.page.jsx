import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../../../components/Icon';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

const FEATURES = [
  ['mail', 'invitation'],
  ['image', 'photos'],
  ['heart', 'bigAlbum'],
  ['sparkle', 'custom'],
];

export default function Landing() {
  const { t } = useTranslation('landing');
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <nav className="landing-nav" aria-label={t('common:nav.mainMenu')}>
        <Link to="/" className="brand">Uspomena</Link>
        <div className="row">
          <LanguageSwitcher />
          <Link to="/i/demo-jelena" className="btn btn-ghost">{t('nav.guestInvitation')}</Link>
          <Link to="/login" className="btn btn-primary">{t('nav.login')}</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="stack" style={{ '--gap': '22px' }}>
          <p className="eyebrow">{t('hero.eyebrow')}</p>
          <h1>{t('hero.title')}</h1>
          <p style={{ fontSize: 19, color: 'var(--ink-2)', maxWidth: 520 }}>
            {t('hero.text')}
          </p>
          <div className="row">
            <Link to="/login" className="btn btn-primary btn-lg">{t('hero.tryDemo')}</Link>
            <Link to="/i/demo-jelena" className="btn btn-outline btn-lg">{t('hero.viewAsGuest')}</Link>
          </div>
          <p className="xs muted">{t('hero.demoAccount')}: demo@uspomena.rs / demo123 · {t('hero.adminAccount')}: admin@uspomena.rs / admin123</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div style={{ width: 300, borderRadius: 28, overflow: 'hidden', boxShadow: 'var(--shadow)', background: '#FBF8F2', transform: 'rotate(-2deg)' }}>
            <div style={{ background: 'var(--green)', color: '#F6F3EE', padding: '40px 24px', textAlign: 'center' }} className="stack">
              <span className="eyebrow" style={{ color: 'var(--champagne)' }}>{t('art.invitationFor')}: Jelena i Nikola</span>
              <span className="serif" style={{ fontSize: 46, lineHeight: 1 }}>Ana <i style={{ color: 'var(--champagne)' }}>&amp;</i> Marko</span>
              <span className="xs" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('art.date')}</span>
            </div>
            <div style={{ padding: 20 }} className="stack">
              <div className="row" style={{ '--gap': '8px' }}>
                <span className="btn btn-primary btn-sm grow">{t('art.yes')}</span>
                <span className="btn btn-outline btn-sm grow">{t('art.no')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {['#C9B48E', '#9DB09A', '#C49A8C'].map((c) => <span key={c} style={{ aspectRatio: '1', borderRadius: 8, background: c }} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" aria-label={t('features.label')}>
        {FEATURES.map(([icon, key]) => (
          <div key={key} className="card stack" style={{ '--gap': '10px' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
              <Icon name={icon} />
            </span>
            <h3>{t(`features.${key}.title`)}</h3>
            <p className="muted">{t(`features.${key}.text`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
