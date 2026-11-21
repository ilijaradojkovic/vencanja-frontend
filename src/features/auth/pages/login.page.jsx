import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { login } from '../services/auth.service';
import { clearAuthError } from '../store/auth.store';
import { Spinner } from '../../../components/ui';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import { homePathFor } from '../../../utils/roles';

const DEMO = {
  couple: { email: 'demo@uspomena.rs', password: 'demo123' },
  celebration: { email: 'rodjendan@uspomena.rs', password: 'demo123' },
  superadmin: { email: 'admin@uspomena.rs', password: 'admin123' },
};

export default function Login() {
  const { t } = useTranslation('auth');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useAppSelector((s) => s.auth);
  const [form, setForm] = useState(DEMO.couple);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login(form));
    if (res.meta.requestStatus === 'fulfilled') {
      const home = homePathFor(res.payload.user);
      const from = location.state?.from;
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--green-dark)' }}>
      <form onSubmit={submit} className="card stack" style={{ width: 'min(420px, 100%)', '--gap': '18px', padding: 32 }}>
        <div className="row between"><Link to="/" className="brand" style={{ color: 'var(--ink)' }}>Uspomena</Link><LanguageSwitcher /></div>
        <div className="stack" style={{ '--gap': '6px' }}>
          <h1 style={{ fontSize: 32 }}>{t('login.title')}</h1>
          <p className="muted small">{t('login.demoHint')}</p>
          <div className="row" style={{ '--gap': '6px' }}>
            {Object.keys(DEMO).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={form.email === DEMO[k].email} onClick={() => setForm(DEMO[k])}>{t(`login.demo.${k}`)}</button>
            ))}
          </div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="field">
          <span>{t('fields.email')}</span>
          <input className="input" type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('fields.password')}</span>
          <input className="input" type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-lg" disabled={status === 'loading'}>
          {status === 'loading' ? <Spinner light /> : t('login.submit')}
        </button>
        <p className="small muted" style={{ textAlign: 'center' }}>{t('login.noAccount')}</p>
      </form>
    </div>
  );
}
