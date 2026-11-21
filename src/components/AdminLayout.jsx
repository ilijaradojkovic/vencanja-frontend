import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/store/auth.store';
import Icon from './Icon';
import LanguageSwitcher from './LanguageSwitcher';

export default function AdminLayout() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const onLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="stack" style={{ '--gap': '4px', padding: '0 10px' }}>
          <NavLink to="/admin" className="brand">Uspomena</NavLink>
          <span className="small" style={{ color: 'var(--champagne)' }}>{t('layout.role')} · {user?.email}</span>
        </div>
        <nav className="nav" aria-label={t('common:nav.mainMenu')}>
          <NavLink to="/admin" end>
            <Icon name="users" size={18} />
            {t('layout.accounts')}
          </NavLink>
        </nav>
        <div className="sidebar-foot stack" style={{ marginTop: 'auto', '--gap': '10px' }}>
          <LanguageSwitcher dark style={{ alignSelf: 'center' }} />
          <button className="btn btn-sm" style={{ color: 'var(--champagne-2)' }} onClick={onLogout}>
            <Icon name="logout" size={16} /> {t('common:actions.logout')}
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
