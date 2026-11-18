import { normalizePhone, formatPhone, PHONE_HINT } from '../utils/phone';

/**
 * Polje za broj telefona naloga. Prihvata bilo koji uobičajeni zapis (064 123 4567, +381…, 00381…)
 * i ispod prikazuje kako će broj biti sačuvan, pa korisnik odmah vidi da je ispravan.
 */
export default function PhoneField({ value, onChange, error, label = 'Broj telefona', hint = PHONE_HINT, autoFocus, id = 'account-phone' }) {
  const clean = normalizePhone(value);
  return (
    <label className="field" htmlFor={id}>
      <span>{label} <span aria-hidden="true" style={{ color: 'var(--danger, #A3473A)' }}>*</span></span>
      <input id={id} className="input" type="tel" inputMode="tel" autoComplete="tel" required autoFocus={autoFocus}
        placeholder="064 123 4567" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error} aria-describedby={`${id}-hint`} />
      <span id={`${id}-hint`} className="xs" style={{ color: error ? 'var(--danger, #A3473A)' : 'var(--muted)' }}>
        {error || (clean && value.trim() !== formatPhone(clean) ? `Biće sačuvan kao ${formatPhone(clean)}` : hint)}
      </span>
    </label>
  );
}
