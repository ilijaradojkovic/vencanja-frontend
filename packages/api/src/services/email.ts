import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../env.ts';

/**
 * Email boundary (SPEC §3.3): local development and all M0–M6 flows use SMTP to
 * the Mailpit mailbox from the Supabase CLI; production switches to Resend in M5.
 * An unknown `EMAIL_DRIVER` fails closed instead of silently dropping mail.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable kind for logs and the email log table (`auth_signup`, …). */
  kind: string;
};

export type EmailSender = {
  send(message: EmailMessage): Promise<{ providerId: string | null }>;
};

let transporter: Transporter | null = null;
let testSender: EmailSender | null = null;

const smtpSender = (): EmailSender => ({
  async send(message) {
    transporter ??= nodemailer.createTransport(env.smtpUrl());
    const info = await transporter.sendMail({
      from: env.emailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { providerId: info.messageId ?? null };
  },
});

export const getEmailSender = (): EmailSender => {
  const driver = env.emailDriver();
  if (driver === 'smtp') return smtpSender();
  throw new Error(`EMAIL_DRIVER "${driver}" is not available in this milestone; use "smtp" locally.`);
};

/** Test double at the documented boundary; tests never open an SMTP connection. */
export const setEmailSenderForTests = (sender: EmailSender | null): void => {
  testSender = sender;
};

export const emailSender = (): EmailSender => testSender ?? getEmailSender();
