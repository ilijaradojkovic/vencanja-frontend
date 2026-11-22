import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { guestsSelectors, selectGuestStats } from '../../guests/store/guests.store';
import { setPhotoStatus } from '../../photos/services/photos.service';
import { photosSelectors, selectPhotoCounts } from '../../photos/store/photos.store';
import Icon from '../../../components/Icon';
import { CopyButton, RsvpBadge } from '../../../components/ui';
import { daysLabel, daysUntil, formatDateTime, generalUploadLink, persons } from '../../../utils/format';
import { isGalleryOpen } from '../../../utils/gallery';
import { notifyStats } from '../../notifications/components/notifyRecipients';
import NotifyGuestsModal from '../../notifications/components/NotifyGuestsModal';
import ShareReadyModal from '../../notifications/components/ShareReadyModal';

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const stats = useAppSelector(selectGuestStats);
  const counts = useAppSelector(selectPhotoCounts);
  const guests = useAppSelector(guestsSelectors.selectAll);
  const pending = useAppSelector(photosSelectors.selectAll).filter((p) => p.status === 'pending').slice(0, 4);
  const qrRef = useRef(null);
  const [notifyModal, setNotifyModal] = useState(null);
  const notify = notifyStats(guests, wedding);
  const galleryOpen = isGalleryOpen(wedding);

  const days = daysUntil(wedding.date);
  const answered = stats.households - stats.waiting;
  const pct = stats.households ? Math.round((answered / stats.households) * 100) : 0;
  const recent = guests.filter((g) => g.rsvp.respondedAt).sort((a, b) => b.rsvp.respondedAt.localeCompare(a.rsvp.respondedAt)).slice(0, 5);
  const uploadLink = generalUploadLink(wedding.slug);

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${wedding.slug}.png`;
    a.click();
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{days > 0 ? t('daysLeft', { days: daysLabel(days) }) : t('weddingPassed')}</p>
          <h1>{t('hello', { p1: wedding.partner1, p2: wedding.partner2 })}</h1>
        </div>
        <div className="row">
          <Link to="/app/pozivnica" className="btn btn-outline">{t('editInvitation')}</Link>
          <Link to="/app/gosti" className="btn btn-primary"><Icon name="plus" size={18} /> {t('addGuests')}</Link>
        </div>
      </div>

      <section className="grid-cards" aria-label={t('stats.label')}>
        <div className="card stat"><span className="muted small">{t('stats.invited')}</span><strong>{stats.invitedPeople}</strong><span className="xs muted">{t('stats.invitations', { count: stats.households })}</span></div>
        <div className="card stat"><span className="muted small">{t('stats.coming')}</span><strong style={{ color: 'var(--green)' }}>{stats.comingPeople}</strong><span className="xs muted">{t('stats.declined', { count: stats.declined })}</span></div>
        <div className="card stat"><span className="muted small">{t('stats.waiting')}</span><strong style={{ color: 'var(--gold)' }}>{stats.waiting}</strong><span className="xs muted">{t('stats.opened', { count: stats.opened })}</span></div>
        <div className="card stat"><span className="muted small">{t('common:nav.photos')}</span><strong>{counts.all}</strong><span className="xs muted">{t('stats.pendingPhotos', { count: counts.pending })}</span></div>
      </section>

      <div className="two-col">
        <div className="main stack" style={{ '--gap': '24px' }}>
          <section className="card stack" aria-labelledby="rsvp-h">
            <div className="row between">
              <h2 id="rsvp-h">{t('replies.title')}</h2>
              <span className="small muted">{t('replies.progress', { answered, total: stats.households, pct })}</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
            {recent.length === 0 ? (
              <div className="empty"><span className="muted">{t('replies.empty')}</span></div>
            ) : (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, '--gap': '0' }}>
                {recent.map((g) => (
                  <li key={g.id} className="row between" style={{ padding: '12px 0', borderBottom: '1px solid #f0ebe2', '--gap': '12px' }}>
                    <div className="stack grow" style={{ '--gap': '0' }}>
                      <strong style={{ fontWeight: 500 }}>{g.name}</strong>
                      <span className="xs muted">{formatDateTime(g.rsvp.respondedAt)}{g.rsvp.note ? ` · ${g.rsvp.note}` : ''}</span>
                    </div>
                    <span className="small muted">{g.rsvp.status === 'yes' ? persons(g.rsvp.persons) : ''}</span>
                    <RsvpBadge status={g.rsvp.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link to="/app/gosti" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>{t('replies.allGuests')} <Icon name="chevronRight" size={16} /></Link>
          </section>

          <section className="card stack" aria-labelledby="pend-h">
            <div className="row between">
              <h2 id="pend-h">{t('newPhotos.title')}</h2>
              <Link to="/app/fotografije" className="btn btn-ghost btn-sm">{t('newPhotos.all', { count: counts.pending })}</Link>
            </div>
            {pending.length === 0 ? (
              <div className="empty"><strong>{t('newPhotos.allReviewed')}</strong><span className="small muted">{t('newPhotos.emptyHint')}</span></div>
            ) : (
              <div className="photo-grid">
                {pending.map((p) => (
                  <div className="photo-card" key={p.id}>
                    <div className="photo-thumb" style={{ cursor: 'default' }}><img src={p.url} alt={p.message || t('newPhotos.from', { name: p.senderName })} loading="lazy" /></div>
                    <span className="xs muted">{t('newPhotos.fromLabel', { name: p.senderName })}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'approved' }))}>{t('photos:approve')}</button>
                      <button className="btn btn-soft btn-sm" onClick={() => dispatch(setPhotoStatus({ id: p.id, status: 'hidden' }))}>{t('photos:hide')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="side stack" style={{ '--gap': '24px' }}>
          <section className="card card-dark stack" aria-labelledby="qr-h">
            <p className="eyebrow" style={{ color: 'var(--champagne)' }}>{t('qr.eyebrow')}</p>
            <h2 id="qr-h">{t('qr.title')}</h2>
            <div ref={qrRef} style={{ alignSelf: 'center', padding: 14, background: '#fff', borderRadius: 14 }}>
              <QRCodeCanvas value={uploadLink} size={168} fgColor="#1E2A24" level="M" />
            </div>
            <p className="xs muted" style={{ wordBreak: 'break-all' }}>{uploadLink}</p>
            <div className="row">
              <button className="btn btn-champagne btn-sm" onClick={downloadQr}><Icon name="download" size={16} /> {t('qr.download')}</button>
              <CopyButton text={uploadLink} className="btn btn-sm" label={t('common:actions.copy')} />
            </div>
          </section>

          <section className="card stack" aria-labelledby="notify-h">
            <div className="row between">
              <h2 id="notify-h">{t('notify.title')}</h2>
              <span className={`badge ${galleryOpen ? 'badge-yes' : 'badge-no'}`} style={{ fontSize: 12 }}>{galleryOpen ? t('notify.galleryOpen') : t('notify.galleryClosed')}</span>
            </div>
            <ul className="stack small" style={{ listStyle: 'none', margin: 0, padding: 0, '--gap': '4px', color: 'var(--ink-2)' }}>
              <li><strong style={{ fontWeight: 500 }}>{notify.toSend}</strong> {t('notify.toSend')}{notify.subscriberPending.length ? ` ${t('notify.viaQr', { count: notify.subscriberPending.length })}` : ''}</li>
              <li><strong style={{ fontWeight: 500 }}>{notify.alreadySent}</strong> {t('notify.alreadySent')}</li>
              <li><strong style={{ fontWeight: 500 }}>{notify.withoutEmail.length}</strong> {t('notify.withoutEmail')}</li>
            </ul>
            {!galleryOpen && <p className="xs muted">{t('notify.openFirst')} <Link to="/app/podesavanja">{t('notify.openFirstLink')}</Link>.</p>}
            <button className="btn btn-primary" onClick={() => setNotifyModal('email')}><Icon name="mail" size={18} /> {t('notifications:notifyButton')}</button>
            <button className="btn btn-outline" onClick={() => setNotifyModal('share')}><Icon name="whatsapp" size={18} /> WhatsApp / Viber</button>
          </section>

          <section className="card card-cream stack" aria-labelledby="album-h">
            <h2 id="album-h">{t('common:nav.bigAlbum')}</h2>
            <p style={{ color: 'var(--ink-2)' }}>
              {t('album.text', { count: counts.approved })}
            </p>
            <div className="row">
              <Link to="/app/veliki-album" className="btn btn-primary">{t('album.open')}</Link>
              <Link to="/app/custom-dizajn" className="btn btn-outline">{t('common:nav.customDesign')}</Link>
            </div>
          </section>
        </div>
      </div>
      {notifyModal === 'email' && <NotifyGuestsModal onClose={() => setNotifyModal(null)} />}
      {notifyModal === 'share' && <ShareReadyModal onClose={() => setNotifyModal(null)} />}
    </>
  );
}
