'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@uspomena/shared';

import { FormError } from '@/components/auth/AuthShell';
import { PhoneField } from '@/components/PhoneField';
import {
  changeEmail,
  changePassword,
  patchProfile,
  sendSetPasswordEmail,
  setLocaleCookie,
  type AuthProfile,
} from '@/lib/auth/actions';

export type AccountCopy = {
  accountTitle: string;
  email: string;
  emailHint: string;
  changeEmail: string;
  newEmail: string;
  awaitingConfirmation: string;
  emailSent: string;
  emailError: string;
  passwordTitle: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  changePassword: string;
  setPassword: string;
  setPasswordHint: string;
  passwordChanged: string;
  passwordError: string;
  currentPasswordError: string;
  mismatch: string;
  passwordTooShort: string;
  phone: string;
  phoneWillSave: string;
  savePhone: string;
  phoneSaved: string;
  language: string;
  saved: string;
  retentionNote: string;
};

export type AccountActions = {
  onPatchProfile?: typeof patchProfile;
  onChangeEmail?: typeof changeEmail;
  onChangePassword?: typeof changePassword;
  onSetPasswordMail?: typeof sendSetPasswordEmail;
};

const MIN_PASSWORD = 8;

/**
 * Settings → Account (SPEC §9.2): email change with a pending confirmation,
 * password change/set, phone (UC-08) and language (UC-10). Data retention and
 * account deletion belong to M6.
 */
export function AccountSettings({
  profile,
  copy,
  actions = {},
}: {
  profile: AuthProfile & { providers?: string[] };
  copy: AccountCopy;
  actions?: AccountActions;
}) {
  const onPatch = actions.onPatchProfile ?? patchProfile;
  const onEmail = actions.onChangeEmail ?? changeEmail;
  const onPassword = actions.onChangePassword ?? changePassword;
  const onSetMail = actions.onSetPasswordMail ?? sendSetPasswordEmail;

  const [phone, setPhone] = useState(profile.phone);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const router = useRouter();
  // Supabase reports the email+password provider as `email`; Google-only accounts have `google`.
  const providers = profile.providers ?? [];
  const hasPassword =
    providers.length === 0 || providers.some((provider) => provider === 'email' || provider === 'password');

  const savePhone = async (event: React.FormEvent) => {
    event.preventDefault();
    setPhoneError(null);
    setPhoneStatus(null);
    const result = await onPatch({ phone });
    if (!result.ok) return setPhoneError(result.message);
    setPhoneStatus(copy.phoneSaved);
    router.refresh();
  };

  const saveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailError(null);
    setEmailStatus(null);
    const result = await onEmail(newEmail);
    if (!result.ok) return setEmailError(copy.emailError);
    setPendingEmail(result.pending ?? newEmail.trim());
    setEmailStatus(copy.emailSent);
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordStatus(null);
    if (next.length < MIN_PASSWORD) return setPasswordError(copy.passwordTooShort);
    if (next !== confirm) return setPasswordError(copy.mismatch);

    const result = await onPassword(current, next);
    if (!result.ok) {
      return setPasswordError(result.wrongCurrent ? copy.currentPasswordError : copy.passwordError);
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setPasswordStatus(copy.passwordChanged);
  };

  const sendSetPassword = async () => {
    setPasswordError(null);
    const result = await onSetMail(profile.email);
    if (result.ok) setPasswordStatus(copy.setPasswordHint);
    else setPasswordError(copy.passwordError);
  };

  const changeLanguage = async (locale: Language) => {
    if (locale === profile.locale) return;
    await onPatch({ locale });
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    <div className="stack" style={{ '--gap': '18px', maxWidth: 720 } as React.CSSProperties}>
      <form className="card stack" onSubmit={savePhone}>
        <h2>{copy.accountTitle}</h2>
        {phoneError ? <FormError>{phoneError}</FormError> : null}
        {phoneStatus ? (
          <p className="small" role="status">
            {phoneStatus}
          </p>
        ) : null}
        <label className="field">
          <span>{copy.email}</span>
          <input className="input" value={profile.email} readOnly disabled />
          <span className="xs muted">{copy.emailHint}</span>
        </label>
        <PhoneField
          label={copy.phone}
          value={phone}
          onChange={(value) => {
            setPhone(value);
            setPhoneError(null);
            setPhoneStatus(null);
          }}
          error={phoneError ?? undefined}
          willSaveLabel={copy.phoneWillSave}
          id="account-phone"
          required
        />
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={phone === profile.phone}>
          {copy.savePhone}
        </button>
      </form>

      <form className="card stack" onSubmit={saveEmail}>
        <h2>{copy.changeEmail}</h2>
        {emailError ? <FormError>{emailError}</FormError> : null}
        {emailStatus ? (
          <p className="small" role="status">
            {emailStatus}
          </p>
        ) : null}
        {pendingEmail ? (
          <p className="small muted">{copy.awaitingConfirmation.replace('{{email}}', pendingEmail)}</p>
        ) : null}
        <label className="field">
          <span>{copy.newEmail}</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />
          <span className="xs muted">{copy.emailHint}</span>
        </label>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          {copy.changeEmail}
        </button>
      </form>

      <form className="card stack" onSubmit={savePassword}>
        <h2>{copy.passwordTitle}</h2>
        {passwordError ? <FormError>{passwordError}</FormError> : null}
        {passwordStatus ? (
          <p className="small" role="status">
            {passwordStatus}
          </p>
        ) : null}
        {hasPassword ? (
          <>
            <label className="field">
              <span>{copy.currentPassword}</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
            <label className="field">
              <span>{copy.newPassword}</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </label>
            <label className="field">
              <span>{copy.confirmPassword}</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              {copy.changePassword}
            </button>
          </>
        ) : (
          <>
            <p className="small muted">{copy.setPasswordHint}</p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={sendSetPassword}
            >
              {copy.setPassword}
            </button>
          </>
        )}
      </form>

      <section className="card stack">
        <h2>{copy.language}</h2>
        <div className="chips" role="group" aria-label={copy.language}>
          {(['sr', 'en', 'ru'] as const).map((locale) => (
            <button
              key={locale}
              type="button"
              className="chip"
              aria-pressed={profile.locale === locale}
              onClick={() => changeLanguage(locale)}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="xs muted">{copy.retentionNote}</p>
      </section>
    </div>
  );
}
