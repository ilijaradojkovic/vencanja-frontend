import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/store/auth.store';
import { fetchWedding } from '../features/wedding/services/wedding.service';
import { fetchGuests } from '../features/guests/services/guests.service';
import { fetchPhotos } from '../features/photos/services/photos.service';
import { selectPhotoCounts } from '../features/photos/store/photos.store';
import { formatDate } from '../utils/format';
import { PageLoading } from './ui';
import Icon from './Icon';
import PhoneRequiredModal from './PhoneRequiredModal';

const NAV = [
  ['/app', 'Pregled', 'dashboard', true],
  ['/app/gosti', 'Gosti', 'users'],
  ['/app/pozivnica', 'Pozivnica', 'mail'],
  ['/app/fotografije', 'Fotografije', 'image'],
  ['/app/veliki-album', 'Veliki album', 'heart'],
  ['/app/custom-dizajn', 'Custom dizajn', 'sparkle'],
  ['/app/podesavanja', 'Podešavanja', 'settings'],
];

export default function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const wedding = useAppSelector((s) => s.wedding.data);
  const weddingStatus = useAppSelector((s) => s.wedding.status);
  const pending = useAppSelector(selectPhotoCounts).pending;
  const user = useAppSelector((s) => s.auth.user);

  // podaci koje koristi više ekrana učitavaju se jednom, pri ulasku u aplikaciju
  useEffect(() => {
    if (weddingStatus === 'idle') {
      dispatch(fetchWedding()).then((a) => {
        if (a.meta.requestStatus === 'fulfilled') {
          dispatch(fetchGuests());
          dispatch(fetchPhotos());
        }
      });
    }
  }, [dispatch, weddingStatus]);

  const onLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="stack" style={{ '--gap': '4px', padding: '0 10px' }}>
          <NavLink to="/app" className="brand">Uspomena</NavLink>
          {wedding && (
            <span className="small" style={{ color: 'var(--champagne)' }}>
              {wedding.partner1} &amp; {wedding.partner2} · {formatDate(wedding.date, { day: 'numeric', month: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        <nav className="nav" aria-label="Glavni meni">
          {NAV.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon name={icon} size={18} />
              {label}
              {to === '/app/fotografije' && pending > 0 && <span className="pill">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot stack" style={{ marginTop: 'auto', '--gap': '10px' }}>
          {wedding && (
            <Link className="btn btn-sm" style={{ border: '1px solid var(--champagne)', color: '#F6F3EE' }} to={`/w/${wedding.slug}/upload`}>
              <Icon name="qr" size={16} /> Stranica za QR upload
            </Link>
          )}
          <button className="btn btn-sm" style={{ color: 'var(--champagne-2)' }} onClick={onLogout}>
            <Icon name="logout" size={16} /> Odjavi se
          </button>
        </div>
      </aside>
      <main className="content">
        {weddingStatus === 'failed' ? (
          <div className="empty">
            <strong>Nismo uspeli da učitamo podatke.</strong>
            <button className="btn btn-primary" onClick={() => dispatch(fetchWedding())}>Pokušaj ponovo</button>
          </div>
        ) : wedding ? (
          <Outlet />
        ) : (
          <PageLoading />
        )}
      </main>
      {user && !user.phone && <PhoneRequiredModal />}
    </div>
  );
}
