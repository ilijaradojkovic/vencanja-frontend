'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { signUp } from '@/lib/auth/actions';

export type SignupCopy = {
  email: string;
  password: string;
  passwordHint: string;
  submit: string;
  passwordTooShort: string;
  invalidEmail: string;
  termsRequired: string;
  termsBefore: string;
  termsLink: string;
  termsJoin: string;
  privacyLink: string;
  error: string;
};

export type SignupProps = {
  copy: SignupCopy;
  locale: 'sr' | 'en' | 'ru';
  onSignUp?: typeof signUp;
  onCreated?: (email: string) => void;
};

const EMAIL = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

/**
 * UC-77 signup: email, password (at least 8 characters) and the required legal
 * acceptance, stored in the auth metadata so the Send Email Hook can localize the
 * confirmation before a profile exists. An existing address shows the same
 * "check your email" screen, so account existence is never revealed.
 */
export function SignupForm({ copy, locale, onSignUp = signUp, onCreated }: SignupProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!EMAIL.test(email.trim())) return setError(copy.invalidEmail);
    if (password.length < MIN_PASSWORD) return setError(copy.passwordTooShort);
    if (!accepted) return setError(copy.termsRequired);

    setBusy(true);
    const result = await onSignUp({ email, password, locale });
    setBusy(false);
    if (!result.ok) return setError(copy.error);

    if (onCreated) onCreated(email.trim());
    else router.push(`/potvrda-emaila?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <>
      {error ? <FormError>{error}</FormError> : null}
      <form onSubmit={submit} className="stack" style={{ '--gap': '14px' } as React.CSSProperties} noValidate>
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="xs muted">{copy.passwordHint}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>
            {copy.termsBefore}{' '}
            <a href="/uslovi" target="_blank" rel="noreferrer">
              {copy.termsLink}
            </a>{' '}
            {copy.termsJoin}{' '}
            <a href="/privatnost" target="_blank" rel="noreferrer">
              {copy.privacyLink}
            </a>
          </span>
        </label>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {copy.submit}
        </button>
      </form>
    </>
  );
}
