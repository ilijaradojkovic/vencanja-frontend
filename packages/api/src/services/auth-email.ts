import { parseLanguage, type Language } from '@uspomena/shared';

import type { EmailMessage } from './email.ts';

/**
 * The subset of the Supabase Send Email Hook payload this milestone needs
 * (https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook). With Secure
 * Email Change the payload carries two OTPs; the token hash field names are
 * reversed for backward compatibility:
 *
 * - current address (`user.email`) → `token` + `token_hash_new`
 * - new address (`user.new_email`) → `token_new` + `token_hash`
 */
export type AuthEmailHookPayload = {
  user?: {
    email?: string;
    new_email?: string;
    user_metadata?: { locale?: string } | null;
  } | null;
  email_data?: {
    token_hash?: string;
    token_hash_new?: string;
    email_action_type?: string;
    site_url?: string;
    redirect_to?: string;
  } | null;
};

type Copy = {
  subject: string;
  body: (link: string) => string;
};

const COPY: Record<string, Record<Language, Copy>> = {
  signup: {
    sr: { subject: 'Potvrdite svoj email · Uspomena', body: (link) => `Potvrdite nalog: ${link}` },
    en: { subject: 'Confirm your email · Uspomena', body: (link) => `Confirm your account: ${link}` },
    ru: { subject: 'Подтвердите email · Uspomena', body: (link) => `Подтвердите аккаунт: ${link}` },
  },
  recovery: {
    sr: { subject: 'Nova lozinka · Uspomena', body: (link) => `Postavite novu lozinku: ${link}` },
    en: { subject: 'Reset your password · Uspomena', body: (link) => `Set a new password: ${link}` },
    ru: { subject: 'Новый пароль · Uspomena', body: (link) => `Задайте новый пароль: ${link}` },
  },
  // Secure Email Change: one message to the current address, one to the new one.
  email_change_current: {
    sr: {
      subject: 'Potvrda promene email adrese · Uspomena',
      body: (link) => `Potvrdite promenu adrese sa ovog naloga: ${link}`,
    },
    en: {
      subject: 'Confirm your email change · Uspomena',
      body: (link) => `Confirm the address change from this account: ${link}`,
    },
    ru: {
      subject: 'Подтверждение смены email · Uspomena',
      body: (link) => `Подтвердите смену адреса с этого аккаунта: ${link}`,
    },
  },
  email_change_new: {
    sr: {
      subject: 'Potvrdite novu email adresu · Uspomena',
      body: (link) => `Potvrdite da je ovo vaša nova adresa: ${link}`,
    },
    en: {
      subject: 'Confirm your new email address · Uspomena',
      body: (link) => `Confirm that this is your new address: ${link}`,
    },
    ru: {
      subject: 'Подтвердите новый email · Uspomena',
      body: (link) => `Подтвердите, что это ваш новый адрес: ${link}`,
    },
  },
  magiclink: {
    sr: { subject: 'Prijava na Uspomenu', body: (link) => `Prijavite se: ${link}` },
    en: { subject: 'Sign in to Uspomena', body: (link) => `Sign in: ${link}` },
    ru: { subject: 'Вход в Uspomena', body: (link) => `Войдите: ${link}` },
  },
  invite: {
    sr: { subject: 'Poziv · Uspomena', body: (link) => `Prihvatite poziv: ${link}` },
    en: { subject: 'Invitation · Uspomena', body: (link) => `Accept the invitation: ${link}` },
    ru: { subject: 'Приглашение · Uspomena', body: (link) => `Примите приглашение: ${link}` },
  },
  reauthentication: {
    sr: { subject: 'Kod za potvrdu · Uspomena', body: (link) => `Potvrdite identitet: ${link}` },
    en: { subject: 'Confirmation code · Uspomena', body: (link) => `Confirm your identity: ${link}` },
    ru: { subject: 'Код подтверждения · Uspomena', body: (link) => `Подтвердите личность: ${link}` },
  },
};

const ACTIONS = ['signup', 'recovery', 'email_change', 'magiclink', 'invite', 'reauthentication'];

/** `email_change_current`/`email_change_new` are our own variants; GoTrue sends `email_change`. */
const baseAction = (action: string): string =>
  action === 'email_change_current' || action === 'email_change_new' ? 'email_change' : action;

const isEmailChangeVariant = (action: string): boolean =>
  action === 'email_change_current' || action === 'email_change_new';

export const isKnownAuthAction = (action: string): boolean => ACTIONS.includes(baseAction(action));

const copyOf = (key: string): Record<Language, Copy> => {
  const copy = COPY[key];
  if (!copy) throw new Error(`Unknown auth email action "${key}".`);
  return copy;
};

const copyFor = (action: string): Record<Language, Copy> => copyOf(baseAction(action));

/** Locale comes from validated auth metadata before a profile exists (UC-77, SYS-6). */
export const resolveAuthEmailLocale = (payload: AuthEmailHookPayload): Language =>
  parseLanguage(payload.user?.user_metadata?.locale ?? 'sr');

const message = (to: string, kind: string, copy: Copy, link: string): EmailMessage => ({
  to,
  kind,
  subject: copy.subject,
  text: `${copy.body(link)}\n\nUspomena`,
  html: `<p>${copy.body(link)}</p><p>Uspomena</p>`,
});

/**
 * Builds the account emails for a hook payload. Secure Email Change produces two
 * messages (current and new address), every other action produces one. The
 * callback always lives on `APP_URL`, because GoTrue reports its own auth base
 * as `site_url`.
 */
export const buildAuthEmails = (payload: AuthEmailHookPayload, fallbackSiteUrl: string): EmailMessage[] => {
  const data = payload.email_data;
  const action = data?.email_action_type?.trim();
  const email = payload.user?.email?.trim();
  if (!data || !action || !isKnownAuthAction(action)) return [];

  const siteUrl = (fallbackSiteUrl || data.site_url || '').replace(/\/$/, '');
  const locale = resolveAuthEmailLocale(payload);
  const linkFor = (tokenHash: string | undefined): string => {
    const redirect = data.redirect_to ? `&next=${encodeURIComponent(data.redirect_to)}` : '';
    return `${siteUrl}/auth/callback?token_hash=${tokenHash ?? ''}&type=${encodeURIComponent(action)}${redirect}`;
  };

  if (baseAction(action) === 'email_change') {
    // Test double for the two named steps; GoTrue itself sends one `email_change`.
    if (isEmailChangeVariant(action)) {
      if (!email) return [];
      return [message(email, `auth_${action}`, copyOf(action)[locale], linkFor(data.token_hash))];
    }

    const newEmail = payload.user?.new_email?.trim();

    // Secure Email Change disabled: only the new address gets a confirmation.
    if (!data.token_hash_new) {
      const single = newEmail || email;
      return single
        ? [message(single, 'auth_email_change_new', copyOf('email_change_new')[locale], linkFor(data.token_hash))]
        : [];
    }

    const current = email
      ? message(
          email,
          'auth_email_change_current',
          copyOf('email_change_current')[locale],
          linkFor(data.token_hash_new),
        )
      : null;
    const next = newEmail
      ? message(newEmail, 'auth_email_change_new', copyOf('email_change_new')[locale], linkFor(data.token_hash))
      : null;
    return [current, next].filter((item): item is EmailMessage => item !== null);
  }

  if (!email) return [];
  const kind = baseAction(action);
  return [message(email, `auth_${kind}`, copyFor(action)[locale], linkFor(data.token_hash))];
};

/** Convenience for a single-email flow (all actions except Secure Email Change). */
export const buildAuthEmail = (payload: AuthEmailHookPayload, fallbackSiteUrl: string): EmailMessage | null =>
  buildAuthEmails(payload, fallbackSiteUrl)[0] ?? null;
