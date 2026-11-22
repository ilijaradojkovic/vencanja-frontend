import { parseLanguage, type Language } from '@uspomena/shared';

import type { EmailMessage } from './email.ts';

/** The subset of the Supabase Send Email Hook payload this milestone needs. */
export type AuthEmailHookPayload = {
  user?: { email?: string; user_metadata?: { locale?: string } | null } | null;
  email_data?: {
    token_hash?: string;
    token?: string;
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
  email_change: {
    sr: { subject: 'Promena email adrese · Uspomena', body: (link) => `Potvrdite novu adresu: ${link}` },
    en: { subject: 'Email address change · Uspomena', body: (link) => `Confirm the new address: ${link}` },
    ru: { subject: 'Смена email · Uspomena', body: (link) => `Подтвердите новый адрес: ${link}` },
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

const ACTIONS = Object.keys(COPY);

/** `email_change_current`/`email_change_new` share the `email_change` copy. */
const baseAction = (action: string): string =>
  action === 'email_change_current' || action === 'email_change_new' ? 'email_change' : action;

export const isKnownAuthAction = (action: string): boolean => ACTIONS.includes(baseAction(action));

const copyFor = (action: string): Record<Language, Copy> => {
  const copy = COPY[baseAction(action)];
  if (!copy) throw new Error(`Unknown auth email action "${action}".`);
  return copy;
};

/** Locale comes from validated auth metadata before a profile exists (UC-77, SYS-6). */
export const resolveAuthEmailLocale = (payload: AuthEmailHookPayload): Language =>
  parseLanguage(payload.user?.user_metadata?.locale ?? 'sr');

export const buildAuthEmail = (payload: AuthEmailHookPayload, fallbackSiteUrl: string): EmailMessage | null => {
  const to = payload.user?.email?.trim();
  const data = payload.email_data;
  const action = data?.email_action_type?.trim();
  if (!to || !data || !action) return null;
  if (!isKnownAuthAction(action)) return null;

  // Our canonical origin (APP_URL) wins: GoTrue reports its own auth base as
  // `site_url` in the payload, which is not where the product callback lives.
  const siteUrl = (fallbackSiteUrl || data.site_url || '').replace(/\/$/, '');
  const redirect = data.redirect_to ? `&next=${encodeURIComponent(data.redirect_to)}` : '';
  const link = `${siteUrl}/auth/callback?token_hash=${data.token_hash ?? ''}&type=${encodeURIComponent(action)}${redirect}`;
  const locale = resolveAuthEmailLocale(payload);
  const copy = copyFor(action)[locale];
  const text = `${copy.body(link)}\n\nUspomena`;

  return {
    to,
    kind: `auth_${action}`,
    subject: copy.subject,
    text,
    html: `<p>${copy.body(link)}</p><p>Uspomena</p>`,
  };
};
