import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const guests = useAppSelector(guestsSelectors.selectAll);
  const [sending, setSending] = useState(false);
  const stats = notifyStats(guests, wedding);
  const open = isGalleryOpen(wedding);
  const sample = stats.guestPending[0];
  const sampleName = sample?.name || stats.subscriberPending[0]?.name || 'Ime gosta';
  const sampleLink = sample ? guestGalleryLink(sample.token) : generalGalleryLink(wedding.slug);

  const send = async () => {
    setSending(true);
    const res = await dispatch(sendPhotoNotifications());
    setSending(false);
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(`Obaveštenje je poslato na ${res.payload.sent} ${res.payload.sent === 1 ? 'adresu' : 'adresa'}`);
      onClose();
    }
  };

  return (
    <Modal title="Obavesti goste da su slike spremne" onClose={onClose} wide
      footer={<>
        <button className="btn btn-soft" onClick={onClose}>Odustani</button>
        <button className="btn btn-primary" onClick={send} disabled={!open || !stats.toSend || sending}>
          {sending ? <Spinner light /> : stats.toSend ? `Pošalji (${stats.toSend})` : 'Nema kome da se pošalje'}
        </button>
      </>}>
      <div className="stack" style={{ '--gap': '16px' }}>
        {!open && (
          <div className="form-error" role="alert">
            Galerija je trenutno zatvorena za goste, pa link iz mejla ne bi prikazao slike. <Link to="/app/podesavanja">Otvorite je u podešavanjima</Link>.
          </div>
        )}

        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="card stat"><span className="muted small">Dobiće mejl</span><strong>{stats.toSend}</strong>
            <span className="xs muted">{stats.guestPending.length} gostiju{stats.subscriberPending.length ? ` + ${stats.subscriberPending.length} preko QR` : ''}</span></div>
          <div className="card stat"><span className="muted small">Već obavešteno</span><strong>{stats.alreadySent}</strong><span className="xs muted">ne šaljemo im ponovo</span></div>
          <div className="card stat"><span className="muted small">Bez emaila</span><strong>{stats.withoutEmail.length}</strong><span className="xs muted">pošaljite im preko WhatsApp-a</span></div>
        </div>
        {stats.subscribersBlocked > 0 && (
          <p className="xs muted">{stats.subscribersBlocked} adresa ostavljenih preko QR koda ne dobija mejl jer galerija nije dostupna preko QR linka.</p>
        )}

        <div className="stack" style={{ '--gap': '6px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>Pregled mejla</span>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
            <div className="stack" style={{ '--gap': '2px', padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
              <span className="xs muted">Za: {sample?.photoNotify.email || stats.subscriberPending[0]?.email || 'gost@email.com'}</span>
              <strong style={{ fontWeight: 500 }}>Slike sa venčanja {wedding.partner1} i {wedding.partner2} su spremne</strong>
            </div>
            <div className="stack" style={{ '--gap': '12px', padding: 16 }}>
              <p>{readyIntro(sampleName)}</p>
              <span className="btn btn-primary" style={{ alignSelf: 'flex-start', pointerEvents: 'none' }}><Icon name="image" size={16} /> Pogledaj galeriju</span>
              <span className="xs muted" style={{ wordBreak: 'break-all' }}>{sampleLink}</span>
              <p className="serif" style={{ fontSize: 18 }}>{wedding.partner1} i {wedding.partner2}</p>
            </div>
          </div>
          <span className="xs muted">Svaki gost dobija svoj lični link. Mejl se šalje samo onima koji ga još nisu dobili.</span>
        </div>
      </div>
    </Modal>
  );
}
