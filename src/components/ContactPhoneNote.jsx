import { Link } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { formatPhone } from '../utils/phone';
import Icon from './Icon';

export default function ContactPhoneNote({ onNavigate }) {
  const phone = useAppSelector((s) => s.auth.user?.phone);
  if (!phone) return null;
  return (
    <div className="row" style={{ '--gap': '10px', padding: '10px 12px', borderRadius: 12, background: 'var(--bg)', alignItems: 'center', flexWrap: 'nowrap' }}>
      <Icon name="whatsapp" size={18} />
      <span className="small grow">
        Kontaktiraćemo vas na <strong style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{formatPhone(phone)}</strong>
      </span>
      <Link to="/app/podesavanja#nalog" className="btn btn-ghost btn-sm" onClick={onNavigate}>Promeni</Link>
    </div>
  );
}
