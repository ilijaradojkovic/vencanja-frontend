'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { ResendButton, type ResendCopy } from '@/components/auth/ResendButton';
import { homePathFor, signIn, signInWithGoogle, resendConfirmation } from '@/lib/auth/actions';

export type LoginCopy = {
  email: string;
  password: string;
  submit: string;
  error: string;
  disabled: string;
  rateLimited: string;
  google: string;
  unverified: string;
} & ResendCopy;

export type LoginProps = {
  copy: LoginCopy;
  next?: string | null;
  onSignIn?: typeof signIn;
  onGoogle?: typeof signInWithGoogle;
  onResend?: typeof resendConfirmation;
  onAuthenticated?: (path: string) => void;
};

/** UC-05 sign-in, with UC-78 resend for an unconfirmed email and UC-79 Google. */
export function LoginForm({
  copy,
  next,
  onSignIn = signIn,
  onGoogle = signInWithGoogle,
  onResend = resendConfirmation,
  onAuthenticated,
}: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const go = (path: string) => {
    if (onAuthenticated) onAuthenticated(path);
    else {
      router.push(path);
      router.refresh();
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await onSignIn(email, password);
    setBusy(false);
    if (result.ok) {
      go(homePathFor(result.profile, next));
      return;
    }
    if (result.unverified) {
      setUnverified(true);
      return;
    }
    const rateLimited = result.code === 'over_request_rate_limit' || /rate limit/i.test(result.message);
    if (rateLimited) {
      setError(copy.rateLimited);
      return;
    }
    const disabled = result.code === 'user_banned' || /banned/i.test(result.message);
    if (disabled) {
      setError(copy.disabled);
      return;
    }
    setError(result.code === 'accountDisabled' || result.code === 'sessionExpired' ? result.message : copy.error);
  };

  const google = async () => {
    const result = await onGoogle();
    if (!result.ok) setError(copy.error);
  };

  return (
    <>
      {error ? <FormError>{error}</FormError> : null}
      {unverified ? (
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          <FormError>{copy.unverified}</FormError>
          <ResendButton email={email} copy={copy} onResend={onResend} initialSeconds={0} />
        </div>
      ) : null}
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
        <label className="field">
          <span>{copy.password}</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {copy.submit}
        </button>
      </form>
      <button type="button" className="btn btn-secondary" onClick={google}>
        {copy.google}
      </button>
    </>
  );
}
