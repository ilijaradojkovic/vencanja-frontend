'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { getBrowserAuth } from '@/lib/auth/browser';
import { completePasswordChange } from '@/lib/auth/actions';

export type NewPasswordCopy = {
  text: string;
  newPassword: string;
  passwordConfirm: string;
  submit: string;
  mismatch: string;
  passwordTooShort: string;
  expired: string;
  newLink: string;
  error: string;
};

const MIN_PASSWORD = 8;

/**
 * UC-80 / UC-83 password completion. The recovery link signs the user in through
 * `/auth/callback`, so the form can call `updateUser`, revoke the other refresh
 * sessions and let the API move the access-token cutoff forward.
 */
export function NewPasswordForm({
  copy,
  hasSession,
  onSubmit = completePasswordChange,
  onDone,
}: {
  copy: NewPasswordCopy;
  hasSession?: boolean;
  onSubmit?: typeof completePasswordChange;
  onDone?: (path: string) => void;
}) {
  const [session, setSession] = useState<boolean | undefined>(hasSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (session !== undefined) return;
    let active = true;
    const check = async () => {
      const auth = getBrowserAuth();
      const result = await auth?.auth.getSession();
      if (active) setSession(Boolean(result?.data.session));
    };
    void check();
    return () => {
      active = false;
    };
  }, [session]);

  if (session === false) {
    return (
      <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
        <FormError>{copy.expired}</FormError>
        <a className="btn btn-secondary" href="/zaboravljena-lozinka">
          {copy.newLink}
        </a>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(copy.passwordTooShort);
    if (password !== confirm) return setError(copy.mismatch);

    setBusy(true);
    const result = await onSubmit(password);
    setBusy(false);
    if (!result.ok) return setError(copy.error);

    if (onDone) onDone('/app');
    else {
      router.push('/app');
      router.refresh();
    }
  };

  return (
    <>
      {error ? <FormError>{error}</FormError> : null}
      <p>{copy.text}</p>
      <form onSubmit={submit} className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        <label className="field">
          <span>{copy.newPassword}</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{copy.passwordConfirm}</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {copy.submit}
        </button>
      </form>
    </>
  );
}
