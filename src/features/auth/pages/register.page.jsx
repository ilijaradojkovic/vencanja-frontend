import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { register } from '../services/auth.service';
import { clearAuthError } from '../store/auth.store';
import { Spinner } from '../../../components/ui';
import PhoneField from '../../../components/PhoneField';
import { normalizePhone, PHONE_ERROR } from '../../../utils/phone';

const EMPTY = { partner1: '', partner2: '', date: '', email: '', phone: '', password: '' };

export default function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const [f, setF] = useState(EMPTY);
  const [phoneError, setPhoneError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const phone = normalizePhone(f.phone);
    if (!phone) return setPhoneError(PHONE_ERROR);
    setPhoneError('');
    const res = await dispatch(register({ ...f, email: f.email.trim(), partner1: f.partner1.trim(), partner2: f.partner2.trim(), phone }));
    if (res.meta.requestStatus === 'fulfilled') navigate('/app', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--green-dark)' }}>
      <form onSubmit={submit} className="card stack" style={{ width: 'min(520px, 100%)', '--gap': '18px', padding: 32 }}>
        <Link to="/" className="brand" style={{ color: 'var(--ink)' }}>Uspomena</Link>
        <div className="stack" style={{ '--gap': '6px' }}>
          <h1 style={{ fontSize: 32 }}>Napravite nalog</h1>
          <p className="muted small">Jedan nalog za oboje: pozivnice, gosti, slike i album.</p>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <label className="field grow"><span>Mlada</span>
            <input className="input" required autoComplete="given-name" value={f.partner1} onChange={set('partner1')} placeholder="Ana" /></label>
          <label className="field grow"><span>Mladoženja</span>
            <input className="input" required value={f.partner2} onChange={set('partner2')} placeholder="Marko" /></label>
        </div>
        <label className="field"><span>Datum venčanja</span>
          <input className="input" type="date" required value={f.date} onChange={set('date')} /></label>

        <label className="field"><span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>

        <PhoneField value={f.phone} onChange={(v) => { setF({ ...f, phone: v }); if (phoneError) setPhoneError(''); }} error={phoneError}
          hint="Obavezno. Na ovaj broj vas kontaktiramo za custom dizajn, štampu albuma i slično. Broj važi za ceo nalog." />

        <label className="field"><span>Lozinka</span>
          <input className="input" type="password" required minLength={6} autoComplete="new-password" value={f.password} onChange={set('password')} />
          <span className="xs muted">Najmanje 6 znakova.</span></label>

        <button className="btn btn-primary btn-lg" disabled={status === 'loading'}>
          {status === 'loading' ? <Spinner light /> : 'Napravi nalog'}
        </button>
        <p className="small muted" style={{ textAlign: 'center' }}>Već imate nalog? <Link to="/login">Prijavite se</Link></p>
      </form>
    </div>
  );
}
