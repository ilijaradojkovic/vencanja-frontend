import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../app/config/i18n';

export default function LanguageSwitcher({ dark = false, style }) {
  const { t, i18n } = useTranslation();
  return (
    <div className={`lang-switch ${dark ? 'lang-switch-dark' : ''}`} role="group" aria-label={t('language.label')} style={style}>
      {LANGUAGES.map((l) => (
        <button key={l.code} type="button" lang={l.code} title={l.label} aria-label={l.label}
          aria-pressed={i18n.resolvedLanguage === l.code} onClick={() => i18n.changeLanguage(l.code)}>
          {l.short}
        </button>
      ))}
    </div>
  );
}
