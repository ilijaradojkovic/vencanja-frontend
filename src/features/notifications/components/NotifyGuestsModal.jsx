import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { sendPhotoNotifications } from '../services/notifications.service';
import { guestsSelectors } from '../../guests/store/guests.store';
import Icon from '../../../components/Icon';
import { Modal, Spinner } from '../../../components/ui';
import { generalGalleryLink, guestGalleryLink } from '../../../utils/format';
import { isGalleryOpen } from '../../../utils/gallery';
import { notifyStats, readyIntro } from './notifyRecipients';

export default function NotifyGuestsModal({ onClose }) {
  const { t } = useTranslation('notifications');
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const guests = useAppSelector(guestsSelectors.selectAll);
  const [sending, setSending] = useState(false);
  const stats = notifyStats(guests, wedding);
  const open = isGalleryOpen(wedding);
  const sample = stats.guestPending[0];
  const sampleName = sample?.name || stats.subscriberPending[0]?.name || t('invite:editor.guestName');
  const sampleLink = sample ? guestGalleryLink(sample.token) : generalGalleryLink(wedding.slug);

  const send = async () => {
    setSending(true);
    const res = await dispatch(sendPhotoNotifications());
    setSending(false);
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('sentToast', { count: res.payload.sent }));
      onClose();
    }
  };

  return (
    <Modal title={t('notifyButton')} onClose={onClose} wide
      footer={<>
        <button className="btn btn-soft" onClick={onClose}>{t('common:actions.cancel')}</button>
        <button className="btn btn-primary" onClick={send} disabled={!open || !stats.toSend || sending}>
          {sending ? <Spinner light /> : stats.toSend ? t('send', { count: stats.toSend }) : t('nobody')}
        </button>
      </>}>
      <div className="stack" style={{ '--gap': '16px' }}>
        {!open && (
          <div className="form-error" role="alert">
            {t('closedEmail')} <Link to="/app/podesavanja">{t('openInSettings')}</Link>.
          </div>
        )}

        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="card stat"><span className="muted small">{t('stats.willGet')}</span><strong>{stats.toSend}</strong>
            <span className="xs muted">{t('stats.guests', { count: stats.guestPending.length })}{stats.subscriberPending.length ? ` + ${t('stats.viaQr', { count: stats.subscriberPending.length })}` : ''}</span></div>
          <div className="card stat"><span className="muted small">{t('stats.alreadySent')}</span><strong>{stats.alreadySent}</strong><span className="xs muted">{t('stats.notAgain')}</span></div>
          <div className="card stat"><span className="muted small">{t('stats.withoutEmail')}</span><strong>{stats.withoutEmail.length}</strong><span className="xs muted">{t('stats.useWhatsapp')}</span></div>
        </div>
        {stats.subscribersBlocked > 0 && (
          <p className="xs muted">{t('subscribersBlocked', { count: stats.subscribersBlocked })}</p>
        )}

        <div className="stack" style={{ '--gap': '6px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{t('preview')}</span>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
            <div className="stack" style={{ '--gap': '2px', padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
              <span className="xs muted">{t('to', { email: sample?.photoNotify.email || stats.subscriberPending[0]?.email || 'guest@email.com' })}</span>
              <strong style={{ fontWeight: 500 }}>{t('subject', { p1: wedding.partner1, p2: wedding.partner2 })}</strong>
            </div>
            <div className="stack" style={{ '--gap': '12px', padding: 16 }}>
              <p>{readyIntro(sampleName)}</p>
              <span className="btn btn-primary" style={{ alignSelf: 'flex-start', pointerEvents: 'none' }}><Icon name="image" size={16} /> {t('invite:gallery.view')}</span>
              <span className="xs muted" style={{ wordBreak: 'break-all' }}>{sampleLink}</span>
              <p className="serif" style={{ fontSize: 18 }}>{t('signature', { p1: wedding.partner1, p2: wedding.partner2 })}</p>
            </div>
          </div>
          <span className="xs muted">{t('previewHint')}</span>
        </div>
      </div>
    </Modal>
  );
}
