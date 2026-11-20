import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
      toast.success(`Dodato gostiju: ${res.payload.length}`);
      onClose();
    }
  };
  return (
    <Modal title="Uvoz gostiju" onClose={onClose} footer={<>
      <button className="btn btn-soft" onClick={onClose}>Odustani</button>
      <button className="btn btn-primary" onClick={submit} disabled={!parsed.length || saving}>
        {saving ? <Spinner light /> : `Uvezi (${parsed.length})`}
      </button>
    </>}>
      <p className="muted small">Jedan gost po redu, u formatu <code>Ime; broj osoba; telefon</code>. Možete i nalepiti kolone iz Excela.</p>
      <textarea className="textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'Porodica Nikolić; 4; +381641234567\nMarija Đurić; 1\nKum Petar; 2'} aria-label="Spisak gostiju" />
    </Modal>
  );
}

const COMPANION_LABEL = { [CompanionType.NONE]: 'Bez pratioca', [CompanionType.OPEN]: 'Bez imena', [CompanionType.NAMED]: 'Navedeni' };

function companionsLine(g) {
  const coming = g.rsvp.companions || [];
  if (g.rsvp.status === 'yes' && coming.length) return `sa: ${coming.join(', ')}`;
  if (g.companions?.type === CompanionType.NAMED) return `pozvani: ${g.companions.names.join(', ')}`;
  return '';
}

function NotifyCell({ guest }) {
  const n = guest.photoNotify || {};
  if (n.sentAt) {
    return <span className="row" style={{ '--gap': '4px', color: 'var(--green)' }} title={n.email}><Icon name="check" size={16} />Poslato {formatDate(n.sentAt, { day: 'numeric', month: 'numeric' })}</span>;
  }
  if (n.email) return <span className="row" style={{ '--gap': '4px' }} title={n.email}><Icon name="mail" size={16} />Čeka</span>;
  return <span className="muted">–</span>;
}

function exportCsv(guests) {
  const rows = [['Ime', 'Strana', 'Pratioci', 'Pozvani pratioci', 'Najviše osoba', 'Status', 'Dolazi osoba', 'Pratioci koji dolaze', 'Napomena', 'Telefon', 'Email', 'Email za slike', 'Obaveštenje poslato', 'Link']];
  guests.forEach((g) => rows.push([
    g.name, SIDES[g.side], COMPANION_LABEL[g.companions?.type] || '', (g.companions?.names || []).join(', '), g.maxPersons,
    g.rsvp.status, g.rsvp.persons, (g.rsvp.companions || []).join(', '), g.rsvp.note, g.phone, g.email,
    g.photoNotify?.email || '', g.photoNotify?.sentAt || '', guestLink(g.token),
  ]));
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  a.download = 'gosti.csv';
  a.click();
}

export default function Guests() {
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
    `Dragi ${g.name}, sa radošću vas pozivamo na naše venčanje! Vaša pozivnica: ${guestLink(g.token)}\n${wedding.partner1} i ${wedding.partner2}`,
  );

  const confirmDelete = async () => {
    setDeleting(true);
    const res = await dispatch(deleteGuest(modal.guest.id));
    setDeleting(false);
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success('Gost je obrisan');
      setModal(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{guests.length} pozivnica</p>
          <h1>Gosti i lični linkovi</h1>
        </div>
        <div className="row">
          <button className="btn btn-soft" onClick={() => exportCsv(guests)} disabled={!guests.length}><Icon name="download" size={18} /> CSV</button>
          <button className="btn btn-outline" onClick={() => setModal({ type: 'import' })}>Uvezi spisak</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}><Icon name="plus" size={18} /> Novi gost</button>
        </div>
      </div>

      <section className="card stack">
        <div className="row between">
          <label className="row grow" style={{ maxWidth: 360, position: 'relative' }}>
            <span className="sr-only">Pretraga</span>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 42 }} placeholder="Pretraži goste…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" style={{ width: 'auto' }} value={side} onChange={(e) => setSide(e.target.value)} aria-label="Strana">
            <option value="all">Sve strane</option>
            {Object.entries(SIDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="chips" role="group" aria-label="Filter po odgovoru">
          {[['all', 'Svi'], ['yes', 'Dolaze'], ['pending', 'Čekamo'], ['no', 'Ne dolaze']].map(([k, label]) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>

        {status === 'loading' && !guests.length ? <PageLoading /> : visible.length === 0 ? (
          <div className="empty">
            <strong>{guests.length ? 'Nema gostiju za ovaj filter' : 'Još niste dodali goste'}</strong>
            {!guests.length && <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>Dodaj prvog gosta</button>}
          </div>
        ) : (
          <div className="table-wrap" ref={pager.topRef} style={{ scrollMarginTop: 16 }}>
            <table className="table">
              <thead>
                <tr><th>Gost</th><th>Strana</th><th>Odgovor</th><th>Dolazi</th><th>Pozivnica</th><th>Slike</th><th style={{ textAlign: 'right' }}>Akcije</th></tr>
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
                    <td className="small">{g.openedAt ? <span className="row" style={{ '--gap': '4px', color: 'var(--green)' }}><Icon name="eye" size={16} />Otvorena</span> : <span className="muted">Nije otvorena</span>}</td>
                    <td className="small"><NotifyCell guest={g} /></td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', '--gap': '6px', flexWrap: 'nowrap' }}>
                        <CopyButton text={guestLink(g.token)} label="Link" />
                        <a className="icon-btn icon-btn-sm" href={`https://wa.me/?text=${waText(g)}`} target="_blank" rel="noreferrer" aria-label={`Pošalji ${g.name} preko WhatsApp-a`}><Icon name="whatsapp" size={18} /></a>
                        <Link className="icon-btn icon-btn-sm" to={`/i/${g.token}`} target="_blank" aria-label={`Otvori pozivnicu za ${g.name}`}><Icon name="link" size={18} /></Link>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'edit', guest: g })} aria-label={`Izmeni ${g.name}`}><Icon name="edit" size={18} /></button>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'delete', guest: g })} aria-label={`Obriši ${g.name}`}><Icon name="trash" size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.setPage} onPageSize={pager.setPageSize} label="gostiju" />
      </section>

      {modal?.type === 'new' && <GuestModal onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <GuestModal guest={modal.guest} onClose={() => setModal(null)} />}
      {modal?.type === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal?.type === 'delete' && (
        <ConfirmModal title="Obriši gosta?" busy={deleting} onClose={() => setModal(null)} onConfirm={confirmDelete}
          text={`${modal.guest.name} će biti obrisan, a njegov lični link prestaje da radi. Fotografije koje je poslao ostaju.`} />
      )}
    </>
  );
}
