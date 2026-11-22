'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormError } from '@/components/auth/AuthShell';
import { loadProfile, signOut, type AuthProfile, type AuthResult } from '@/lib/auth/actions';
import { apiFetch } from '@/lib/diagnostics/api';

export type OnboardingCopy = {
  title: string;
  intro: string;
  step: string;
  typeTitle: string;
  wedding: string;
  celebration: string;
  namesTitle: string;
  contactTitle: string;
  phoneHint: string;
  back: string;
  next: string;
  finish: string;
  logout: string;
  error: string;
  fields: {
    partner1: string;
    partner2: string;
    celebrant: string;
    occasion: string;
    occasionPlaceholder: string;
    weddingDate: string;
    celebrationDate: string;
    phone: string;
    city: string;
    cityPlaceholder: string;
  };
};

type Draft = {
  type: 'wedding' | 'celebration';
  partner1: string;
  partner2: string;
  occasion: string;
  date: string;
  phone: string;
  city: string;
};

export type OnboardingResult = { ok: boolean; message?: string };

const EMPTY: Draft = { type: 'wedding', partner1: '', partner2: '', occasion: '', date: '', phone: '', city: '' };
const TOTAL_STEPS = 3;

/**
 * UC-81 onboarding wizard: type → names and date → contact. "Back" keeps what was
 * entered, the data is validated again by `POST /api/onboarding`, and finishing
 * lands on the dashboard. Sign-out is available at every step.
 */
export function OnboardingWizard({
  copy,
  onLoadProfile = loadProfile,
  onSubmit,
  onDone,
  onSignOut = signOut,
}: {
  copy: OnboardingCopy;
  onLoadProfile?: () => Promise<AuthResult>;
  onSubmit?: (payload: Draft, profile: AuthProfile | null) => Promise<OnboardingResult>;
  onDone?: (path: string) => void;
  onSignOut?: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const run = async () => {
      const result = await onLoadProfile();
      if (!active) return;
      if (!result.ok) {
        router.push('/login');
        return;
      }
      setProfile(result.profile);
      if (result.profile.role === 'superadmin') router.push('/admin');
      else if (result.profile.onboardedAt) router.push('/app');
    };
    void run();
    return () => {
      active = false;
    };
  }, [onLoadProfile, router]);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const goDone = (path: string) => {
    if (onDone) return onDone(path);
    router.push(path);
    router.refresh();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload: Draft = {
      ...draft,
      partner1: draft.partner1.trim(),
      partner2: draft.partner2.trim(),
      occasion: draft.occasion.trim(),
      city: draft.city.trim(),
    };
    const result = onSubmit ? await onSubmit(payload, profile) : await postOnboarding(payload);
    setBusy(false);
    if (!result.ok) return setError(result.message ?? copy.error);
    goDone('/app');
  };

  return (
    <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
      <div className="row between">
        <span className="eyebrow">
          {copy.step.replace('{{current}}', String(step + 1)).replace('{{total}}', String(TOTAL_STEPS))}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={async () => {
            try {
              await onSignOut();
            } finally {
              router.push('/login');
              router.refresh();
            }
          }}
        >
          {copy.logout}
        </button>
      </div>

      {error ? <FormError>{error}</FormError> : null}

      {step === 0 ? (
        <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <h2 style={{ fontSize: 26 }}>{copy.typeTitle}</h2>
          <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            {(['wedding', 'celebration'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className="chip"
                aria-pressed={draft.type === type}
                onClick={() => update({ type })}
              >
                {copy[type]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: 26 }}>{copy.namesTitle}</h2>
          <label className="field">
            <span>{draft.type === 'wedding' ? copy.fields.partner1 : copy.fields.celebrant}</span>
            <input
              className="input"
              value={draft.partner1}
              onChange={(event) => update({ partner1: event.target.value })}
            />
          </label>
          {draft.type === 'wedding' ? (
            <label className="field">
              <span>{copy.fields.partner2}</span>
              <input
                className="input"
                value={draft.partner2}
                onChange={(event) => update({ partner2: event.target.value })}
              />
            </label>
          ) : (
            <label className="field">
              <span>{copy.fields.occasion}</span>
              <input
                className="input"
                placeholder={copy.fields.occasionPlaceholder}
                value={draft.occasion}
                onChange={(event) => update({ occasion: event.target.value })}
              />
            </label>
          )}
          <label className="field">
            <span>{draft.type === 'wedding' ? copy.fields.weddingDate : copy.fields.celebrationDate}</span>
            <input
              className="input"
              type="date"
              value={draft.date}
              onChange={(event) => update({ date: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: 26 }}>{copy.contactTitle}</h2>
          <label className="field">
            <span>{copy.fields.phone}</span>
            <input
              className="input"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => update({ phone: event.target.value })}
            />
            <span className="xs muted">{copy.phoneHint}</span>
          </label>
          <label className="field">
            <span>{copy.fields.city}</span>
            <input
              className="input"
              placeholder={copy.fields.cityPlaceholder}
              value={draft.city}
              onChange={(event) => update({ city: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
        {step > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={busy}>
            {copy.back}
          </button>
        ) : null}
        {step < TOTAL_STEPS - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {copy.next}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {copy.finish}
          </button>
        )}
      </div>
    </div>
  );
}

/** The real submission goes through the API, which re-validates and enforces 409. */
const postOnboarding = async (payload: Draft): Promise<OnboardingResult> => {
  const response = await apiFetch('/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.ok) return { ok: true };
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: body.message };
};
