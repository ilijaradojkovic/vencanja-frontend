'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanionType, RsvpStatus, maxCompanions } from '@uspomena/shared';
import type { PublicGuest, PublicWedding } from '@uspomena/api/server-only';

import { Icon } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { FormError } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/diagnostics/api';
import { formatDate } from '@/lib/format';
import { eventInitials } from '@/lib/event';
import { InvitationView, envelopeColor } from '@/templates';

const personsAcc = (t: (key: string, params?: Record<string, unknown>) => string, count: number): string =>
  t('common:count.personsAcc', { count });

function LanguageRow({ dark = false }: { dark?: boolean }) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  return <LanguageSwitcher current={locale} dark={dark} label="Jezik" />;
}

/** "Notify me when photos are ready" for the personal link (UC-68) or the QR link (UC-69). */
export function NotifyForm({
  token,
  slug,
  initialEmail,
  accent,
  onDone,
  onSkip,
  submitLabel,
}: {
  token?: string;
  slug?: string;
  initialEmail: string;
  accent: string;
  onDone: (email: string) => void;
  onSkip?: () => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation('invite');
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('notify.invalidEmail'));
    setBusy(true);
    const path = token ? `/api/public/invitations/${token}/notify` : `/api/public/weddings/${slug ?? ''}/notify`;
    const response = await apiFetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return setError(body.message ?? t('common:errors.saveFailed'));
    }
    onDone(email.trim().toLowerCase());
  };

  return (
    <form onSubmit={submit} className="stack" style={{ '--gap': '12px' }}>
      <label className="field">
        <span>{t('auth:fields.email')}</span>
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          placeholder={t('notify.emailPlaceholder')}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />
      </label>
      {error ? <FormError>{error}</FormError> : null}
      <div className="row" style={{ '--gap': '10px' }}>
        <button
          className="btn grow"
          style={accent ? { background: accent, color: '#F6F3EE' } : undefined}
          disabled={busy}
        >
          {submitLabel ?? t('notify.submit')}
        </button>
        {onSkip ? (
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            {t('notify.skip')}
          </button>
        ) : null}
      </div>
      <p className="xs muted">{t('notify.privacy')}</p>
    </form>
  );
}

function RsvpForm({
  token,
  guest,
  deadline,
  accent,
  onSaved,
}: {
  token: string;
  guest: PublicGuest;
  deadline: string | null;
  accent: string;
  onSaved: (guest: PublicGuest) => void;
}) {
  const { t, i18n } = useTranslation('invite');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const answered = guest.rsvp.status !== RsvpStatus.PENDING;
  const max = maxCompanions({ companions: guest.companions });
  const initialCount = guest.rsvp.status === RsvpStatus.YES ? Math.min(guest.rsvp.persons || 1, max + 1) : max + 1;
  const [step, setStep] = useState<'form' | 'done' | 'notify'>(answered ? 'done' : 'form');
  const [status, setStatus] = useState<RsvpStatus | null>(answered ? guest.rsvp.status : null);
  const [count, setCount] = useState(initialCount);
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: Math.max(0, initialCount - 1) }, (_, i) => guest.rsvp.companions?.[i] ?? ''),
  );
  const [picked, setPicked] = useState<string[]>(guest.rsvp.companions ?? []);
  const [note, setNote] = useState(guest.rsvp.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const named = guest.companions.type === CompanionType.NAMED;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!status) return setError(t('rsvp.chooseError'));
    setError(null);
    const companions =
      status !== RsvpStatus.YES ? [] : named ? picked : names.map((name) => name.trim()).filter(Boolean);
    const persons = status !== RsvpStatus.YES ? 0 : named ? 1 + picked.length : max > 0 ? count : 1;

    setBusy(true);
    const response = await apiFetch(`/api/public/invitations/${token}/rsvp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, persons, companions, note }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return setError(body.message ?? t('common:errors.sendFailed'));
    }
    const body = (await response.json()) as { rsvp: PublicGuest['rsvp'] };
    onSaved({ ...guest, rsvp: body.rsvp });
    setStep(guest.notifyEmail ? 'done' : 'notify');
  };

  if (step === 'notify') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    return (
      <div className="stack" style={{ '--gap': '14px' }}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '8px' }}>
          <span style={{ color: accent }}>
            <Icon name="checkCircle" size={44} stroke={1.5} />
          </span>
          <h2>{yes ? t('rsvp.thanksYes') : t('rsvp.thanks')}</h2>
          <p className="muted">{t('rsvp.askNotify')}</p>
        </div>
        <NotifyForm
          token={token}
          initialEmail={guest.prefillEmail}
          accent={accent}
          onDone={(email) => {
            onSaved({ ...guest, notifyEmail: email });
            setStep('done');
          }}
          onSkip={() => setStep('done')}
        />
      </div>
    );
  }

  if (step === 'done') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    const coming = guest.rsvp.companions ?? [];
    return (
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
        <span style={{ color: accent }}>
          <Icon name="checkCircle" size={48} stroke={1.5} />
        </span>
        <h2>{yes ? t('rsvp.seeYou') : t('rsvp.thanks')}</h2>
        <p className="muted">
          {yes ? t('rsvp.confirmedFor', { persons: personsAcc(t, guest.rsvp.persons) }) : t('rsvp.sorry')}
        </p>
        {yes && coming.length > 0 ? (
          <p className="small muted">{t('rsvp.withYou', { names: coming.join(', ') })}</p>
        ) : null}
        {guest.rsvp.note ? <p className="small muted">{t('rsvp.noteValue', { note: guest.rsvp.note })}</p> : null}
        <button type="button" className="btn btn-ghost" onClick={() => setStep('form')}>
          {t('rsvp.edit')}
        </button>
        {guest.notifyEmail ? (
          <p className="xs muted">
            <Icon name="mail" size={14} /> {t('rsvp.willNotifyPhotos', { email: guest.notifyEmail })}
          </p>
        ) : (
          <NotifyForm
            token={token}
            initialEmail={guest.prefillEmail}
            accent={accent}
            submitLabel={t('rsvp.notifyMePhotos')}
            onDone={(email) => onSaved({ ...guest, notifyEmail: email })}
          />
        )}
      </div>
    );
  }

  const pill = (value: RsvpStatus, label: string) => (
    <button
      type="button"
      aria-pressed={status === value}
      onClick={() => setStatus(value)}
      className="btn btn-lg"
      style={
        status === value
          ? { background: accent, color: '#F6F3EE', borderColor: accent }
          : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--line-strong)' }
      }
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="stack" style={{ '--gap': '18px' }}>
      <div className="stack" style={{ '--gap': '4px' }}>
        <h2>{t('rsvp.title')}</h2>
        {deadline ? <p className="small muted">{t('rsvp.deadline', { date: formatDate(deadline, locale) })}</p> : null}
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        role="group"
        aria-label={t('rsvp.attendingAria')}
      >
        {pill(RsvpStatus.YES, t('rsvp.yes'))}
        {pill(RsvpStatus.NO, t('rsvp.no'))}
      </div>

      {status === RsvpStatus.YES && named ? (
        <fieldset
          className="stack"
          style={{
            '--gap': '6px',
            border: 'none',
            padding: '10px 14px',
            margin: 0,
            background: 'var(--bg)',
            borderRadius: 12,
          }}
        >
          <legend className="small" style={{ fontWeight: 500, padding: 0, marginBottom: 4 }}>
            {t('rsvp.whoComes')}
          </legend>
          {guest.companions.names.map((name) => (
            <label key={name} className="check" style={{ minHeight: 0, padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={picked.includes(name)}
                onChange={() =>
                  setPicked(picked.includes(name) ? picked.filter((value) => value !== name) : [...picked, name])
                }
              />
              <span>{name}</span>
            </label>
          ))}
          <span className="xs muted">{t('rsvp.total', { persons: personsAcc(t, 1 + picked.length) })}</span>
        </fieldset>
      ) : null}

      {status === RsvpStatus.YES && !named && max > 0 ? (
        <div
          className="stack"
          style={{ '--gap': '10px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}
        >
          <div className="row between">
            <span>
              {t('rsvp.persons')} <span className="xs muted">{t('rsvp.youPlus', { count: max })}</span>
            </span>
            <div className="row" style={{ '--gap': '14px' }}>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('rsvp.decrease')}
                disabled={count <= 1}
                onClick={() => {
                  const next = count - 1;
                  setCount(next);
                  setNames(Array.from({ length: Math.max(0, next - 1) }, (_, i) => names[i] ?? ''));
                }}
              >
                <Icon name="minus" />
              </button>
              <strong style={{ minWidth: 16, textAlign: 'center', fontSize: 18 }} aria-live="polite">
                {count}
              </strong>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('rsvp.increase')}
                disabled={count >= max + 1}
                onClick={() => {
                  const next = count + 1;
                  setCount(next);
                  setNames(Array.from({ length: Math.max(0, next - 1) }, (_, i) => names[i] ?? ''));
                }}
              >
                <Icon name="plus" />
              </button>
            </div>
          </div>
          {count > 1 ? (
            <div className="stack" style={{ '--gap': '8px' }}>
              <span className="small">
                {t('rsvp.companionNames')} <span className="xs muted">{t('custom.optional')}</span>
              </span>
              {Array.from({ length: count - 1 }, (_, i) => (
                <input
                  key={i}
                  className="input"
                  value={names[i] ?? ''}
                  placeholder={t('rsvp.companionN', { n: i + 1 })}
                  aria-label={t('rsvp.companionNameN', { n: i + 1 })}
                  onChange={(event) =>
                    setNames(names.map((value, index) => (index === i ? event.target.value : value)))
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="field">
        <span>{t('rsvp.note')}</span>
        <textarea className="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      {error ? <FormError>{error}</FormError> : null}
      <button className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }} disabled={busy}>
        {t('rsvp.confirm')}
      </button>
    </form>
  );
}

export function InvitationExperience({
  token,
  initialGuest,
  wedding,
}: {
  token: string;
  initialGuest: PublicGuest;
  wedding: PublicWedding;
}) {
  const { t, i18n } = useTranslation('invite');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const [guest, setGuest] = useState(initialGuest);
  const [opened, setOpened] = useState(false);
  const [animating, setAnimating] = useState(false);
  const accent = envelopeColor(wedding.invitation);

  const open = async () => {
    setAnimating(true);
    void apiFetch(`/api/public/invitations/${token}/opened`, { method: 'POST' });
    setTimeout(() => setOpened(true), 650);
  };

  const galleryStatus = wedding.gallery.open
    ? t('gallery.statusOpen')
    : wedding.gallery.mode === 'after_wedding' && wedding.gallery.opensAt
      ? t('gallery.statusOpensAt', { date: formatDate(wedding.gallery.opensAt, locale) })
      : t('gallery.statusManual');

  if (!opened) {
    const initials = eventInitials(wedding).split('').join('&');
    return (
      <div className="envelope-screen" style={{ background: accent }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <LanguageRow dark />
        </div>
        <p className="eyebrow" style={{ color: 'var(--champagne)' }}>
          {t('envelope.eyebrow')}
        </p>
        <div className={`envelope ${animating ? 'open' : ''}`} aria-hidden="true">
          <div className="body" />
          <svg className="flap" viewBox="0 0 260 106" preserveAspectRatio="none" width="260" height="106">
            <path d="M0 0 H260 L130 106 Z" fill="#EDE5D3" stroke="#D9C9A3" strokeWidth="1.5" />
          </svg>
          <div className="seal">{initials}</div>
        </div>
        <div className="stack" style={{ '--gap': '10px' }}>
          <h1 style={{ fontWeight: 500, fontSize: 42 }}>
            {guest.name},
            <br />
            {t('envelope.invited')}
          </h1>
          <p style={{ color: 'var(--champagne-2)' }}>
            {t('envelope.text', { p1: wedding.partner1, p2: wedding.partner2 })}
          </p>
        </div>
        <button className="btn btn-champagne btn-lg" onClick={open} disabled={animating}>
          {t('envelope.open')}
        </button>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <div className="guest-wrap reveal" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
          <LanguageRow />
        </div>
        <InvitationView wedding={wedding} guestName={guest.name}>
          <section style={{ padding: '8px 16px 0' }}>
            <div className="card" style={{ padding: '26px 20px' }}>
              <RsvpForm
                token={token}
                guest={guest}
                deadline={wedding.rsvpDeadline}
                accent={accent}
                onSaved={setGuest}
              />
            </div>
          </section>
          <section style={{ padding: '20px 16px 48px' }}>
            <div className="card card-cream stack" style={{ '--gap': '12px', padding: '26px 22px' }}>
              <p className="eyebrow">{t('albumOfMemories')}</p>
              {wedding.gallery.open ? (
                <>
                  <h2>{t('album.readyTitle')}</h2>
                  <p style={{ color: 'var(--ink-2)' }}>{t('album.readyText')}</p>
                  <Link
                    href={`/i/${token}/galerija`}
                    className="btn btn-lg"
                    style={{ background: accent, color: '#F6F3EE' }}
                  >
                    <Icon name="image" /> {t('gallery.view')}
                  </Link>
                  <Link href={`/i/${token}/upload`} className="btn btn-outline btn-lg">
                    <Icon name="upload" /> {t('sendPhotos')}
                  </Link>
                  <p className="xs muted">{galleryStatus}</p>
                </>
              ) : (
                <>
                  <h2>{t('album.title')}</h2>
                  <p style={{ color: 'var(--ink-2)' }}>{t('album.text')}</p>
                  <Link
                    href={`/i/${token}/upload`}
                    className="btn btn-lg"
                    style={{ background: 'var(--ink)', color: '#F6F3EE' }}
                  >
                    <Icon name="upload" /> {t('sendPhotos')}
                  </Link>
                  <p className="xs muted">{galleryStatus}</p>
                  {guest.notifyEmail ? (
                    <p className="xs muted">{t('gallery.willNotify', { email: guest.notifyEmail })}</p>
                  ) : (
                    <NotifyForm
                      token={token}
                      initialEmail={guest.prefillEmail}
                      accent={accent}
                      submitLabel={t('gallery.notifyTitle')}
                      onDone={(email) => setGuest({ ...guest, notifyEmail: email })}
                    />
                  )}
                </>
              )}
              <Link href="/" className="btn btn-outline">
                {t('common:actions.close')}
              </Link>
            </div>
          </section>
        </InvitationView>
      </div>
    </div>
  );
}
