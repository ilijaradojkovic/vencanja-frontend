import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../app/hooks';
import { guestsSelectors } from '../../guests/store/guests.store';
import Icon from '../../../components/Icon';
import { CopyButton, Modal } from '../../../components/ui';
import { guestGalleryLink } from '../../../utils/format';
import { isGalleryOpen } from '../../../utils/gallery';
import { RsvpStatus } from '../../../app/config/enums';
import { readyMessage } from './notifyRecipients';

const waHref = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
const viberHref = (text) => `viber://forward?text=${encodeURIComponent(text)}`;

export default function ShareReadyModal({ onClose }) {
  const { t } = useTranslation('notifications');
  const wedding = useAppSelector((s) => s.wedding.data);
  const guests = useAppSelector(guestsSelectors.selectAll);
  const [q, setQ] = useState('');
  const [onlyComing, setOnlyComing] = useState(true);
  const open = isGalleryOpen(wedding);

  const list = useMemo(() => guests
    .filter((g) => !g.photoNotify?.email)
    .filter((g) => !onlyComing || g.rsvp.status === RsvpStatus.YES)
    .filter((g) => g.name.toLowerCase().includes(q.toLowerCase().trim())), [guests, onlyComing, q]);

  return (
    <Modal title={t('share.title')} onClose={onClose} wide
      footer={<button className="btn btn-primary" onClick={onClose}>{t('share.done')}</button>}>
      <div className="stack" style={{ '--gap': '14px' }}>
        <p className="muted small">{t('share.intro')}</p>
        {!open && (
          <div className="form-error" role="alert">
            {t('share.closed')} <Link to="/app/podesavanja">{t('openInSettings')}</Link>.
          </div>
        )}
        <div className="row between">
          <input className="input grow" style={{ maxWidth: 320 }} placeholder={t('guests:searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('guests:search')} />
          <label className="check" style={{ minHeight: 0 }}>
            <input type="checkbox" checked={onlyComing} onChange={(e) => setOnlyComing(e.target.checked)} /> {t('share.onlyComing')}
          </label>
        </div>
        {list.length === 0 ? (
          <div className="empty"><span className="muted">{t('share.empty')}</span></div>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, '--gap': '0', maxHeight: 420, overflowY: 'auto' }}>
            {list.map((g) => {
              const text = readyMessage(wedding, g.name, guestGalleryLink(g.token));
              return (
                <li key={g.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid #f0ebe2', '--gap': '10px' }}>
                  <div className="stack grow" style={{ '--gap': '0', minWidth: 160 }}>
                    <strong style={{ fontWeight: 500 }}>{g.name}</strong>
                    <span className="xs muted">{g.phone || t('share.noPhone')}</span>
                  </div>
                  <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' }}>
                    <a className="btn btn-soft btn-sm" href={waHref(g.phone, text)} target="_blank" rel="noreferrer" aria-label={t('share.whatsappAria', { name: g.name })}>
                      <Icon name="whatsapp" size={16} /> WhatsApp
                    </a>
                    <a className="btn btn-soft btn-sm" href={viberHref(text)} aria-label={t('share.viberAria', { name: g.name })}>Viber</a>
                    <CopyButton text={text} label={t('common:actions.copy')} className="btn btn-ghost btn-sm" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
