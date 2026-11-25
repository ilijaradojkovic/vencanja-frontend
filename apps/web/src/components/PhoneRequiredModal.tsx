'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/auth/AuthShell';
import { PhoneField } from '@/components/PhoneField';
import { patchProfile, signOut } from '@/lib/auth/actions';

export type PhoneRequiredCopy = {
  title: string;
  text: string;
  label: string;
  save: string;
  willSave: string;
  logout: string;
};

/**
 * UC-07: an account without a phone number gets a dialog that cannot be closed
 * until the number is saved; sign-out stays available.
 */
export function PhoneRequiredModal({
  copy,
  onSave = patchProfile,
  onSignOut = signOut,
}: {
  copy: PhoneRequiredCopy;
  onSave?: typeof patchProfile;
  onSignOut?: () => Promise<void>;
}) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await onSave({ phone });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    router.refresh();
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="phone-required-title" onSubmit={submit}>
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <h2 id="phone-required-title">{copy.title}</h2>
          <p className="muted small">{copy.text}</p>
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <PhoneField
          label={copy.label}
          value={phone}
          onChange={setPhone}
          willSaveLabel={copy.willSave}
          id="required-phone"
          required
          autoFocus
        />
        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await onSignOut();
              router.push('/login');
            }}
          >
            {copy.logout}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {copy.save}
          </button>
        </div>
      </form>
    </div>
  );
}
