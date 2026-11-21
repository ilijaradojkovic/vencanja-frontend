import { useTranslation } from 'react-i18next';
import { CopyButton, Modal } from '../../../components/ui';
import { loginLink } from '../../../utils/format';

export default function CredentialsModal({ title, email, password, onClose }) {
  const { t } = useTranslation('admin');
  const text = t('credentials.message', { url: loginLink(), email, password });
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>{t('common:actions.ok')}</button>}
    >
      <div className="stack" style={{ '--gap': '14px' }}>
        <p className="muted small">{t('credentials.hint')}</p>
        <div className="card stack" style={{ '--gap': '6px', background: 'var(--bg)', boxShadow: 'none' }}>
          <span className="small">{t('fields.email')}: <strong>{email}</strong></span>
          <span className="small">{t('fields.password')}: <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{password}</strong></span>
        </div>
        <CopyButton text={text} label={t('credentials.copy')} className="btn btn-outline" />
      </div>
    </Modal>
  );
}
