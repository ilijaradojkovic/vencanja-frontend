import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateWedding, fetchWedding } from '../services/wedding.service';
import { fetchGuests } from '../../guests/services/guests.service';
import { fetchPhotos } from '../../photos/services/photos.service';
import { fetchRequests } from '../../requests/services/requests.service';
import { toast } from 'react-toastify';
import { ResetMockData } from '../../../mock/mock.api';
import env from '../../../app/config/env';
import { ConfirmModal, Spinner } from '../../../components/ui';
import { generalUploadLink } from '../../../utils/format';
import { updateMe } from '../../auth/services/auth.service';
import PhoneField from '../../../components/PhoneField';
import { normalizePhone, PHONE_ERROR } from '../../../utils/phone';

function AccountSection() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const saving = useAppSelector((s) => s.auth.savingMe);
  const [phone, setPhone] = useState(user?.phone || '');
  const [error, setError] = useState('');
  const clean = normalizePhone(phone);
  const changed = clean !== (user?.phone || '');

  const save = async (e) => {
    e.preventDefault();
    if (!clean) return setError(PHONE_ERROR);
    const res = await dispatch(updateMe({ phone: clean }));
    if (res.meta.requestStatus === 'fulfilled') {
      setPhone(res.payload.phone);
      toast.success('Broj telefona je sačuvan');
    } else setError(res.payload?.message);
  };

  return (
    <form id="nalog" className="card stack" style={{ maxWidth: 720 }} onSubmit={save}>
      <h2>Nalog</h2>
      <label className="field"><span>Email za prijavu</span>
        <input className="input" value={user?.email || ''} readOnly disabled /></label>
      <PhoneField value={phone} onChange={(v) => { setPhone(v); setError(''); }} error={error}
        hint="Obavezan. Jedan broj za ceo nalog – na njega vas kontaktiramo za custom dizajn, štampu albuma i slično." />
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !changed}>
        {saving ? <Spinner light /> : 'Sačuvaj broj'}
      </button>
    </form>
  );
}

export default function Settings() {
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const saving = useAppSelector((s) => s.wedding.saving);
  const [f, setF] = useState({ slug: wedding.slug, city: wedding.city, ...wedding.settings });
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const { slug, city, ...settings } = f;
    const res = await dispatch(updateWedding({ slug, city, settings }));
    if (res.meta.requestStatus === 'fulfilled') toast.success('Podešavanja su sačuvana');
    else setError(res.payload?.message);
  };

  const reset = async () => {
    setResetting(true);
    await ResetMockData();
    await dispatch(fetchWedding());
    dispatch(fetchGuests());
    dispatch(fetchPhotos());
    dispatch(fetchRequests());
    setResetting(false);
    setResetOpen(false);
    toast.success('Demo podaci su vraćeni na početak');
  };

  const toggle = (k) => (e) => setF({ ...f, [k]: e.target.checked });

  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#nalog') document.getElementById('nalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
      <div className="page-head"><h1>Podešavanja</h1></div>
      <AccountSection />
      <form className="card stack" style={{ maxWidth: 720 }} onSubmit={save}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <h2>Venčanje</h2>
        <label className="field"><span>Adresa venčanja (koristi se u QR linku)</span>
          <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          <span className="xs">{generalUploadLink(f.slug)}</span>
        </label>
        <label className="field"><span>Grad</span><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>

        <h2 style={{ marginTop: 10 }}>Fotografije</h2>
        <label className="check"><input type="checkbox" checked={f.autoApprovePhotos} onChange={toggle('autoApprovePhotos')} />
          <span>Automatski odobri nove fotografije<br /><span className="xs muted">Inače ih prvo pregledate vi.</span></span></label>
        <label className="check"><input type="checkbox" checked={f.allowGeneralUpload} onChange={toggle('allowGeneralUpload')} />
          <span>Dozvoli slanje preko QR koda<br /><span className="xs muted">Bilo ko sa linkom može da pošalje sliku, bez ličnog linka.</span></span></label>
        <label className="check"><input type="checkbox" checked={f.galleryUnlockAfterWedding} onChange={toggle('galleryUnlockAfterWedding')} />
          <span>Gostima otvori galeriju tek dan posle venčanja</span></label>

        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>{saving ? <Spinner light /> : 'Sačuvaj'}</button>
      </form>

      {env.useMock && (
        <section className="card stack" style={{ maxWidth: 720 }}>
          <h2>Demo režim</h2>
          <p className="muted small">Aplikacija radi sa mock backendom (VITE_USE_MOCK=true). Podaci se čuvaju u ovom browseru.</p>
          <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => setResetOpen(true)}>Vrati demo podatke na početak</button>
        </section>
      )}
      {resetOpen && (
        <ConfirmModal title="Resetovati demo podatke?" confirmLabel="Resetuj" busy={resetting} onClose={() => setResetOpen(false)} onConfirm={reset}
          text="Sve izmene (gosti, slike, album, zahtevi) biće obrisane i vraćene na početne demo podatke." />
      )}
    </>
  );
}
