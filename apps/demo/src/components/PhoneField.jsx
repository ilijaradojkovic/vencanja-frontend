import { useTranslation } from 'react-i18next';
import { normalizePhone, formatPhone } from '../utils/phone';

export default function PhoneField({ value, onChange, error, label, hint, autoFocus, id = 'account-phone' }) {
  const { t } = useTranslation();
  const clean = normalizePhone(value);
  return (
    <label className="field" htmlFor={id}>
      <span>{label || t('phone.label')} <span aria-hidden="true" style={{ color: 'var(--danger, #A3473A)' }}>*</span></span>
      <input id={id} className="input" type="tel" inputMode="tel" autoComplete="tel" required autoFocus={autoFocus}
        placeholder="064 123 4567" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error} aria-describedby={`${id}-hint`} />
      <span id={`${id}-hint`} className="xs" style={{ color: error ? 'var(--danger, #A3473A)' : 'var(--muted)' }}>
        {error || (clean && value.trim() !== formatPhone(clean) ? t('phone.willSave', { phone: formatPhone(clean) }) : hint || t('phone.hint'))}
      </span>
    </label>
  );
}
