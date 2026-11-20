import { useState } from 'react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createGuest, updateGuest } from '../services/guests.service';
import Icon from '../../../components/Icon';
import { Modal, Spinner } from '../../../components/ui';
import { SIDES } from '../../../utils/format';
import { CompanionType, GuestSide, RsvpStatus } from '../../../app/config/enums';

const COMPANION_TYPES = [
  [CompanionType.NONE, 'Bez pratioca', 'Dolazi samo gost.'],
  [CompanionType.OPEN, '+ pratioci bez imena', 'Gost sam bira koga vodi i koliko (do zadatog broja).'],
  [CompanionType.NAMED, 'Tačno navedene osobe', 'Gost samo potvrđuje ko od njih dolazi.'],
];

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function CompanionsEditor({ type, setType, max, setMax, names, setNames }) {
  const setAt = (i, v) => setNames(names.map((x, j) => (j === i ? v : x)));
  return (
    <fieldset className="stack" style={{ '--gap': '10px', border: '1px solid var(--line)', borderRadius: 12, padding: 14, margin: 0 }}>
      <legend className="small" style={{ padding: '0 6px', color: 'var(--ink-2)', fontWeight: 500 }}>Pratioci</legend>
      <div className="stack" style={{ '--gap': '0' }}>
        {COMPANION_TYPES.map(([value, label, hint]) => (
          <label key={value} className="check" style={{ minHeight: 0, padding: '6px 0' }}>
            <input type="radio" name="companionType" checked={type === value} onChange={() => setType(value)} />
            <span>{label}<br /><span className="xs muted">{hint}</span></span>
          </label>
        ))}
      </div>
      {type === CompanionType.OPEN && (
        <label className="field" style={{ width: 180 }}><span>Najviše pratilaca</span>
          <input className="input" type="number" min={1} max={19} value={max} onChange={(e) => setMax(e.target.value)} /></label>
      )}
      {type === CompanionType.NAMED && (
        <div className="stack" style={{ '--gap': '8px' }}>
          <span className="small">Imena pratilaca</span>
          {names.map((n, i) => (
            <div key={i} className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' }}>
              <input className="input grow" value={n} onChange={(e) => setAt(i, e.target.value)} placeholder={`npr. ${['Marija', 'Petar', 'Sofija'][i % 3]}`} aria-label={`Pratilac ${i + 1}`} />
              <button type="button" className="icon-btn" onClick={() => setNames(names.filter((_, j) => j !== i))} disabled={names.length <= 1} aria-label={`Ukloni pratioca ${i + 1}`}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setNames([...names, ''])} disabled={names.length >= 19}>
            <Icon name="plus" size={16} /> Dodaj pratioca
          </button>
        </div>
      )}
    </fieldset>
  );
}

export default function GuestModal({ guest, onClose }) {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.guests.saving);
  const c = guest?.companions || { type: CompanionType.NONE, max: 1, names: [] };
  const [f, setF] = useState({
    name: guest?.name || '',
    email: guest?.email || '',
    phone: guest?.phone || '',
    side: guest?.side || GuestSide.SHARED,
  });
  const [ctype, setCtype] = useState(c.type);
  const [cmax, setCmax] = useState(c.max || 1);
  const [cnames, setCnames] = useState(c.names?.length ? c.names : ['']);
  const [rsvpStatus, setRsvpStatus] = useState(guest?.rsvp.status || RsvpStatus.PENDING);
  const [rsvpPersons, setRsvpPersons] = useState(guest?.rsvp.persons || 1);
  const [rsvpPicked, setRsvpPicked] = useState(guest?.rsvp.companions || []);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cleanNames = cnames.map((n) => n.trim()).filter(Boolean);
  const maxComp = ctype === CompanionType.NAMED ? cleanNames.length : ctype === CompanionType.OPEN ? Number(cmax) || 0 : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('Ime je obavezno.');
    if (ctype === CompanionType.NAMED && !cleanNames.length) return setError('Upišite bar jedno ime pratioca.');
    if (ctype === CompanionType.OPEN && (maxComp < 1 || maxComp > 19)) return setError('Broj pratilaca mora biti između 1 i 19.');

    const payload = { ...f, companions: { type: ctype, max: maxComp, names: ctype === CompanionType.NAMED ? cleanNames : [] } };
    let action;
    if (guest) {
      let rsvp;
      if (rsvpStatus === RsvpStatus.YES) {
        rsvp = ctype === CompanionType.NAMED
          ? { status: rsvpStatus, persons: 1 + rsvpPicked.filter((n) => cleanNames.includes(n)).length, companions: rsvpPicked.filter((n) => cleanNames.includes(n)) }
          : { status: rsvpStatus, persons: Math.min(Math.max(1, Number(rsvpPersons) || 1), maxComp + 1), companions: (guest.rsvp.companions || []).slice(0, Math.max(0, (Number(rsvpPersons) || 1) - 1)) };
      } else rsvp = { status: rsvpStatus, persons: 0, companions: [] };
      const changed = rsvp.status !== guest.rsvp.status || rsvp.persons !== guest.rsvp.persons || !sameList(rsvp.companions, guest.rsvp.companions || []);
      if (changed) payload.rsvp = rsvp;
      action = await dispatch(updateGuest({ id: guest.id, ...payload }));
    } else {
      action = await dispatch(createGuest(payload));
    }
    if (action.meta.requestStatus === 'fulfilled') {
      toast.success(guest ? 'Gost je sačuvan' : 'Gost je dodat, lični link je spreman');
      onClose();
    } else setError(action.payload?.message);
  };

  return (
    <Modal title={guest ? 'Izmeni gosta' : 'Novi gost'} onClose={onClose}>
      <form onSubmit={submit} className="stack" id="guest-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="field"><span>Ime (kako piše na pozivnici)</span>
          <input className="input" value={f.name} onChange={set('name')} placeholder="npr. Jelena Nikolić" required /></label>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <label className="field grow"><span>Telefon</span><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="+381…" /></label>
          <label className="field grow"><span>Email</span><input className="input" type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <label className="field"><span>Strana</span>
          <select className="select" value={f.side} onChange={set('side')}>
            {Object.entries(SIDES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>

        <CompanionsEditor type={ctype} setType={setCtype} max={cmax} setMax={setCmax} names={cnames} setNames={setCnames} />

        {guest && (
          <fieldset className="stack" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, margin: 0 }}>
            <legend className="small" style={{ padding: '0 6px', color: 'var(--ink-2)', fontWeight: 500 }}>Odgovor (ako se gost javio telefonom)</legend>
            <label className="field"><span>Status</span>
              <select className="select" value={rsvpStatus} onChange={(e) => setRsvpStatus(e.target.value)}>
                <option value={RsvpStatus.PENDING}>Čeka odgovor</option><option value={RsvpStatus.YES}>Dolazi</option><option value={RsvpStatus.NO}>Ne dolazi</option>
              </select></label>
            {rsvpStatus === RsvpStatus.YES && ctype === CompanionType.NAMED && (
              <div className="stack" style={{ '--gap': '0' }}>
                <span className="small">Ko od pratilaca dolazi</span>
                {cleanNames.map((n) => (
                  <label key={n} className="check" style={{ minHeight: 0, padding: '4px 0' }}>
                    <input type="checkbox" checked={rsvpPicked.includes(n)}
                      onChange={() => setRsvpPicked(rsvpPicked.includes(n) ? rsvpPicked.filter((x) => x !== n) : [...rsvpPicked, n])} />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            )}
            {rsvpStatus === RsvpStatus.YES && ctype === CompanionType.OPEN && (
              <label className="field" style={{ width: 180 }}><span>Broj osoba (sa gostom)</span>
                <input className="input" type="number" min={1} max={maxComp + 1} value={rsvpPersons} onChange={(e) => setRsvpPersons(e.target.value)} /></label>
            )}
          </fieldset>
        )}
      </form>
      <div className="modal-foot">
        <button className="btn btn-soft" onClick={onClose}>Odustani</button>
        <button className="btn btn-primary" form="guest-form" disabled={saving}>{saving ? <Spinner light /> : 'Sačuvaj'}</button>
      </div>
    </Modal>
  );
}
