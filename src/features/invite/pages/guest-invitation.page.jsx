import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchInvitation, submitRsvp } from '../services/invite.service';
import InvitationView from '../components/InvitationView';
import { envelopeColor } from '../templates';
import Icon from '../../../components/Icon';
import { PageLoading, Spinner } from '../../../components/ui';
import { formatDate, personsAcc } from '../../../utils/format';
import NotFound from '../../common/pages/not-found.page';

function RsvpForm({ token, guest, deadline, accent }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.invite.rsvpSaving);
  const answered = guest.rsvp.status !== 'pending';
  const [editing, setEditing] = useState(!answered);
  const [status, setStatus] = useState(answered ? guest.rsvp.status : null);
  const [count, setCount] = useState(guest.rsvp.persons || Math.min(2, guest.maxPersons));
  const [note, setNote] = useState(guest.rsvp.note || '');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!status) return setError('Izaberite da li dolazite.');
    setError('');
    const res = await dispatch(submitRsvp({ token, status, persons: count, note }));
    if (res.meta.requestStatus === 'fulfilled') setEditing(false);
  };

  if (!editing) {
    const yes = guest.rsvp.status === 'yes';
    return (
      <div className="stack reveal" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
        <span style={{ color: accent }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
        <h2>{yes ? 'Vidimo se!' : 'Hvala na odgovoru'}</h2>
        <p className="muted">
          {yes ? `Potvrdili ste dolazak za ${personsAcc(guest.rsvp.persons)}.` : 'Žao nam je što nećete biti tu. Pošaljite nam bar neku zajedničku sliku!'}
        </p>
        {guest.rsvp.note && <p className="small muted">Napomena: {guest.rsvp.note}</p>}
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>Izmeni odgovor</button>
      </div>
    );
  }

  const pill = (value, label) => (
    <button type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
      className="btn btn-lg" style={status === value
        ? { background: accent, color: '#F6F3EE', borderColor: accent }
        : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--line-strong)' }}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="stack" style={{ '--gap': '18px' }}>
      <div className="stack" style={{ '--gap': '4px' }}>
        <h2>Potvrdite dolazak</h2>
        {deadline && <p className="small muted">Molimo vas da odgovorite do {formatDate(deadline)}.</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} role="group" aria-label="Da li dolazite">
        {pill('yes', 'Dolazimo')}
        {pill('no', 'Ne možemo')}
      </div>
      {status === 'yes' && guest.maxPersons > 1 && (
        <div className="row between" style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}>
          <span>Broj osoba <span className="xs muted">(najviše {guest.maxPersons})</span></span>
          <div className="row" style={{ '--gap': '14px' }}>
            <button type="button" className="icon-btn" aria-label="Smanji broj osoba" disabled={count <= 1} onClick={() => setCount(count - 1)}><Icon name="minus" /></button>
            <strong style={{ minWidth: 16, textAlign: 'center', fontSize: 18 }} aria-live="polite">{count}</strong>
            <button type="button" className="icon-btn" aria-label="Povećaj broj osoba" disabled={count >= guest.maxPersons} onClick={() => setCount(count + 1)}><Icon name="plus" /></button>
          </div>
        </div>
      )}
      <label className="field">
        <span>Napomena (ishrana, alergije, pesma za žurku…)</span>
        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }} disabled={saving}>
        {saving ? <Spinner light /> : 'Pošalji odgovor'}
      </button>
    </form>
  );
}

export default function GuestInvitation() {
  const { token } = useParams();
  const dispatch = useAppDispatch();
  const { guest, wedding, status, error } = useAppSelector((s) => s.invite);
  const [opened, setOpened] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    dispatch(fetchInvitation(token));
  }, [dispatch, token]);

  if (status === 'failed') return <NotFound title="Pozivnica nije pronađena" text={error} />;
  if (status !== 'succeeded' || !guest || guest.token !== token) return <PageLoading />;

  const accent = envelopeColor(wedding.invitation);

  const open = () => {
    setAnimating(true);
    setTimeout(() => setOpened(true), 650);
  };

  if (!opened) {
    return (
      <div className="envelope-screen" style={{ background: accent }}>
        <p className="eyebrow" style={{ color: 'var(--champagne)' }}>Lična pozivnica</p>
        <div className={`envelope ${animating ? 'open' : ''}`} aria-hidden="true">
          <div className="body" />
          <svg className="flap" viewBox="0 0 260 106" preserveAspectRatio="none" width="260" height="106">
            <path d="M0 0 H260 L130 106 Z" fill="#EDE5D3" stroke="#D9C9A3" strokeWidth="1.5" />
          </svg>
          <div className="seal">{wedding.partner1[0]}&amp;{wedding.partner2[0]}</div>
        </div>
        <div className="stack" style={{ '--gap': '10px' }}>
          <h1 style={{ fontWeight: 500, fontSize: 42 }}>{guest.name},<br />imate poziv</h1>
          <p style={{ color: 'var(--champagne-2)' }}>{wedding.partner1} i {wedding.partner2} su vam poslali pozivnicu za svoje venčanje.</p>
        </div>
        <button className="btn btn-champagne btn-lg" onClick={open} disabled={animating}>Otvori pozivnicu</button>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <div className="guest-wrap reveal">
        <InvitationView wedding={wedding} guestName={guest.name}>
          <section style={{ padding: '8px 16px 0' }}>
            <div className="card" style={{ padding: '26px 20px' }}>
              <RsvpForm token={token} guest={guest} deadline={wedding.rsvpDeadline} accent={accent} />
            </div>
          </section>
          <section style={{ padding: '20px 16px 48px' }}>
            <div className="card card-cream stack" style={{ '--gap': '12px', padding: '26px 22px' }}>
              <p className="eyebrow">Album uspomena</p>
              <h2>Imate zajedničku sliku sa nama?</h2>
              <p style={{ color: 'var(--ink-2)' }}>
                Pošaljite nam stare uspomene već sada, a na dan venčanja i fotografije sa proslave. Sve ulazi u naš album.
              </p>
              <Link to={`/i/${token}/upload`} className="btn btn-lg" style={{ background: 'var(--ink)', color: '#F6F3EE' }}>
                <Icon name="upload" /> Pošalji slike
              </Link>
            </div>
          </section>
        </InvitationView>
      </div>
    </div>
  );
}
