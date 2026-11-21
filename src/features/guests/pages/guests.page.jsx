import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../../app/config/i18n';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { deleteGuest, importGuests } from '../services/guests.service';
import GuestModal from '../components/GuestModal';
import { guestsSelectors } from '../store/guests.store';
import { toast } from 'react-toastify';
import Icon from '../../../components/Icon';
import { ConfirmModal, CopyButton, Modal, PageLoading, RsvpBadge, Spinner } from '../../../components/ui';
import { CompanionType } from '../../../app/config/enums';
import { formatDate, guestLink, SIDES, persons } from '../../../utils/format';
import Pagination from '../../../components/Pagination';
import { usePagination } from '../../../utils/usePagination';

function ImportModal({ onClose }) {
  const { t } = useTranslation('guests');
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.guests.saving);
  const [text, setText] = useState('');
  const parsed = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, n, phone] = l.split(/[;,\t]/).map((x) => x?.trim());
    return { name, maxPersons: Number(n) || 1, phone: phone || '' };
  });
  const submit = async () => {
    const res = await dispatch(importGuests(parsed));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('import.done', { count: res.payload.length }));
      onClose();
    }
  };
  return (
    <Modal title={t('import.title')} onClose={onClose} footer={<>
      <button className="btn btn-soft" onClick={onClose}>{t('common:actions.cancel')}</button>
      <button className="btn btn-primary" onClick={submit} disabled={!parsed.length || saving}>
        {saving ? <Spinner light /> : t('import.submit', { count: parsed.length })}
      </button>
    </>}>
      <p className="muted small">{t('import.hintBefore')} <code>{t('import.format')}</code>. {t('import.hintAfter')}</p>
      <textarea className="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={t('import.placeholder')} aria-label={t('import.aria')} />
    </Modal>
  );
}

const companionLabel = (type) => (type ? i18n.t(`guests:csv.companionType.${type}`) : '');

function companionsLine(g) {
  const coming = g.rsvp.companions || [];
  if (g.rsvp.status === 'yes' && coming.length) return i18n.t('guests:companionsComing', { names: coming.join(', ') });
  if (g.companions?.type === CompanionType.NAMED) return i18n.t('guests:companionsInvited', { names: g.companions.names.join(', ') });
  return '';
}

function NotifyCell({ guest }) {
  const n = guest.photoNotify || {};
  if (n.sentAt) {
    return <span className="row" style={{ '--gap': '4px', color: 'var(--green)' }} title={n.email}><Icon name="check" size={16} />{i18n.t('guests:notify.sent', { date: formatDate(n.sentAt, { day: 'numeric', month: 'numeric' }) })}</span>;
  }
  if (n.email) return <span className="row" style={{ '--gap': '4px' }} title={n.email}><Icon name="mail" size={16} />{i18n.t('guests:notify.waiting')}</span>;
  return <span className="muted">–</span>;
}

function exportCsv(guests) {
  const rows = [['name', 'side', 'companions', 'invitedCompanions', 'maxPersons', 'status', 'persons', 'comingCompanions', 'note', 'phone', 'email', 'notifyEmail', 'notifiedAt', 'link'].map((k) => i18n.t(`guests:csv.${k}`))];
  guests.forEach((g) => rows.push([
    g.name, SIDES[g.side], companionLabel(g.companions?.type), (g.companions?.names || []).join(', '), g.maxPersons,
    i18n.t(`common:rsvp.${g.rsvp.status}`), g.rsvp.persons, (g.rsvp.companions || []).join(', '), g.rsvp.note, g.phone, g.email,
    g.photoNotify?.email || '', g.photoNotify?.sentAt || '', guestLink(g.token),
  ]));
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  a.download = `${i18n.t('guests:csv.fileName')}.csv`;
  a.click();
}

export default function Guests() {
  const { t } = useTranslation('guests');
  const dispatch = useAppDispatch();
  const guests = useAppSelector(guestsSelectors.selectAll);
  const status = useAppSelector((s) => s.guests.status);
  const wedding = useAppSelector((s) => s.wedding.data);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [side, setSide] = useState('all');
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => ({
    all: guests.length,
    yes: guests.filter((g) => g.rsvp.status === 'yes').length,
    pending: guests.filter((g) => g.rsvp.status === 'pending').length,
    no: guests.filter((g) => g.rsvp.status === 'no').length,
  }), [guests]);

  const visible = guests.filter((g) =>
    (filter === 'all' || g.rsvp.status === filter) &&
    (side === 'all' || g.side === side) &&
    g.name.toLowerCase().includes(q.toLowerCase().trim()));
  const pager = usePagination(visible, { storageKey: 'gosti', defaultSize: 10, resetKey: `${q}|${filter}|${side}` });

  const waText = (g) => encodeURIComponent(
    t('whatsappInvite', { name: g.name, link: guestLink(g.token), p1: wedding.partner1, p2: wedding.partner2 }),
  );

  const confirmDelete = async () => {
    setDeleting(true);
    const res = await dispatch(deleteGuest(modal.guest.id));
    setDeleting(false);
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('deleted'));
      setModal(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('dashboard:stats.invitations', { count: guests.length })}</p>
          <h1>{t('title')}</h1>
        </div>
        <div className="row">
          <button className="btn btn-soft" onClick={() => exportCsv(guests)} disabled={!guests.length}><Icon name="download" size={18} /> CSV</button>
          <button className="btn btn-outline" onClick={() => setModal({ type: 'import' })}>{t('importList')}</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}><Icon name="plus" size={18} /> {t('newGuest')}</button>
        </div>
      </div>

      <section className="card stack">
        <div className="row between">
          <label className="row grow" style={{ maxWidth: 360, position: 'relative' }}>
            <span className="sr-only">{t('search')}</span>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 42 }} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" style={{ width: 'auto' }} value={side} onChange={(e) => setSide(e.target.value)} aria-label={t('sideAria')}>
            <option value="all">{t('allSides')}</option>
            {Object.entries(SIDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="chips" role="group" aria-label={t('filterAria')}>
          {['all', 'yes', 'pending', 'no'].map((k) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {t(`filters.${k}`)} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>

        {status === 'loading' && !guests.length ? <PageLoading /> : visible.length === 0 ? (
          <div className="empty">
            <strong>{guests.length ? t('emptyFilter') : t('empty')}</strong>
            {!guests.length && <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>{t('addFirst')}</button>}
          </div>
        ) : (
          <div className="table-wrap" ref={pager.topRef} style={{ scrollMarginTop: 16 }}>
            <table className="table">
              <thead>
                <tr><th>{t('table.guest')}</th><th>{t('table.side')}</th><th>{t('table.reply')}</th><th>{t('table.coming')}</th><th>{t('table.invitation')}</th><th>{t('table.photos')}</th><th style={{ textAlign: 'right' }}>{t('table.actions')}</th></tr>
              </thead>
              <tbody>
                {pager.pageItems.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="stack" style={{ '--gap': '0' }}>
                        <strong style={{ fontWeight: 500 }}>{g.name}</strong>
                        {g.rsvp.note && <span className="xs muted" title={g.rsvp.note} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.rsvp.note}</span>}
                      </div>
                    </td>
                    <td className="small muted">{SIDES[g.side]}</td>
                    <td><RsvpBadge status={g.rsvp.status} /></td>
                    <td className="small">
                      {g.rsvp.status === 'yes' ? persons(g.rsvp.persons) : '–'} <span className="xs muted">/ {g.maxPersons}</span>
                      {companionsLine(g) && <div className="xs muted" title={companionsLine(g)} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companionsLine(g)}</div>}
                    </td>
                    <td className="small">{g.openedAt ? <span className="row" style={{ '--gap': '4px', color: 'var(--green)' }}><Icon name="eye" size={16} />{t('opened')}</span> : <span className="muted">{t('notOpened')}</span>}</td>
                    <td className="small"><NotifyCell guest={g} /></td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', '--gap': '6px', flexWrap: 'nowrap' }}>
                        <CopyButton text={guestLink(g.token)} label={t('link')} />
                        <a className="icon-btn icon-btn-sm" href={`https://wa.me/?text=${waText(g)}`} target="_blank" rel="noreferrer" aria-label={t('aria.whatsapp', { name: g.name })}><Icon name="whatsapp" size={18} /></a>
                        <Link className="icon-btn icon-btn-sm" to={`/i/${g.token}`} target="_blank" aria-label={t('aria.openInvitation', { name: g.name })}><Icon name="link" size={18} /></Link>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'edit', guest: g })} aria-label={t('aria.edit', { name: g.name })}><Icon name="edit" size={18} /></button>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'delete', guest: g })} aria-label={t('aria.delete', { name: g.name })}><Icon name="trash" size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </section>

      {modal?.type === 'new' && <GuestModal onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <GuestModal guest={modal.guest} onClose={() => setModal(null)} />}
      {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && (
        <ConfirmModal title={t('deleteTitle')} busy={deleting} onClose={() => setModal(null)} onConfirm={confirmDelete}
          text={t('deleteText', { name: modal.guest.name })} />
      )}
    </>
  );
}
