'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GuestSide } from '@uspomena/shared';

import { Icon } from '@/components/Icon';
import { FormError } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/diagnostics/api';
import { formatDate } from '@/lib/format';
import { INVITATION_TEMPLATES, getInvitationTemplate, InvitationView } from '@/templates';
import type { InvitationWedding, ScheduleItem } from '@/templates/shared';

type Wedding = InvitationWedding & {
  id: string;
  type: 'wedding' | 'celebration';
  slug: string;
  city: string;
  rsvpDeadline: string | null;
};

type Draft = {
  partner1: string;
  partner2: string;
  occasion: string;
  date: string;
  city: string;
  slug: string;
  invitation: Wedding['invitation'];
};

const draftOf = (wedding: Wedding): Draft => ({
  partner1: wedding.partner1,
  partner2: wedding.partner2 ?? '',
  occasion: wedding.occasion ?? '',
  date: wedding.date,
  city: wedding.city,
  slug: wedding.slug,
  invitation: {
    templateId: wedding.invitation.templateId,
    accentColor: wedding.invitation.accentColor,
    headline: wedding.invitation.headline,
    message: wedding.invitation.message,
    schedule: wedding.invitation.schedule.map((item) => ({ ...item })),
  },
});

const errorOf = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message ?? `HTTP ${response.status}`;
};

/**
 * Invitation editor (UC-27 – UC-32): choose one of the 11 looks, change the accent,
 * headline, message and schedule with a live preview rendered by the same template
 * components the guest sees, then save through `PATCH /weddings/:id`.
 */
export function InvitationEditor({ sampleGuestName }: { sampleGuestName?: string }) {
  const { t, i18n } = useTranslation('invite');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await apiFetch('/api/weddings/current');
      if (!response.ok) return setError(await errorOf(response));
      const body = (await response.json()) as { wedding: Wedding };
      setWedding(body.wedding);
      setDraft(draftOf(body.wedding));
    };
    void load();
  }, []);

  const dirty = useMemo(
    () => Boolean(wedding && draft) && JSON.stringify(draftOf(wedding as Wedding)) !== JSON.stringify(draft),
    [wedding, draft],
  );

  if (!wedding || !draft) {
    return error ? <FormError>{error}</FormError> : <p className="muted">{t('common:actions.loading')}…</p>;
  }

  const celebration = wedding.type === 'celebration';
  const template = getInvitationTemplate(draft.invitation.templateId);
  const previewWedding: InvitationWedding = { ...wedding, ...draft };

  const setInvitation = (patch: Partial<Draft['invitation']>) =>
    setDraft({ ...draft, invitation: { ...draft.invitation, ...patch } });

  const chooseTemplate = (id: string) => {
    const next = getInvitationTemplate(id);
    setInvitation({
      templateId: id,
      accentColor:
        next.accents.length && !next.accents.includes(draft.invitation.accentColor)
          ? next.accents[0]
          : draft.invitation.accentColor,
    });
  };

  const setSchedule = (index: number, patch: Partial<ScheduleItem>) =>
    setInvitation({
      schedule: draft.invitation.schedule.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    const payload: Record<string, unknown> = {
      date: draft.date,
      city: draft.city,
      slug: draft.slug,
      invitation: draft.invitation,
    };
    if (celebration) {
      payload.partner1 = draft.partner1;
      payload.occasion = draft.occasion;
    } else {
      payload.partner1 = draft.partner1;
      payload.partner2 = draft.partner2;
    }
    const response = await apiFetch(`/api/weddings/${wedding.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) return setError(await errorOf(response));
    const body = (await response.json()) as { wedding: Wedding };
    setWedding(body.wedding);
    setDraft(draftOf(body.wedding));
    setStatus(t('editor.saved'));
  };

  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('editor.eyebrow')}</p>
          <h1>{t('editor.title')}</h1>
        </div>
        <div className="row" style={{ '--gap': '8px' }}>
          {sampleGuestName ? (
            <a className="btn btn-outline" href="/app/gosti">
              <Icon name="eye" size={18} /> {t('editor.openAsGuest')}
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-soft"
            disabled={!dirty || busy}
            onClick={() => setDraft(draftOf(wedding))}
          >
            {t('editor.reset')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>
            {busy ? t('common:actions.loading') : dirty ? t('editor.saveChanges') : t('editor.savedState')}
          </button>
        </div>
      </div>

      {error ? <FormError>{error}</FormError> : null}
      {status ? (
        <p className="small" role="status">
          {status}
        </p>
      ) : null}

      <div className="two-col">
        <div className="main stack" style={{ '--gap': '18px' }}>
          <section className="card stack">
            <div className="stack" style={{ '--gap': '2px' }}>
              <h2>{t('editor.look')}</h2>
              <p className="xs muted">{t('editor.lookHint')}</p>
            </div>
            <div className="grid-cards" role="radiogroup" aria-label={t('editor.templateAria')}>
              {INVITATION_TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.invitation.templateId === item.id}
                  className="card card-tight stack"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: draft.invitation.templateId === item.id ? 'var(--green)' : 'var(--line)',
                    boxShadow: draft.invitation.templateId === item.id ? '0 0 0 2px rgba(45,74,62,0.2)' : undefined,
                  }}
                  onClick={() => chooseTemplate(item.id)}
                >
                  <strong style={{ fontWeight: 500 }}>{t(`templates:items.${item.id}.name`)}</strong>
                  <span className="xs muted">{t(`templates:items.${item.id}.description`)}</span>
                  <span className="row" style={{ '--gap': '4px' }}>
                    {(item.accents.length ? item.accents : [item.envelope ?? '#2D4A3E']).map((color) => (
                      <span key={color} style={{ width: 14, height: 14, borderRadius: '50%', background: color }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="stack" style={{ '--gap': '8px' }}>
              <span className="small">{t('editor.accent')}</span>
              {template.accents.length ? (
                <div className="chips" role="group" aria-label={t('editor.colorAria')}>
                  {template.accents.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="icon-btn"
                      aria-pressed={draft.invitation.accentColor === color}
                      aria-label={t('editor.colorValue', { color })}
                      style={{
                        background: color,
                        borderColor: draft.invitation.accentColor === color ? 'var(--ink)' : 'transparent',
                        boxShadow: draft.invitation.accentColor === color ? '0 0 0 2px var(--ink)' : undefined,
                      }}
                      onClick={() => setInvitation({ accentColor: color })}
                    />
                  ))}
                </div>
              ) : (
                <p className="xs muted">{t('editor.ownPalette')}</p>
              )}
            </div>
          </section>

          <section className="card stack">
            <h2>{t('editor.textAndDate')}</h2>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field grow">
                <span>
                  {celebration ? t('auth:fields.celebrant', { defaultValue: 'Slavljenik' }) : t('auth:fields.partner1')}
                </span>
                <input
                  className="input"
                  value={draft.partner1}
                  onChange={(event) => setDraft({ ...draft, partner1: event.target.value })}
                />
              </label>
              {celebration ? (
                <label className="field grow">
                  <span>{t('auth:fields.occasion')}</span>
                  <input
                    className="input"
                    value={draft.occasion}
                    placeholder={t('auth:fields.occasionPlaceholder')}
                    onChange={(event) => setDraft({ ...draft, occasion: event.target.value })}
                  />
                </label>
              ) : (
                <label className="field grow">
                  <span>{t('auth:fields.partner2')}</span>
                  <input
                    className="input"
                    value={draft.partner2}
                    onChange={(event) => setDraft({ ...draft, partner2: event.target.value })}
                  />
                </label>
              )}
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field grow">
                <span>{celebration ? t('auth:fields.celebrationDate') : t('auth:fields.weddingDate')}</span>
                <input
                  className="input"
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                />
              </label>
              <label className="field grow">
                <span>{t('auth:fields.city')}</span>
                <input
                  className="input"
                  value={draft.city}
                  onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                />
              </label>
              <label className="field grow">
                <span>{t('settings:wedding.slug')}</span>
                <input
                  className="input"
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>{t('editor.headline')}</span>
              <input
                className="input"
                value={draft.invitation.headline}
                onChange={(event) => setInvitation({ headline: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{t('editor.message')}</span>
              <textarea
                className="textarea"
                rows={3}
                value={draft.invitation.message}
                onChange={(event) => setInvitation({ message: event.target.value })}
              />
            </label>
          </section>

          <section className="card stack">
            <div className="row between">
              <h2>{t('templates:schedule')}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setInvitation({
                    schedule: [...draft.invitation.schedule, { time: '20:00', title: '', place: '', mapUrl: '' }],
                  })
                }
              >
                <Icon name="plus" size={16} /> {t('editor.add')}
              </button>
            </div>
            {draft.invitation.schedule.map((item, index) => (
              <div
                key={item.id ?? index}
                className="stack"
                style={{ '--gap': '10px', padding: 14, borderRadius: 12, background: 'var(--bg)' }}
              >
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ width: 120 }}>
                    <span>{t('editor.time')}</span>
                    <input
                      className="input"
                      type="time"
                      value={item.time}
                      onChange={(event) => setSchedule(index, { time: event.target.value })}
                    />
                  </label>
                  <label className="field grow">
                    <span>{t('editor.eventTitle')}</span>
                    <input
                      className="input"
                      value={item.title}
                      placeholder={t('editor.eventTitlePlaceholder')}
                      onChange={(event) => setSchedule(index, { title: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('editor.removeItem', { n: index + 1 })}
                    onClick={() => setInvitation({ schedule: draft.invitation.schedule.filter((_, i) => i !== index) })}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <label className="field">
                  <span>{t('editor.place')}</span>
                  <input
                    className="input"
                    value={item.place ?? ''}
                    placeholder={t('editor.placePlaceholder')}
                    onChange={(event) => setSchedule(index, { place: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{t('editor.mapUrl')}</span>
                  <input
                    className="input"
                    type="url"
                    value={item.mapUrl ?? ''}
                    placeholder="https://maps.google.com/…"
                    onChange={(event) => setSchedule(index, { mapUrl: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </section>
        </div>

        <div className="side" style={{ position: 'sticky', top: 20 }}>
          <p className="small muted" style={{ marginBottom: 10, textAlign: 'center' }}>
            {sampleGuestName ? t('editor.previewAs', { name: sampleGuestName }) : t('editor.preview')}
          </p>
          <div
            className="no-scrollbar"
            style={{
              maxWidth: 400,
              margin: '0 auto',
              height: 'min(760px, 80vh)',
              overflowY: 'auto',
              borderRadius: 32,
              border: '10px solid var(--ink)',
              boxShadow: 'var(--shadow)',
              background: '#fff',
            }}
          >
            <InvitationView wedding={previewWedding} guestName={sampleGuestName}>
              <div style={{ padding: '8px 16px 32px' }}>
                <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
                  <h3>{t('rsvp.title')}</h3>
                  <span className="xs muted">{t('editor.rsvpPreview')}</span>
                </div>
              </div>
            </InvitationView>
          </div>
          <p className="xs muted" style={{ textAlign: 'center', marginTop: 10 }}>
            {formatDate(draft.date, locale)} · {previewWedding.partner1}
            {!celebration && previewWedding.partner2 ? ` & ${previewWedding.partner2}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export type { GuestSide };
