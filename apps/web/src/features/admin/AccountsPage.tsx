'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPhone } from '@uspomena/shared';

import { FormError } from '@/components/auth/AuthShell';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PhoneField } from '@/components/PhoneField';
import { apiFetch } from '@/lib/diagnostics/api';

type AdminWedding = {
  id: string;
  type: 'wedding' | 'celebration';
  occasion: string;
  slug: string;
  partner1: string;
  partner2: string;
  date: string;
  city: string;
  guestCount: number;
  photoCount: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
};

type AdminAccount = {
  id: string;
  email: string;
  name: string;
  phone: string;
  locale: 'sr' | 'en' | 'ru';
  active: boolean;
  onboarded: boolean;
  providers: string[];
  lastLoginAt: string | null;
  createdAt: string;
  wedding: AdminWedding | null;
};

export type AdminCopy = {
  eyebrow: string;
  title: string;
  newAccount: string;
  search: string;
  searchPlaceholder: string;
  filterAria: string;
  filters: { all: string; active: string; inactive: string };
  empty: string;
  emptyFilter: string;
  addFirst: string;
  table: {
    couple: string;
    contact: string;
    date: string;
    usage: string;
    status: string;
    lastLogin: string;
    actions: string;
  };
  type: { wedding: string; celebration: string };
  usage: string;
  status: { active: string; inactive: string };
  neverLoggedIn: string;
  actions: {
    edit: string;
    resetPassword: string;
    deactivate: string;
    activate: string;
    delete: string;
    copy: string;
    copied: string;
  };
  fields: {
    type: string;
    partner1: string;
    partner2: string;
    celebrant: string;
    occasion: string;
    occasionPlaceholder: string;
    date: string;
    celebrationDate: string;
    email: string;
    phone: string;
    password: string;
  };
  modal: {
    newTitle: string;
    editTitle: string;
    create: string;
    save: string;
    cancel: string;
    emailHint: string;
    emailHintCelebration: string;
    passwordPlaceholder: string;
    passwordHint: string;
    phoneWillSave: string;
  };
  loading: string;
  credentials: { createdTitle: string; resetTitle: string; hint: string; copy: string; message: string };
  confirm: {
    resetTitle: string;
    resetText: string;
    deactivateTitle: string;
    deactivateText: string;
    deleteTitle: string;
    deleteText: string;
    reset: string;
    deactivate: string;
    delete: string;
  };
  messages: {
    created: string;
    updated: string;
    deactivated: string;
    activated: string;
    deleted: string;
    password: string;
  };
  common: { close: string; cancel: string };
};

type Draft = {
  type: 'wedding' | 'celebration';
  partner1: string;
  partner2: string;
  occasion: string;
  date: string;
  email: string;
  phone: string;
  password: string;
};

const emptyDraft: Draft = {
  type: 'wedding',
  partner1: '',
  partner2: '',
  occasion: '',
  date: '',
  email: '',
  phone: '',
  password: '',
};

const draftFor = (account: AdminAccount | null): Draft =>
  account?.wedding
    ? {
        type: account.wedding.type,
        partner1: account.wedding.partner1,
        partner2: account.wedding.partner2,
        occasion: account.wedding.occasion,
        date: account.wedding.date,
        email: account.email,
        phone: account.phone,
        password: '',
      }
    : { ...emptyDraft, email: account?.email ?? '', phone: account?.phone ?? '' };

const names = (account: AdminAccount): string => {
  const wedding = account.wedding;
  if (!wedding) return account.name || account.email;
  return wedding.type === 'wedding'
    ? [wedding.partner1, wedding.partner2].filter(Boolean).join(' & ')
    : [wedding.partner1, wedding.occasion].filter(Boolean).join(' · ');
};

const errorMessage = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message ?? `HTTP ${response.status}`;
};

/** Admin account management (UC-71 – UC-76), ported from the prototype's table and modals. */
export function AccountsPage({ copy, appUrl }: { copy: AdminCopy; appUrl: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [draftAccount, setDraftAccount] = useState<AdminAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<{ title: string; email: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'deactivate' | 'delete'; account: AdminAccount } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await apiFetch('/api/admin/accounts');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setError(await errorMessage(response));
      setLoading(false);
      return;
    }
    const body = (await response.json()) as { accounts: AdminAccount[] };
    setAccounts(body.accounts);
    setLoading(false);
  };

  useEffect(() => {
    // The list is loaded once on mount; `load` is also called after every mutation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      all: accounts.length,
      active: accounts.filter((account) => account.active).length,
      inactive: accounts.filter((account) => !account.active).length,
    }),
    [accounts],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts.filter((account) => {
      if (filter === 'active' && !account.active) return false;
      if (filter === 'inactive' && account.active) return false;
      if (!term) return true;
      return [account.email, account.name, account.phone, account.wedding?.slug, account.wedding?.occasion].some(
        (value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(term),
      );
    });
  }, [accounts, q, filter]);

  const submitDraft = async (draft: Draft) => {
    setBusy(true);
    setError(null);
    const celebration = draft.type === 'celebration';
    const payload = {
      type: draft.type,
      partner1: draft.partner1.trim(),
      partner2: celebration ? '' : draft.partner2.trim(),
      occasion: celebration ? draft.occasion.trim() : '',
      date: draft.date,
      email: draft.email.trim(),
      phone: draft.phone,
      ...(draftAccount ? {} : { password: draft.password.trim() || undefined }),
    };
    const response = await apiFetch(draftAccount ? `/api/admin/accounts/${draftAccount.id}` : '/api/admin/accounts', {
      method: draftAccount ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }
    const body = (await response.json()) as { account?: AdminAccount; password?: string };
    setCreating(false);
    setStatus(draftAccount ? copy.messages.updated : copy.messages.created);
    setDraftAccount(null);
    if (!draftAccount && body.password) {
      setCredentials({ title: copy.credentials.createdTitle, email: payload.email, password: body.password });
    }
    await load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    const { kind, account } = confirm;
    let response: Response;
    if (kind === 'reset') {
      response = await apiFetch(`/api/admin/accounts/${account.id}/password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const body = (await response.json().catch(() => ({}))) as { password?: string };
      if (response.ok && body.password) {
        setCredentials({ title: copy.credentials.resetTitle, email: account.email, password: body.password });
        setStatus(copy.messages.password);
      }
    } else if (kind === 'delete') {
      response = await apiFetch(`/api/admin/accounts/${account.id}`, { method: 'DELETE' });
      if (response.ok) setStatus(copy.messages.deleted);
    } else {
      response = await apiFetch(`/api/admin/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !account.active }),
      });
      if (response.ok) setStatus(account.active ? copy.messages.deactivated : copy.messages.activated);
    }
    setBusy(false);
    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }
    setConfirm(null);
    await load();
  };

  const copyCredentials = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(copy.actions.copied);
    } catch {
      setStatus(text);
    }
  };

  return (
    <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <p className="eyebrow">{copy.eyebrow.replace('{{count}}', String(accounts.length))}</p>
          <h1>{copy.title}</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setDraftAccount(null);
            setCreating(true);
          }}
        >
          {copy.newAccount}
        </button>
      </div>

      {error ? <FormError>{error}</FormError> : null}
      {status ? (
        <p className="small" role="status">
          {status}
        </p>
      ) : null}

      <section className="card stack">
        <div className="row between">
          <label className="row grow" style={{ maxWidth: 360 }}>
            <span className="sr-only">{copy.search}</span>
            <input
              className="input"
              placeholder={copy.searchPlaceholder}
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          <div className="chips" role="group" aria-label={copy.filterAria}>
            {(['all', 'active', 'inactive'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {copy.filters[key]} <span className="count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="muted small">{copy.loading}</p>
        ) : visible.length === 0 ? (
          <div className="empty">
            <strong>{accounts.length ? copy.emptyFilter : copy.empty}</strong>
            {!accounts.length ? (
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                {copy.addFirst}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{copy.table.couple}</th>
                  <th>{copy.table.contact}</th>
                  <th>{copy.table.date}</th>
                  <th>{copy.table.usage}</th>
                  <th>{copy.table.status}</th>
                  <th>{copy.table.lastLogin}</th>
                  <th style={{ textAlign: 'right' }}>{copy.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="stack" style={{ '--gap': 0 } as React.CSSProperties}>
                        <strong style={{ fontWeight: 500 }}>{names(account)}</strong>
                        {account.wedding ? (
                          <span className="xs muted">
                            {account.wedding.type === 'celebration'
                              ? account.wedding.occasion || copy.type.celebration
                              : copy.type.wedding}{' '}
                            · /{account.wedding.slug}
                          </span>
                        ) : (
                          <span className="xs muted">{copy.status.inactive}</span>
                        )}
                      </div>
                    </td>
                    <td className="small">
                      <div className="stack" style={{ '--gap': 0 } as React.CSSProperties}>
                        <span>{account.email}</span>
                        <span className="muted">{formatPhone(account.phone)}</span>
                      </div>
                    </td>
                    <td className="small">{account.wedding?.date ?? '—'}</td>
                    <td className="small">
                      {copy.usage
                        .replace('{{guests}}', String(account.wedding?.guestCount ?? 0))
                        .replace('{{photos}}', String(account.wedding?.photoCount ?? 0))}
                    </td>
                    <td>
                      <span className={account.active ? 'badge badge-yes' : 'badge badge-no'}>
                        {account.active ? copy.status.active : copy.status.inactive}
                      </span>
                    </td>
                    <td className="small muted">
                      {account.lastLoginAt ? account.lastLoginAt.slice(0, 10) : copy.neverLoggedIn}
                    </td>
                    <td>
                      <div
                        className="row"
                        style={{ '--gap': '6px', justifyContent: 'flex-end' } as React.CSSProperties}
                      >
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setDraftAccount(account);
                            setCreating(true);
                          }}
                        >
                          {copy.actions.edit}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setConfirm({ kind: 'reset', account })}
                        >
                          {copy.actions.resetPassword}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={async () => {
                            // Activation needs no confirmation (UC-75).
                            if (account.active) return setConfirm({ kind: 'deactivate', account });
                            setBusy(true);
                            const response = await apiFetch(`/api/admin/accounts/${account.id}`, {
                              method: 'PATCH',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ active: true }),
                            });
                            setBusy(false);
                            if (!response.ok) return setError(await errorMessage(response));
                            setStatus(copy.messages.activated);
                            await load();
                          }}
                        >
                          {account.active ? copy.actions.deactivate : copy.actions.activate}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setConfirm({ kind: 'delete', account })}
                        >
                          {copy.actions.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating ? (
        <AccountModal
          copy={copy}
          account={draftAccount}
          busy={busy}
          onClose={() => {
            setCreating(false);
            setDraftAccount(null);
          }}
          onSubmit={submitDraft}
        />
      ) : null}

      {credentials ? (
        <Modal
          title={credentials.title}
          closeLabel={copy.common.close}
          onClose={() => setCredentials(null)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                copyCredentials(
                  copy.credentials.message
                    .replace('{{url}}', `${appUrl}/login`)
                    .replace('{{email}}', credentials.email)
                    .replace('{{password}}', credentials.password),
                )
              }
            >
              {copy.actions.copy}
            </button>
          }
        >
          <p className="small muted">{copy.credentials.hint}</p>
          <p className="small">
            {credentials.email}
            <br />
            <strong>{credentials.password}</strong>
          </p>
        </Modal>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={
            confirm.kind === 'reset'
              ? copy.confirm.resetTitle
              : confirm.kind === 'delete'
                ? copy.confirm.deleteTitle
                : copy.confirm.deactivateTitle
          }
          text={(confirm.kind === 'reset'
            ? copy.confirm.resetText
            : confirm.kind === 'delete'
              ? copy.confirm.deleteText
              : copy.confirm.deactivateText
          ).replace('{{email}}', confirm.account.email)}
          confirmLabel={
            confirm.kind === 'reset'
              ? copy.confirm.reset
              : confirm.kind === 'delete'
                ? copy.confirm.delete
                : confirm.account.active
                  ? copy.confirm.deactivate
                  : copy.actions.activate
          }
          cancelLabel={copy.common.cancel}
          closeLabel={copy.common.close}
          busy={busy}
          destructive={confirm.kind !== 'deactivate' || confirm.account.active}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}

function AccountModal({
  copy,
  account,
  busy,
  onClose,
  onSubmit,
}: {
  copy: AdminCopy;
  account: AdminAccount | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(draftFor(account));
  const celebration = draft.type === 'celebration';
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Modal
      title={account ? copy.modal.editTitle : copy.modal.newTitle}
      closeLabel={copy.common.close}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={onClose}>
            {copy.modal.cancel}
          </button>
          <button type="submit" form="account-form" className="btn btn-primary" disabled={busy}>
            {account ? copy.modal.save : copy.modal.create}
          </button>
        </>
      }
    >
      <form
        id="account-form"
        className="stack"
        style={{ '--gap': '14px' } as React.CSSProperties}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(draft);
        }}
      >
        <fieldset className="stack" style={{ '--gap': '8px', border: 0, padding: 0, margin: 0 } as React.CSSProperties}>
          <legend className="small" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
            {copy.fields.type}
          </legend>
          <div className="chips" role="radiogroup">
            {(['wedding', 'celebration'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className="chip"
                role="radio"
                aria-checked={draft.type === type}
                onClick={() => set({ type })}
              >
                {copy.type[type]}
              </button>
            ))}
          </div>
        </fieldset>

        {celebration ? (
          <div className="row" style={{ alignItems: 'flex-start' } as React.CSSProperties}>
            <label className="field grow">
              <span>{copy.fields.celebrant}</span>
              <input
                className="input"
                required
                value={draft.partner1}
                onChange={(e) => set({ partner1: e.target.value })}
              />
            </label>
            <label className="field grow">
              <span>{copy.fields.occasion}</span>
              <input
                className="input"
                placeholder={copy.fields.occasionPlaceholder}
                value={draft.occasion}
                onChange={(e) => set({ occasion: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className="row" style={{ alignItems: 'flex-start' } as React.CSSProperties}>
            <label className="field grow">
              <span>{copy.fields.partner1}</span>
              <input
                className="input"
                required
                value={draft.partner1}
                onChange={(e) => set({ partner1: e.target.value })}
              />
            </label>
            <label className="field grow">
              <span>{copy.fields.partner2}</span>
              <input
                className="input"
                required
                value={draft.partner2}
                onChange={(e) => set({ partner2: e.target.value })}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>{celebration ? copy.fields.celebrationDate : copy.fields.date}</span>
          <input
            className="input"
            type="date"
            required
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </label>

        <label className="field">
          <span>{copy.fields.email}</span>
          <input
            className="input"
            type="email"
            required
            autoComplete="off"
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
          />
          <span className="xs muted">{celebration ? copy.modal.emailHintCelebration : copy.modal.emailHint}</span>
        </label>

        <PhoneField
          label={copy.fields.phone}
          value={draft.phone}
          onChange={(value) => set({ phone: value })}
          willSaveLabel={copy.modal.phoneWillSave}
          id="admin-account-phone"
        />

        {account ? null : (
          <label className="field">
            <span>{copy.fields.password}</span>
            <input
              className="input"
              type="text"
              autoComplete="off"
              value={draft.password}
              placeholder={copy.modal.passwordPlaceholder}
              onChange={(e) => set({ password: e.target.value })}
            />
            <span className="xs muted">{copy.modal.passwordHint}</span>
          </label>
        )}
      </form>
    </Modal>
  );
}
