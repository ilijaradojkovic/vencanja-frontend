import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateWedding, fetchWedding } from '../services/wedding.service';
import { fetchGuests } from '../../guests/services/guests.service';
import { fetchPhotos } from '../../photos/services/photos.service';
import { fetchRequests } from '../../requests/services/requests.service';
import { toast } from 'react-toastify';
import { ResetMockData } from '../../../mock/mock.api';
import env from '../../../app/config/env';
import { ConfirmModal, Spinner } from '../../../components/ui';
import { formatDate, generalUploadLink } from '../../../utils/format';
import { GalleryOpenMode } from '../../../app/config/enums';
import { galleryOpensAt, isGalleryOpen } from '../../../utils/gallery';
import { updateMe } from '../../auth/services/auth.service';
import PhoneField from '../../../components/PhoneField';
import { normalizePhone, phoneError } from '../../../utils/phone';

function AccountSection() {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const saving = useAppSelector((s) => s.auth.savingMe);
  const [phone, setPhone] = useState(user?.phone || '');
  const [error, setError] = useState('');
  const clean = normalizePhone(phone);
  const changed = clean !== (user?.phone || '');

  const save = async (e) => {
    e.preventDefault();
    if (!clean) return setError(phoneError());
    const res = await dispatch(updateMe({ phone: clean }));
    if (res.meta.requestStatus === 'fulfilled') {
      setPhone(res.payload.phone);
      toast.success(t('common:phone.saved'));
    } else setError(res.payload?.message);
  };

  return (
    <form id="nalog" className="card stack" style={{ maxWidth: 720 }} onSubmit={save}>
      <h2>{t('account.title')}</h2>
      <label className="field"><span>{t('account.email')}</span>
        <input className="input" value={user?.email || ''} readOnly disabled /></label>
      <PhoneField value={phone} onChange={(v) => { setPhone(v); setError(''); }} error={error}
        hint={t('account.phoneHint')} />
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !changed}>
        {saving ? <Spinner light /> : t('common:phoneRequired.save')}
      </button>
    </form>
  );
}

export default function Settings() {
  const { t } = useTranslation('settings');
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const saving = useAppSelector((s) => s.wedding.saving);
  const [f, setF] = useState({ slug: wedding.slug, city: wedding.city, ...wedding.settings });
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const { slug, city, ...settings } = f;
    const res = await dispatch(updateWedding({ slug, city, settings }));
    if (res.meta.requestStatus === 'fulfilled') toast.success(t('saved'));
    else setError(res.payload?.message);
  };

  const reset = async () => {
    setResetting(true);
    await ResetMockData();
    await dispatch(fetchWedding());
    dispatch(fetchGuests());
    dispatch(fetchPhotos());
    dispatch(fetchRequests());
    setResetting(false);
    setResetOpen(false);
    toast.success(t('demo.resetDone'));
  };

  const toggle = (k) => (e) => setF({ ...f, [k]: e.target.checked });

  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#nalog') document.getElementById('nalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
      <div className="page-head"><h1>{t('common:nav.settings')}</h1></div>
      <AccountSection />
      <form className="card stack" style={{ maxWidth: 720 }} onSubmit={save}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <h2>{t('wedding.title')}</h2>
        <label className="field"><span>{t('wedding.slug')}</span>
          <input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          <span className="xs">{generalUploadLink(f.slug)}</span>
        </label>
        <label className="field"><span>{t('wedding.city')}</span><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>

        <h2 style={{ marginTop: 10 }}>{t('common:nav.photos')}</h2>
        <label className="check"><input type="checkbox" checked={f.autoApprovePhotos} onChange={toggle('autoApprovePhotos')} />
          <span>{t('photos.autoApprove')}<br /><span className="xs muted">{t('photos.autoApproveHint')}</span></span></label>
        <label className="check"><input type="checkbox" checked={f.allowGeneralUpload} onChange={toggle('allowGeneralUpload')} />
          <span>{t('photos.allowQr')}<br /><span className="xs muted">{t('photos.allowQrHint')}</span></span></label>

        <h2 style={{ marginTop: 10 }}>{t('gallery.title')}</h2>
        <fieldset className="stack" style={{ '--gap': '2px', border: 'none', padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 500, color: 'var(--ink-2)', marginBottom: 4 }}>{t('gallery.when')}</legend>
          {[
            [GalleryOpenMode.NOW, t('gallery.now'), t('gallery.nowHint')],
            [GalleryOpenMode.AFTER_WEDDING, t('gallery.afterWedding'), t('gallery.afterWeddingHint', { date: formatDate(galleryOpensAt({ date: wedding.date, settings: { galleryOpen: GalleryOpenMode.AFTER_WEDDING } })) })],
            [GalleryOpenMode.MANUAL, t('gallery.manual'), t('gallery.manualHint')],
          ].map(([value, label, hint]) => (
            <label key={value} className="check">
              <input type="radio" name="galleryOpen" checked={f.galleryOpen === value} onChange={() => setF({ ...f, galleryOpen: value })} />
              <span>{label}<br /><span className="xs muted">{hint}</span></span>
            </label>
          ))}
        </fieldset>
        {f.galleryOpen === GalleryOpenMode.MANUAL && (
          <label className="check" style={{ marginLeft: 32 }}><input type="checkbox" checked={!!f.galleryManualOpen} onChange={toggle('galleryManualOpen')} />
            <span>{t('gallery.manualOpen')}</span></label>
        )}
        <label className="check"><input type="checkbox" checked={!!f.galleryViaQr} onChange={toggle('galleryViaQr')} />
          <span>{t('gallery.viaQr')}<br /><span className="xs muted">{t('gallery.viaQrHint')}</span></span></label>
        <p className="xs muted">{isGalleryOpen({ date: wedding.date, settings: f }) ? t('gallery.currentlyOpen') : t('gallery.currentlyClosed')}</p>

        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>{saving ? <Spinner light /> : t('common:actions.save')}</button>
      </form>

      {env.useMock && (
        <section className="card stack" style={{ maxWidth: 720 }}>
          <h2>{t('demo.title')}</h2>
          <p className="muted small">{t('demo.text')}</p>
          <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => setResetOpen(true)}>{t('demo.reset')}</button>
        </section>
      )}
      {resetOpen && (
        <ConfirmModal title={t('demo.confirmTitle')} confirmLabel={t('demo.confirm')} busy={resetting} onClose={() => setResetOpen(false)} onConfirm={reset}
          text={t('demo.confirmText')} />
      )}
    </>
  );
}
