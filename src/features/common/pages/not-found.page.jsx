import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound({ title, text }) {
  const { t } = useTranslation();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', maxWidth: 420 }}>
        <p className="eyebrow">{t('notFound.eyebrow')}</p>
        <h1>{title || t('notFound.title')}</h1>
        <p className="muted">{text || t('notFound.text')}</p>
        <Link to="/" className="btn btn-primary">{t('notFound.home')}</Link>
      </div>
    </div>
  );
}
