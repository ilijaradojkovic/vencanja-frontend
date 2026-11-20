import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchGallery, fetchInvitation, fetchPublicWedding } from '../services/invite.service';
import NotifyEmailForm from '../components/NotifyEmailForm';
import { galleryStatusText } from '../components/galleryStatus';
import Icon from '../../../components/Icon';
import { Lightbox, PageLoading } from '../../../components/ui';
import { CATEGORIES, photosLabel } from '../../../utils/format';
import NotFound from '../../common/pages/not-found.page';

export default function GuestGallery() {
  const { token, slug } = useParams();
  const dispatch = useAppDispatch();
  const { guest, wedding, status, error, gallery } = useAppSelector((s) => s.invite);
  const [cat, setCat] = useState('all');
  const [index, setIndex] = useState(null);
  const [subscribed, setSubscribed] = useState('');

  useEffect(() => {
    if (token) dispatch(fetchInvitation(token));
    else dispatch(fetchPublicWedding(slug));
    dispatch(fetchGallery({ token, slug }));
  }, [dispatch, token, slug]);

  const photos = useMemo(
    () => (gallery.data?.photos || []).filter((p) => cat === 'all' || p.category === cat),
    [gallery.data, cat],
  );

  const loaded = status === 'succeeded' && (token ? guest?.token === token : wedding?.slug === slug && !guest);
  if (status === 'failed') return <NotFound title="Link nije ispravan" text={error} />;
  if (gallery.status === 'failed') return <NotFound title="Galerija nije dostupna" text={gallery.error} />;
  if (!loaded || gallery.status !== 'succeeded') return <PageLoading />;

  const backTo = token ? `/i/${token}` : null;
  const uploadTo = token ? `/i/${token}/upload` : `/w/${slug}/upload`;
  const notifyEmail = subscribed || guest?.notifyEmail;
  const all = gallery.data.photos;

  return (
    <div className="guest-page">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          {backTo ? (
            <Link to={backTo} className="icon-btn" aria-label="Nazad na pozivnicu"><Icon name="chevronLeft" /></Link>
          ) : <span style={{ width: 44 }} />}
          <div className="stack" style={{ '--gap': '0', textAlign: 'center' }}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{wedding.partner1} &amp; {wedding.partner2}</span>
            <span className="xs muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Galerija</span>
          </div>
          <Link to={uploadTo} className="icon-btn" aria-label="Pošalji slike"><Icon name="upload" /></Link>
        </header>

        {!gallery.data.open ? (
          <div className="stack" style={{ maxWidth: 520, margin: '0 auto', padding: '56px 20px', '--gap': '16px', textAlign: 'center' }}>
            <span style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
              <Icon name="lock" size={30} />
            </span>
            <h1 style={{ fontSize: 32 }}>Galerija još nije otvorena</h1>
            <p style={{ color: 'var(--ink-2)' }}>{galleryStatusText(gallery.data)}</p>
            {notifyEmail ? (
              <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="mail" size={16} /> Obavestićemo vas na {notifyEmail}.
              </p>
            ) : (
              <div className="card stack" style={{ textAlign: 'left' }}>
                <strong style={{ fontWeight: 500 }}>Javite mi kad bude otvorena</strong>
                <NotifyEmailForm token={token} slug={slug} initialEmail={guest?.prefillEmail || ''} onDone={setSubscribed} />
              </div>
            )}
            <Link to={uploadTo} className="btn btn-outline btn-lg"><Icon name="upload" /> Pošalji svoje slike</Link>
          </div>
        ) : (
          <div className="stack" style={{ padding: '20px 16px 48px', '--gap': '16px' }}>
            <div className="row between">
              <span className="small muted">{photosLabel(all.length)} od gostiju</span>
              <div className="chips" role="group" aria-label="Kategorija">
                {[['all', 'Sve'], ...Object.entries(CATEGORIES)].map(([k, label]) => (
                  <button key={k} className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>{label}</button>
                ))}
              </div>
            </div>
            {photos.length === 0 ? (
              <div className="empty"><strong>Još nema slika{cat !== 'all' ? ' u ovoj kategoriji' : ''}.</strong></div>
            ) : (
              <div className="photo-grid">
                {photos.map((p, i) => (
                  <button key={p.id} className="photo-thumb" onClick={() => setIndex(i)} aria-label={`Uvećaj fotografiju od ${p.senderName}`}>
                    <img src={p.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {index !== null && <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />}
    </div>
  );
}
