import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { login } from '../services/auth.service';
import { clearAuthError } from '../store/auth.store';
import { Spinner } from '../../../components/ui';

export default function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState({ email: 'demo@uspomena.rs', password: 'demo123' });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login(form));
    if (res.meta.requestStatus === 'fulfilled') navigate(location.state?.from || '/app', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--green-dark)' }}>
      <form onSubmit={submit} className="card stack" style={{ width: 'min(420px, 100%)', '--gap': '18px', padding: 32 }}>
        <Link to="/" className="brand" style={{ color: 'var(--ink)' }}>Uspomena</Link>
        <div className="stack" style={{ '--gap': '6px' }}>
          <h1 style={{ fontSize: 32 }}>Prijava za mladence</h1>
          <p className="muted small">Demo podaci su već upisani, samo kliknite Prijavi se.</p>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Lozinka</span>
          <input className="input" type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-lg" disabled={status === 'loading'}>
          {status === 'loading' ? <Spinner light /> : 'Prijavi se'}
        </button>
        <p className="small muted" style={{ textAlign: 'center' }}>Nemate nalog? <Link to="/registracija">Napravite ga</Link></p>
      </form>
    </div>
  );
}
