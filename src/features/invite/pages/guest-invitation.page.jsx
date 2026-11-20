import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchInvitation, submitRsvp } from '../services/invite.service';
import InvitationView from '../components/InvitationView';
import NotifyEmailForm from '../components/NotifyEmailForm';
import { galleryStatusText } from '../components/galleryStatus';
import { envelopeColor } from '../templates';
import Icon from '../../../components/Icon';
import { PageLoading, Spinner } from '../../../components/ui';
import { formatDate, personsAcc } from '../../../utils/format';
import { maxCompanions } from '../../../utils/gallery';
import { CompanionType, RsvpStatus } from '../../../app/config/enums';
import NotFound from '../../common/pages/not-found.page';

function CompanionsField({ guest, count, setCount, names, setNames, picked, setPicked }) {
  const type = guest.companions?.type || CompanionType.NONE;
  const max = maxCompanions(guest);

  if (type === CompanionType.NAMED) {
    return (
      <fieldset className="stack" style={{ '--gap': '6px', border: 'none', padding: '10px 14px', margin: 0, background: 'var(--bg)', borderRadius: 12 }}>
        <legend className="small" style={{ fontWeight: 500, padding: 0, marginBottom: 4 }}>Ko dolazi sa vama?</legend>
        {guest.companions.names.map((n) => (
          <label key={n} className="check" style={{ minHeight: 0, padding: '4px 0' }}>
            <input type="checkbox" checked={picked.includes(n)}
              onChange={() => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n])} />
            <span>{n}</span>
          </label>
        ))}
        <span className="xs muted">Ukupno: {personsAcc(1 + picked.length)}</span>
      </fieldset>
    );
  }

  if (type === CompanionType.OPEN && max > 0) {
    const setAt = (i, v) => setNames(names.map((x, j) => (j === i ? v : x)));
    const resize = (n) => {
      setCount(n);
      setNames(Array.from({ length: n - 1 }, (_, i) => names[i] || ''));
    };
    return (
      <div className="stack" style={{ '--gap': '10px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}>
        <div className="row between">
          <span>Broj osoba <span className="xs muted">(vi + do {max} {max === 1 ? 'pratilac' : 'pratilaca'})</span></span>
          <div className="row" style={{ '--gap': '14px' }}>
            <button type="button" className="icon-btn" aria-label="Smanji broj osoba" disabled={count <= 1} onClick={() => resize(count - 1)}><Icon name="minus" /></button>
            <strong style={{ minWidth: 16, textAlign: 'center', fontSize: 18 }} aria-live="polite">{count}</strong>
            <button type="button" className="icon-btn" aria-label="Povećaj broj osoba" disabled={count >= max + 1} onClick={() => resize(count + 1)}><Icon name="plus" /></button>
          </div>
        </div>
        {count > 1 && (
          <div className="stack" style={{ '--gap': '8px' }}>
            <span className="small">Imena pratilaca <span className="xs muted">(opciono)</span></span>
            {names.map((v, i) => (
              <input key={i} className="input" value={v} onChange={(e) => setAt(i, e.target.value)}
                placeholder={`Pratilac ${i + 1}`} aria-label={`Ime pratioca ${i + 1}`} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function NotifyStatus({ token, guest, accent }) {
  const [open, setOpen] = useState(false);
  if (guest.notifyEmail) {
    return (
      <p className="xs muted" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="mail" size={14} /> Obavestićemo vas na {guest.notifyEmail} kad slike budu spremne.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Icon name="mail" size={16} /> Obavesti me kad slike budu spremne
      </button>
    );
  }
  return (
    <div style={{ width: '100%', textAlign: 'left' }}>
      <NotifyEmailForm token={token} initialEmail={guest.prefillEmail} accent={accent}
        onDone={() => setOpen(false)} onSkip={() => setOpen(false)} skipLabel="Odustani" />
    </div>
  );
}

function RsvpForm({ token, guest, deadline, accent }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.invite.rsvpSaving);
  const answered = guest.rsvp.status !== RsvpStatus.PENDING;
  const max = maxCompanions(guest);
  const [step, setStep] = useState(answered ? 'done' : 'form');
  const [status, setStatus] = useState(answered ? guest.rsvp.status : null);
  const initialCount = guest.rsvp.status === RsvpStatus.YES ? Math.min(guest.rsvp.persons || 1, max + 1) : max + 1;
  const [count, setCount] = useState(initialCount);
  const [names, setNames] = useState(() => Array.from({ length: initialCount - 1 }, (_, i) => guest.rsvp.companions?.[i] || ''));
  const [picked, setPicked] = useState(guest.rsvp.companions || []);
  const [note, setNote] = useState(guest.rsvp.note || '');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!status) return setError('Izaberite da li dolazite.');
    setError('');
    const named = guest.companions?.type === CompanionType.NAMED;
    const companions = status !== RsvpStatus.YES ? [] : named ? picked : names.map((n) => n.trim()).filter(Boolean);
    const persons = status !== RsvpStatus.YES ? 0 : named ? 1 + picked.length : max > 0 ? count : 1;
    const res = await dispatch(submitRsvp({ token, status, persons, companions, note }));
    if (res.meta.requestStatus === 'fulfilled') setStep(guest.notifyEmail ? 'done' : 'notify');
    else setError(res.payload?.message || 'Slanje nije uspelo.');
  };

  if (step === 'notify') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    return (
      <div className="stack reveal" style={{ '--gap': '14px' }}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '8px' }}>
          <span style={{ color: accent }}><Icon name="checkCircle" size={44} stroke={1.5} /></span>
          <h2>{yes ? 'Hvala, vidimo se!' : 'Hvala na odgovoru'}</h2>
          <p className="muted">Želite li da vas obavestimo kada slike sa venčanja budu spremne?</p>
        </div>
        <NotifyEmailForm token={token} initialEmail={guest.prefillEmail} accent={accent}
          onDone={() => setStep('done')} onSkip={() => setStep('done')} />
      </div>
    );
  }

  if (step === 'done') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    const comp = guest.rsvp.companions || [];
    return (
      <div className="stack reveal" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
        <span style={{ color: accent }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
        <h2>{yes ? 'Vidimo se!' : 'Hvala na odgovoru'}</h2>
        <p className="muted">
          {yes ? `Potvrdili ste dolazak za ${personsAcc(guest.rsvp.persons)}.` : 'Žao nam je što nećete biti tu. Pošaljite nam bar neku zajedničku sliku!'}
        </p>
        {yes && comp.length > 0 && <p className="small muted">Sa vama: {comp.join(', ')}</p>}
        {guest.rsvp.note && <p className="small muted">Napomena: {guest.rsvp.note}</p>}
        <button className="btn btn-ghost" onClick={() => setStep('form')}>Izmeni odgovor</button>
        <NotifyStatus token={token} guest={guest} accent={accent} />
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
        {pill(RsvpStatus.YES, 'Dolazim')}
        {pill(RsvpStatus.NO, 'Ne mogu')}
      </div>
      {status === RsvpStatus.YES && (
        <CompanionsField guest={guest} count={count} setCount={setCount} names={names} setNames={setNames} picked={picked} setPicked={setPicked} />
      )}
      <label className="field">
        <span>Napomena (ishrana, alergije, pesma za žurku…)</span>
        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }} disabled={saving}>
        {saving ? <Spinner light /> : 'Potvrdi'}
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
  const galleryOpen = !!wedding.gallery?.open;

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
              {galleryOpen ? (
                <>
                  <h2>Slike su spremne</h2>
                  <p style={{ color: 'var(--ink-2)' }}>Pogledajte sve što su gosti uslikali, a ako imate još neku, pošaljite nam je.</p>
                  <Link to={`/i/${token}/galerija`} className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }}>
                    <Icon name="image" /> Pogledaj galeriju
                  </Link>
                  <Link to={`/i/${token}/upload`} className="btn btn-outline btn-lg">
                    <Icon name="upload" /> Pošalji slike
                  </Link>
                </>
              ) : (
                <>
                  <h2>Imate zajedničku sliku sa nama?</h2>
                  <p style={{ color: 'var(--ink-2)' }}>
                    Pošaljite nam stare uspomene već sada, a na dan venčanja i fotografije sa proslave. Sve ulazi u naš album.
                  </p>
                  <Link to={`/i/${token}/upload`} className="btn btn-lg" style={{ background: 'var(--ink)', color: '#F6F3EE' }}>
                    <Icon name="upload" /> Pošalji slike
                  </Link>
                  <p className="xs muted">{galleryStatusText(wedding.gallery)}</p>
                </>
              )}
            </div>
          </section>
        </InvitationView>
      </div>
    </div>
  );
}
