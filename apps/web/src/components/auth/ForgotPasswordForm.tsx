'use client';

import { useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { requestPasswordReset } from '@/lib/auth/actions';

export type ForgotCopy = {
  text: string;
  submit: string;
  sent: string;
  email: string;
};

/**
 * UC-80 forgot password: the response is always the same message, whether or not
 * the account exists, so the form never reveals which addresses are registered.
 */
export function ForgotPasswordForm({
  copy,
  onRequest = requestPasswordReset,
}: {
  copy: ForgotCopy;
  onRequest?: typeof requestPasswordReset;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = await onRequest(email);
    if (!result.ok) {
      setError(result.message ?? copy.text);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <p role="status" data-testid="reset-sent">
        {copy.sent.replace('{{email}}', email.trim())}
      </p>
    );
  }

  return (
    <>
      {error ? <FormError>{error}</FormError> : null}
      <p>{copy.text}</p>
      <form onSubmit={submit} className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        <label className="field">
          <span>{copy.email}</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-lg">{copy.submit}</button>
      </form>
    </>
  );
}
