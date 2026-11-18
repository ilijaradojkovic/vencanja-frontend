import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { guestsSelectors, selectGuestStats } from '../../guests/store/guests.store';
import { setPhotoStatus } from '../../photos/services/photos.service';
import { photosSelectors, selectPhotoCounts } from '../../photos/store/photos.store';
import Icon from '../../../components/Icon';
import { CopyButton, RsvpBadge } from '../../../components/ui';
import { daysUntil, formatDateTime, generalUploadLink, persons, plural } from '../../../utils/format';

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const stats = useAppSelector(selectGuestStats);
  const counts = useAppSelector(selectPhotoCounts);
  const guests = useAppSelector(guestsSelectors.selectAll);
  const pending = useAppSelector(photosSelectors.selectAll).filter((p) => p.status === 'pending').slice(0, 4);
  const qrRef = useRef(null);

  const days = daysUntil(wedding.date);
  const answered = stats.households - stats.waiting;
  const pct = stats.households ? Math.round((answered / stats.households) * 100) : 0;
  const recent = guests.filter((g) => g.rsvp.respondedAt).sort((a, b) => b.rsvp.respondedAt.localeCompare(a.rsvp.respondedAt)).slice(0, 5);
  const uploadLink = generalUploadLink(wedding.slug);

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${wedding.slug}.png`;
    a.click();
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{days > 0 ? `Do venčanja još ${days} ${plural(days, 'dan', 'dana', 'dana')}` : 'Venčanje je prošlo – vreme je za album'}</p>
          <h1>Zdravo, {wedding.partner1} i {wedding.partner2}</h1>
        </div>
        <div className="row">
          <Link to="/app/pozivnica" className="btn btn-outline">Uredi pozivnicu</Link>
          <Link to="/app/gosti" className="btn btn-primary"><Icon name="plus" size={18} /> Dodaj goste</Link>
        </div>
      </div>

      <section className="grid-cards" aria-label="Statistika">
        <div className="card stat"><span className="muted small">Pozvano osoba</span><strong>{stats.invitedPeople}</strong><span className="xs muted">{stats.households} pozivnica</span></div>
        <div className="card stat"><span className="muted small">Dolaze</span><strong style={{ color: 'var(--green)' }}>{stats.comingPeople}</strong><span className="xs muted">{stats.declined} ne dolazi</span></div>
        <div className="card stat"><span className="muted small">Čekamo odgovor</span><strong style={{ color: 'var(--gold)' }}>{stats.waiting}</strong><span className="xs muted">{stats.opened} otvorilo pozivnicu</span></div>
        <div className="card stat"><span className="muted small">Fotografije</span><strong>{counts.all}</strong><span className="xs muted">{counts.pending} čeka odobrenje</span></div>
      </section>

      <div className="two-col">
        <div className="main stack" style={{ '--gap': '24px' }}>
          <section className="card stack" aria-labelledby="rsvp-h">
            <div className="row between">
              <h2 id="rsvp-h">Odgovori gostiju</h2>
              <span className="small muted">{answered} od {stats.households} ({pct}%)</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
            {recent.length === 0 ? (
              <div className="empty"><span className="muted">Još nema odgovora.</span></div>
            ) : (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, '--gap': '0' }}>
                {recent.map((g) => (
                  <li key={g.id} className="row between" style={{ padding: '12px 0', borderBottom: '1px solid #f0ebe2', '--gap': '12px' }}>
                    <div className="stack grow" style={{ '--gap': '0' }}>
                      <strong style={{ fontWeight: 500 }}>{g.name}</strong>
                      <span className="xs muted">{formatDateTime(g.rsvp.respondedAt)}{g.rsvp.note ? ` · ${g.rsvp.note}` : ''}</span>
                    </div>
                    <span className="small muted">{g.rsvp.status === 'yes' ? persons(g.rsvp.persons) : ''}</span>
                    <RsvpBadge status={g.rsvp.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link to="/app/gosti" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>Svi gosti <Icon name="chevronRight" size={16} /></Link>
          </section>

          <section className="card stack" aria-labelledby="pend-h">
            <div className="row between">
              <h2 id="pend-h">Nove fotografije</h2>
              <Link to="/app/fotografije" className="btn btn-ghost btn-sm">Sve ({counts.pending})</Link>
            </div>
            {pending.length === 0 ? (
              <div className="empty"><strong>Sve je pregledano</strong><span className="small muted">Nove slike gostiju pojaviće se ovde.</span></div>
            ) : (
              <div className="photo-grid">
                {pending.map((p) => (
                  <div className="photo-card" key={p.id}>
                    <div className="photo-thumb" style={{ cursor: 'default' }}><img src={p.url} alt={p.message || `Od ${p.senderName}`} loading="lazy" /></div>
                    <span className="xs muted">Od: {p.senderName}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'approved' }))}>Odobri</button>
                      <button className="btn btn-soft btn-sm" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'hidden' }))}>Sakrij</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="side stack" style={{ '--gap': '24px' }}>
          <section className="card card-dark stack" aria-labelledby="qr-h">
            <p className="eyebrow" style={{ color: 'var(--champagne)' }}>QR za stolove</p>
            <h2 id="qr-h">Gosti šalju slike jednim skeniranjem</h2>
            <div ref={qrRef} style={{ alignSelf: 'center', padding: 14, background: '#fff', borderRadius: 14 }}>
              <QRCodeCanvas value={uploadLink} size={168} fgColor="#1E2A24" level="M" />
            </div>
            <p className="xs muted" style={{ wordBreak: 'break-all' }}>{uploadLink}</p>
            <div className="row">
              <button className="btn btn-champagne btn-sm" onClick={downloadQr}><Icon name="download" size={16} /> Preuzmi PNG</button>
              <CopyButton text={uploadLink} className="btn btn-sm" label="Kopiraj" />
            </div>
          </section>

          <section className="card card-cream stack" aria-labelledby="album-h">
            <h2 id="album-h">Veliki album</h2>
            <p style={{ color: 'var(--ink-2)' }}>
              {counts.approved} odobrenih fotografija je već na tabli kao polaroidi. Pogledajte ih ili zatražite da vam ga mi uradimo.
            </p>
            <div className="row">
              <Link to="/app/veliki-album" className="btn btn-primary">Otvori veliki album</Link>
              <Link to="/app/custom-dizajn" className="btn btn-outline">Custom dizajn</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
