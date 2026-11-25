import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import LanguageSwitcher from './LanguageSwitcher';
import { eventNames } from '../utils/event';

const NAV = [
  ['/app', 'nav.overview', 'dashboard', true],
  ['/app/gosti', 'nav.guests', 'users'],
  ['/app/pozivnica', 'nav.invitation', 'mail'],
  ['/app/fotografije', 'nav.photos', 'image'],
  ['/app/veliki-album', 'nav.bigAlbum', 'heart'],
  ['/app/custom-dizajn', 'nav.customDesign', 'sparkle'],
  ['/app/podesavanja', 'nav.settings', 'settings'],
];

export default function AppLayout() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const wedding = useAppSelector((s) => s.wedding.data);
  const weddingStatus = useAppSelector((s) => s.wedding.status);
  const pending = useAppSelector(selectPhotoCounts).pending;
  const user = useAppSelector((s) => s.auth.user);

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
              {eventNames(wedding)} · {formatDate(wedding.date, { day: 'numeric', month: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
        <nav className="nav" aria-label={t('nav.mainMenu')}>
          {NAV.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon name={icon} size={18} />
              {t(label)}
              {to === '/app/fotografije' && pending > 0 && <span className="pill">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot stack" style={{ marginTop: 'auto', '--gap': '10px' }}>
          {wedding && (
            <Link className="btn btn-sm" style={{ border: '1px solid var(--champagne)', color: '#F6F3EE' }} to={`/w/${wedding.slug}/upload`}>
              <Icon name="qr" size={16} /> {t('nav.qrUpload')}
            </Link>
          )}
          <LanguageSwitcher dark style={{ alignSelf: 'center' }} />
          <button className="btn btn-sm" style={{ color: 'var(--champagne-2)' }} onClick={onLogout}>
            <Icon name="logout" size={16} /> {t('actions.logout')}
          </button>
        </div>
      </aside>
      <main className="content">
        {weddingStatus === 'failed' ? (
          <div className="empty">
            <strong>{t('layout.loadFailed')}</strong>
            <button className="btn btn-primary" onClick={() => dispatch(fetchWedding())}>{t('actions.retry')}</button>
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
