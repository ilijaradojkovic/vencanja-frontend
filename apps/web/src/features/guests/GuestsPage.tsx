'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanionType, GuestSide, RsvpStatus, type CompanionSet, type GuestSide as Side } from '@uspomena/shared';

import { Icon } from '@/components/Icon';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { PhoneField } from '@/components/PhoneField';
import { FormError } from '@/components/auth/AuthShell';
import { apiFetch } from '@/lib/diagnostics/api';
import { formatDate } from '@/lib/format';

type Guest = {
  id: string;
  name: string;
  token: string;
  email: string;
  phone: string;
  side: Side;
  companions: CompanionSet;
  maxPersons: number;
  openedAt: string | null;
  rsvp: { status: RsvpStatus; persons: number; companions: string[]; note: string; respondedAt: string | null };
  photoNotify: { email: string; requestedAt: string | null; sentAt: string | null };
};

type Wedding = {
  id: string;
  slug: string;
  partner1: string;
  partner2: string;
  type: 'wedding' | 'celebration';
  occasion: string;
};

type Draft = {
  name: string;
  email: string;
  phone: string;
  side: Side;
  companionType: CompanionType;
  max: number;
  names: string[];
  rsvpStatus: RsvpStatus;
  rsvpPersons: number;
  rsvpCompanions: string[];
  rsvpNote: string;
};

const draftFrom = (guest: Guest | null): Draft => ({
  name: guest?.name ?? '',
  email: guest?.email ?? '',
  phone: guest?.phone ?? '',
  side: guest?.side ?? 'zajednicki',
  companionType: guest?.companions.type ?? CompanionType.NONE,
  max: guest?.companions.max || 1,
  names: guest?.companions.names.length ? guest.companions.names : [''],
  rsvpStatus: guest?.rsvp.status ?? RsvpStatus.PENDING,
  rsvpPersons: guest?.rsvp.persons || 1,
  rsvpCompanions: guest?.rsvp.companions ?? [],
  rsvpNote: guest?.rsvp.note ?? '',
});

const errorOf = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message ?? `HTTP ${response.status}`;
};

/**
 * Guests and personal links (UC-17 – UC-26): table with search/side/RSVP filters
 * and paging, add/edit with companion rules and a manual answer, import, CSV,
 * copy link/WhatsApp/open-as-guest and delete.
 */
export function GuestsPage() {
  const { t, i18n } = useTranslation('guests');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [side, setSide] = useState<'all' | Side>('all');
  const [reply, setReply] = useState<'all' | RsvpStatus>('all');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const load = async () => {
    const current = await apiFetch('/api/weddings/current');
    if (!current.ok) {
      setError(await errorOf(current));
      setLoading(false);
      return;
    }
    const body = (await current.json()) as { wedding: Wedding };
    setWedding(body.wedding);
    const list = await apiFetch(`/api/weddings/${body.wedding.id}/guests`);
    if (list.ok) setGuests(((await list.json()) as { guests: Guest[] }).guests);
    else setError(await errorOf(list));
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const counts = useMemo(
    () => ({
      all: guests.length,
      yes: guests.filter((guest) => guest.rsvp.status === 'yes').length,
      pending: guests.filter((guest) => guest.rsvp.status === 'pending').length,
      no: guests.filter((guest) => guest.rsvp.status === 'no').length,
    }),
    [guests],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return guests.filter((guest) => {
      if (side !== 'all' && guest.side !== side) return false;
      if (reply !== 'all' && guest.rsvp.status !== reply) return false;
      if (!term) return true;
      return [guest.name, guest.email, guest.phone, guest.companions.names.join(' ')].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(term),
      );
    });
  }, [guests, search, side, reply]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = visible.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const guestLink = (guest: Guest) => `${origin}/i/${guest.token}`;

  const save = async (draft: Draft) => {
    if (!wedding) return;
    setBusy(true);
    setError(null);
    const companions =
      draft.companionType === CompanionType.NAMED
        ? { type: 'named', max: 0, names: draft.names.map((name) => name.trim()).filter(Boolean) }
        : draft.companionType === CompanionType.OPEN
          ? { type: 'open', max: draft.max, names: [] }
          : { type: 'none', max: 0, names: [] };
    if (draft.companionType === CompanionType.NAMED && companions.names.length === 0) {
      setBusy(false);
      return setError(t('modal.namedRequired'));
    }
    if (draft.companionType === CompanionType.OPEN && (draft.max < 1 || draft.max > 19)) {
      setBusy(false);
      return setError(t('modal.maxRange'));
    }
    if (!draft.name.trim()) {
      setBusy(false);
      return setError(t('modal.nameRequired'));
    }

    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone,
      side: draft.side,
      companions,
    };
    if (editing) {
      const invitedNames = companions.type === 'named' ? companions.names : [];
      const maxPersons =
        companions.type === 'open' ? companions.max + 1 : companions.type === 'named' ? 1 + invitedNames.length : 1;
      const coming =
        companions.type === 'named'
          ? draft.rsvpCompanions.filter((name) => invitedNames.includes(name))
          : draft.rsvpCompanions.slice(0, maxPersons - 1);
      payload.rsvp = {
        status: draft.rsvpStatus,
        persons: draft.rsvpStatus === 'yes' ? Math.min(draft.rsvpPersons, maxPersons) : 0,
        companions: draft.rsvpStatus === 'yes' ? coming : [],
        note: draft.rsvpNote,
      };
    }

    const response = await apiFetch(editing ? `/api/guests/${editing.id}` : `/api/weddings/${wedding.id}/guests`, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) return setError(await errorOf(response));
    setModalOpen(false);
    setEditing(null);
    setStatus(editing ? t('modal.saved') : t('modal.added'));
    await load();
  };

  const importGuests = async (rows: string) => {
    if (!wedding) return;
    const parsed = rows
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, persons, phone] = line.split(/[;\t,]/).map((part) => part?.trim() ?? '');
        return { name, maxPersons: Number(persons) || 1, phone: phone || '' };
      })
      .filter((row) => row.name);
    if (parsed.length === 0) return;
    setBusy(true);
    setError(null);
    const response = await apiFetch(`/api/weddings/${wedding.id}/guests/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guests: parsed }),
    });
    setBusy(false);
    if (!response.ok) return setError(await errorOf(response));
    const body = (await response.json()) as { guests: Guest[] };
    setStatus(t('import.done', { count: body.guests.length }));
    setImportOpen(false);
    await load();
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    const response = await apiFetch(`/api/guests/${deleting.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) return setError(await errorOf(response));
    setDeleting(null);
    setStatus(t('deleted'));
    await load();
  };

  const copyLink = async (guest: Guest) => {
    try {
      await navigator.clipboard.writeText(guestLink(guest));
      setStatus(t('common:actions.copied'));
    } catch {
      setStatus(guestLink(guest));
    }
  };

  const whatsapp = (guest: Guest) => {
    const text = t('whatsappInvite', {
      name: guest.name,
      link: guestLink(guest),
      p1: wedding?.partner1 ?? '',
      p2: wedding?.partner2 ?? '',
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const exportCsv = () => {
    const header = [
      t('csv.name'),
      t('csv.side'),
      t('csv.companions'),
      t('csv.invitedCompanions'),
      t('csv.maxPersons'),
      t('csv.status'),
      t('csv.persons'),
      t('csv.comingCompanions'),
      t('csv.note'),
      t('csv.phone'),
      t('csv.email'),
      t('csv.notifyEmail'),
      t('csv.notifiedAt'),
      t('csv.link'),
    ];
    const lines = guests.map((guest) =>
      [
        guest.name,
        t(`common:side.${guest.side}`),
        t(`csv.companionType.${guest.companions.type}`),
        guest.companions.names.join(', '),
        guest.maxPersons,
        t(`common:rsvp.${guest.rsvp.status}`),
        guest.rsvp.persons,
        guest.rsvp.companions.join(', '),
        guest.rsvp.note,
        guest.phone,
        guest.email,
        guest.photoNotify.email,
        guest.photoNotify.sentAt ?? '',
        guestLink(guest),
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(';'),
    );
    const csv = `\uFEFF${[header.join(';'), ...lines].join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('csv.fileName')}-${wedding?.slug ?? 'uspomena'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="muted">{t('common:actions.loading')}…</p>;

  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('dashboard:stats.invitations', { count: guests.length })}</p>
          <h1>{t('title')}</h1>
        </div>
        <div className="row" style={{ '--gap': '8px' }}>
          <button type="button" className="btn btn-soft" onClick={exportCsv} disabled={guests.length === 0}>
            <Icon name="download" size={16} /> CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={16} /> {t('importList')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Icon name="plus" size={18} /> {t('newGuest')}
          </button>
        </div>
      </div>

      {error ? <FormError>{error}</FormError> : null}
      {status ? (
        <p className="small" role="status">
          {status}
        </p>
      ) : null}

      <section className="card stack">
        <div className="row between">
          <label className="row grow" style={{ maxWidth: 320 }}>
            <span className="sr-only">{t('search')}</span>
            <input
              className="input"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <div className="row" style={{ '--gap': '8px' }}>
            <select
              className="select"
              aria-label={t('sideAria')}
              value={side}
              onChange={(event) => {
                setSide(event.target.value as 'all' | Side);
                setPage(0);
              }}
            >
              <option value="all">{t('allSides')}</option>
              {Object.values(GuestSide).map((value) => (
                <option key={value} value={value}>
                  {t(`common:side.${value}`)}
                </option>
              ))}
            </select>
            <div className="chips" role="group" aria-label={t('filterAria')}>
              {(['all', 'yes', 'pending', 'no'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={reply === value}
                  onClick={() => {
                    setReply(value);
                    setPage(0);
                  }}
                >
                  {t(`filters.${value}`)} <span className="count">{counts[value]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <strong>{guests.length ? t('emptyFilter') : t('empty')}</strong>
            {!guests.length ? (
              <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
                {t('addFirst')}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.guest')}</th>
                  <th>{t('table.side')}</th>
                  <th>{t('table.reply')}</th>
                  <th>{t('table.coming')}</th>
                  <th>{t('table.invitation')}</th>
                  <th>{t('table.photos')}</th>
                  <th style={{ textAlign: 'right' }}>{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      <div className="stack" style={{ '--gap': 0 }}>
                        <strong style={{ fontWeight: 500 }}>{guest.name}</strong>
                        {guest.rsvp.note ? <span className="xs muted">{guest.rsvp.note}</span> : null}
                        {guest.companions.type === 'named' ? (
                          <span className="xs muted">
                            {guest.rsvp.status === 'yes' && guest.rsvp.companions.length
                              ? t('companionsComing', { names: guest.rsvp.companions.join(', ') })
                              : t('companionsInvited', { names: guest.companions.names.join(', ') })}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="small">{t(`common:side.${guest.side}`)}</td>
                    <td>
                      <span className={`badge badge-${guest.rsvp.status === 'yes' ? 'yes' : guest.rsvp.status}`}>
                        {t(`common:rsvp.${guest.rsvp.status}`)}
                      </span>
                    </td>
                    <td className="small">
                      {guest.rsvp.status === 'yes'
                        ? `${guest.rsvp.persons} / ${guest.maxPersons}`
                        : `– / ${guest.maxPersons}`}
                    </td>
                    <td className="small">{guest.openedAt ? t('opened') : t('notOpened')}</td>
                    <td className="small">
                      {!guest.photoNotify.email
                        ? '–'
                        : guest.photoNotify.sentAt
                          ? t('notify.sent', { date: formatDate(guest.photoNotify.sentAt, locale) })
                          : t('notify.waiting')}
                    </td>
                    <td>
                      <div className="row" style={{ '--gap': '4px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          title={t('link')}
                          aria-label={t('link')}
                          onClick={() => copyLink(guest)}
                        >
                          <Icon name="link" size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          aria-label={t('aria.whatsapp', { name: guest.name })}
                          onClick={() => whatsapp(guest)}
                        >
                          <Icon name="whatsapp" size={16} />
                        </button>
                        <a
                          className="icon-btn icon-btn-sm"
                          aria-label={t('aria.openInvitation', { name: guest.name })}
                          href={`/i/${guest.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name="eye" size={16} />
                        </a>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          aria-label={t('aria.edit', { name: guest.name })}
                          onClick={() => {
                            setEditing(guest);
                            setModalOpen(true);
                          }}
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          aria-label={t('aria.delete', { name: guest.name })}
                          onClick={() => setDeleting(guest)}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row between" style={{ paddingTop: 8 }}>
              <span className="small muted">
                {currentPage + 1} / {pageCount}
              </span>
              <div className="row" style={{ '--gap': '8px' }}>
                <select
                  className="select"
                  aria-label="page size"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={t('common:actions.previous')}
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <Icon name="chevronLeft" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={t('common:actions.next')}
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {modalOpen ? (
        <GuestModal
          guest={editing}
          busy={busy}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={save}
        />
      ) : null}

      {importOpen ? <ImportModal busy={busy} onClose={() => setImportOpen(false)} onImport={importGuests} /> : null}

      {deleting ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          text={t('deleteText', { name: deleting.name })}
          confirmLabel={t('common:actions.delete')}
          cancelLabel={t('common:actions.cancel')}
          closeLabel={t('common:actions.close')}
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

function GuestModal({
  guest,
  busy,
  onClose,
  onSave,
}: {
  guest: Guest | null;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const { t } = useTranslation('guests');
  const [draft, setDraft] = useState<Draft>(() => draftFrom(guest));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const named = draft.companionType === 'named';
  const open = draft.companionType === 'open';

  return (
    <Modal
      title={guest ? t('modal.editTitle') : t('newGuest')}
      closeLabel={t('common:actions.close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={onClose}>
            {t('common:actions.cancel')}
          </button>
          <button type="submit" form="guest-form" className="btn btn-primary" disabled={busy}>
            {t('common:actions.save')}
          </button>
        </>
      }
    >
      <form
        id="guest-form"
        className="stack"
        style={{ '--gap': '14px' }}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(draft);
        }}
      >
        <label className="field">
          <span>{t('modal.name')}</span>
          <input
            className="input"
            required
            value={draft.name}
            placeholder={t('modal.namePlaceholder')}
            onChange={(event) => set({ name: event.target.value })}
          />
        </label>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <label className="field grow">
            <span>{t('common:fields.email')}</span>
            <input
              className="input"
              type="email"
              value={draft.email}
              onChange={(event) => set({ email: event.target.value })}
            />
          </label>
          <div className="field grow">
            <PhoneField
              label={t('modal.phone')}
              value={draft.phone}
              onChange={(value) => set({ phone: value })}
              willSaveLabel={t('auth:phone.willSave')}
              id="guest-phone"
            />
          </div>
        </div>
        <label className="field">
          <span>{t('table.side')}</span>
          <select className="select" value={draft.side} onChange={(event) => set({ side: event.target.value as Side })}>
            {Object.values(GuestSide).map((value) => (
              <option key={value} value={value}>
                {t(`common:side.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="stack" style={{ '--gap': '6px', border: 'none', padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
            {t('modal.companions')}
          </legend>
          {(Object.values(CompanionType) as CompanionType[]).map((type) => (
            <label key={type} className="check">
              <input
                type="radio"
                name="companionType"
                checked={draft.companionType === type}
                onChange={() => set({ companionType: type })}
              />
              <span>
                {t(`modal.companionTypes.${type}.label`)}
                <br />
                <span className="xs muted">{t(`modal.companionTypes.${type}.hint`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {open ? (
          <label className="field" style={{ maxWidth: 160 }}>
            <span>{t('modal.maxCompanions')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={19}
              value={draft.max}
              onChange={(event) => set({ max: Number(event.target.value) })}
            />
          </label>
        ) : null}

        {named ? (
          <div className="stack" style={{ '--gap': '8px' }}>
            <span className="small">{t('modal.companionNames')}</span>
            {draft.names.map((name, index) => (
              <div key={index} className="row">
                <input
                  className="input grow"
                  value={name}
                  placeholder={t('modal.companionPlaceholder')}
                  aria-label={t('modal.companionPlaceholder')}
                  onChange={(event) =>
                    set({ names: draft.names.map((value, i) => (i === index ? event.target.value : value)) })
                  }
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={t('modal.removeCompanion', { n: index + 1 })}
                  onClick={() => set({ names: draft.names.filter((_, i) => i !== index) })}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => set({ names: [...draft.names, ''] })}
            >
              <Icon name="plus" size={16} /> {t('modal.addCompanion')}
            </button>
          </div>
        ) : null}

        {guest ? (
          <fieldset className="stack" style={{ '--gap': '8px', border: 'top', paddingTop: 10 }}>
            <legend className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
              {t('modal.manualReply')}
            </legend>
            <label className="field">
              <span>{t('modal.status')}</span>
              <select
                className="select"
                value={draft.rsvpStatus}
                onChange={(event) => set({ rsvpStatus: event.target.value as RsvpStatus })}
              >
                {Object.values(RsvpStatus).map((value) => (
                  <option key={value} value={value}>
                    {t(`common:rsvp.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {draft.rsvpStatus === 'yes' && draft.companionType === 'named' ? (
              <div className="stack" style={{ '--gap': '6px' }}>
                <span className="small">{t('modal.whoComes')}</span>
                {draft.names
                  .map((name) => name.trim())
                  .filter(Boolean)
                  .map((name) => (
                    <label key={name} className="check" style={{ minHeight: 0, padding: '2px 0' }}>
                      <input
                        type="checkbox"
                        checked={draft.rsvpCompanions.includes(name)}
                        onChange={() =>
                          set({
                            rsvpCompanions: draft.rsvpCompanions.includes(name)
                              ? draft.rsvpCompanions.filter((value) => value !== name)
                              : [...draft.rsvpCompanions, name],
                          })
                        }
                      />
                      <span>{name}</span>
                    </label>
                  ))}
              </div>
            ) : null}
            {draft.rsvpStatus === 'yes' && open ? (
              <label className="field" style={{ maxWidth: 200 }}>
                <span>{t('modal.personsWithGuest')}</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={draft.max + 1}
                  value={draft.rsvpPersons}
                  onChange={(event) => set({ rsvpPersons: Number(event.target.value) })}
                />
              </label>
            ) : null}
            <label className="field">
              <span>{t('modal.note')}</span>
              <textarea
                className="textarea"
                rows={2}
                value={draft.rsvpNote}
                onChange={(event) => set({ rsvpNote: event.target.value })}
              />
            </label>
          </fieldset>
        ) : null}
      </form>
    </Modal>
  );
}

function ImportModal({
  busy,
  onClose,
  onImport,
}: {
  busy: boolean;
  onClose: () => void;
  onImport: (rows: string) => Promise<void>;
}) {
  const { t } = useTranslation('guests');
  const [rows, setRows] = useState('');
  const count = rows
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;

  return (
    <Modal
      title={t('import.title')}
      closeLabel={t('common:actions.close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={onClose}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || count === 0}
            onClick={() => void onImport(rows)}
          >
            {t('import.submit', { count })}
          </button>
        </>
      }
    >
      <p className="small muted">
        {t('import.hintBefore')} <strong>{t('import.format')}</strong>. {t('import.hintAfter')}
      </p>
      <textarea
        className="textarea"
        rows={8}
        aria-label={t('import.aria')}
        placeholder={t('import.placeholder')}
        value={rows}
        onChange={(event) => setRows(event.target.value)}
      />
    </Modal>
  );
}
