'use client';

import { formatPhone, normalizePhone } from '@uspomena/shared';

/**
 * Phone input with the prototype's live "will be saved as" hint (UC-08) and the
 * same validation message for an invalid number.
 */
export function PhoneField({
  label,
  value,
  onChange,
  error,
  hint,
  willSaveLabel,
  id = 'phone',
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  willSaveLabel: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const clean = normalizePhone(value);
  const formatted = clean ? formatPhone(clean) : '';
  const helper = error || (clean && value.trim() !== formatted ? willSaveLabel.replace('{{phone}}', formatted) : hint);

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        autoFocus={autoFocus}
        placeholder="064 123 4567"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint`}
      />
      {helper ? (
        <span id={`${id}-hint`} className="xs" style={{ color: error ? 'var(--danger)' : 'var(--muted)' }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}
