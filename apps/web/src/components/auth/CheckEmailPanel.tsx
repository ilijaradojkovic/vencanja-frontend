'use client';

import { useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { ResendButton, type ResendCopy } from '@/components/auth/ResendButton';
import { resendConfirmation } from '@/lib/auth/actions';

export type CheckEmailCopy = {
  text: string;
  hint: string;
  missingEmail: string;
} & ResendCopy;

/** UC-77/UC-78 "Check your email" screen with the 60-second resend button. */
export function CheckEmailPanel({
  email,
  copy,
  onResend = resendConfirmation,
}: {
  email?: string | null;
  copy: CheckEmailCopy;
  onResend?: typeof resendConfirmation;
}) {
  const [address, setAddress] = useState(email ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    return (
      <form
        className="stack"
        style={{ '--gap': '12px' } as React.CSSProperties}
        onSubmit={(event) => {
          event.preventDefault();
          if (!address.trim()) setError(copy.missingEmail);
        }}
      >
        {error ? <FormError>{error}</FormError> : null}
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        {address ? <ResendButton email={address} copy={copy} onResend={onResend} initialSeconds={0} /> : null}
      </form>
    );
  }

  return (
    <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
      <p>{copy.text.replace('{{email}}', address)}</p>
      <p className="small muted">{copy.hint}</p>
      <ResendButton email={address} copy={copy} onResend={onResend} />
    </div>
  );
}
