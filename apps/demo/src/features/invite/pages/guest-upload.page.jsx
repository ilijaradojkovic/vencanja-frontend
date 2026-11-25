import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchInvitation, fetchPublicWedding, subscribeNotify, uploadPhotos } from '../services/invite.service';
import { resetUpload } from '../store/invite.store';
import Icon from '../../../components/Icon';
import { PageLoading, Spinner } from '../../../components/ui';
import { photosLabel } from '../../../utils/format';
import NotFound from '../../common/pages/not-found.page';
import { galleryStatusText } from '../components/galleryStatus';
import { isEmail } from '../../../utils/gallery';
import { eventNames } from '../../../utils/event';

const MAX_FILES = 50;

export default function GuestUpload() {
  const { t } = useTranslation('invite');
  const { token, slug } = useParams();
  const dispatch = useAppDispatch();
  const { guest, wedding, status, error, upload } = useAppSelector((s) => s.invite);
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('wedding');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState('');
  const [notifyMe, setNotifyMe] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifiedAs, setNotifiedAs] = useState('');

  const loadedForThis = status === 'succeeded' && (token ? guest?.token === token : wedding?.slug === slug && !guest);

  useEffect(() => {
    dispatch(resetUpload());
    if (token) dispatch(fetchInvitation(token));
    else dispatch(fetchPublicWedding(slug));
  }, [dispatch, token, slug]);

  useEffect(() => {
    if (guest?.name) setSenderName(guest.name);
  }, [guest?.name]);

  useEffect(() => {
    if (guest?.prefillEmail) setNotifyEmail(guest.prefillEmail);
  }, [guest?.prefillEmail]);

  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  if (status === 'failed') return <NotFound title={t('errors.badLink')} text={error} />;
  if (!loadedForThis) return <PageLoading />;
  if (!token && !wedding.settings?.allowGeneralUpload) {
    return <NotFound title={t('upload.disabledTitle')} text={t('upload.disabledText')} />;
  }

  const addFiles = (list) => {
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (imgs.length < list.length) setLocalError(t('upload.notImages'));
    else setLocalError('');
    const room = MAX_FILES - files.length;
    if (imgs.length > room) setLocalError(t('upload.tooMany', { max: MAX_FILES }));
    setFiles((prev) => [...prev, ...imgs.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removeFile = (i) => {
    URL.revokeObjectURL(files[i].url);
    setFiles(files.filter((_, j) => j !== i));
  };

  const alreadyNotified = !!guest?.notifyEmail;
  const canNotify = !alreadyNotified && (token || wedding.gallery?.viaQr) && !wedding.gallery?.open;

  const send = async () => {
    if (!files.length) return;
    const wantsNotify = canNotify && notifyMe;
    if (wantsNotify && !isEmail(notifyEmail)) return setLocalError(t('upload.notifyEmailError'));
    setLocalError('');
    const res = await dispatch(uploadPhotos({ token, slug, files: files.map((f) => f.file), category, senderName, message }));
    if (res.meta.requestStatus === 'fulfilled') {
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      setMessage('');
      if (wantsNotify) {
        const sub = await dispatch(subscribeNotify({ token, slug, email: notifyEmail.trim(), name: senderName }));
        if (sub.meta.requestStatus === 'fulfilled') setNotifiedAs(sub.payload.notifyEmail);
      }
    }
  };

  const uploading = upload.status === 'loading';
  const backTo = token ? `/i/${token}` : null;

  return (
    <div className="guest-page">
      <div className="guest-wrap">
        <header className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          {backTo ? (
            <Link to={backTo} className="icon-btn" aria-label={t('backToInvitation')}><Icon name="chevronLeft" /></Link>
          ) : <span style={{ width: 44 }} />}
          <div className="stack" style={{ '--gap': '0', textAlign: 'center' }}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{eventNames(wedding)}</span>
            <span className="xs muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('albumOfMemories')}</span>
          </div>
          <LanguageSwitcher />
        </header>

        {upload.status === 'succeeded' ? (
          <div className="stack reveal" style={{ padding: '64px 28px', alignItems: 'center', textAlign: 'center' }}>
            <span style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--green)', color: '#F6F3EE', display: 'grid', placeItems: 'center' }}>
              <Icon name="check" size={40} />
            </span>
            <h1>{t('upload.thanks')}</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 17 }}>
              {t('upload.sentText', { photos: photosLabel(upload.result.uploaded), p1: wedding.partner1, p2: wedding.partner2 })}
            </p>
            {notifiedAs && (
              <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="mail" size={16} /> {t('upload.willNotify', { email: notifiedAs })}
              </p>
            )}
            <button className="btn btn-outline btn-lg" onClick={() => dispatch(resetUpload())}>{t('upload.sendMore')}</button>
            {wedding.gallery?.open && (token || wedding.gallery.viaQr) && (
              <Link to={token ? `/i/${token}/galerija` : `/w/${slug}/galerija`} className="btn btn-primary btn-lg"><Icon name="image" /> {t('gallery.view')}</Link>
            )}
            {backTo && <Link to={backTo} className="btn btn-ghost">{t('backToInvitation')}</Link>}
          </div>
        ) : (
          <div className="stack" style={{ padding: '20px 16px 40px', '--gap': '20px' }}>
            <div className="segmented" role="group" aria-label={t('upload.kindAria')} style={{ width: '100%', gridAutoColumns: '1fr' }}>
              <button aria-pressed={category === 'wedding'} onClick={() => setCategory('wedding')}>{t('upload.kindWedding')}</button>
              <button aria-pressed={category === 'memories'} onClick={() => setCategory('memories')}>{t('upload.kindMemories')}</button>
            </div>
            <p style={{ color: 'var(--ink-2)' }}>
              {category === 'wedding'
                ? t('upload.kindWeddingText')
                : t('upload.kindMemoriesText')}
            </p>

            <button type="button" className={`dropzone ${drag ? 'drag' : ''}`} onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
              disabled={uploading}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
                <Icon name="image" size={26} />
              </span>
              <strong style={{ fontWeight: 500, fontSize: 17 }}>{t('upload.choose')}</strong>
              <span className="xs muted">{t('upload.chooseHint', { max: MAX_FILES })}</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            {localError && <div className="form-error" role="alert">{localError}</div>}

            {files.length > 0 && (
              <div className="stack" style={{ '--gap': '10px' }}>
                <div className="row between">
                  <strong style={{ fontWeight: 500 }}>{t('upload.selected', { count: files.length })}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => { files.forEach((f) => URL.revokeObjectURL(f.url)); setFiles([]); }} disabled={uploading}>{t('upload.removeAll')}</button>
                </div>
                <div className="preview-grid">
                  {files.map((f, i) => (
                    <div className="tile" key={f.url}>
                      <img src={f.url} alt={f.file.name} />
                      {!uploading && (
                        <button className="remove" onClick={() => removeFile(i)} aria-label={t('upload.removeFile', { name: f.file.name })}><Icon name="x" size={14} stroke={2.2} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="field">
              <span>{t('upload.sender')}</span>
              <input className="input" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={t('upload.senderPlaceholder')} />
            </label>
            <label className="field">
              <span>{t('upload.message')}</span>
              <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('upload.messagePlaceholder')} />
            </label>

            {canNotify && (
              <div className="stack" style={{ '--gap': '10px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)' }}>
                <label className="check" style={{ minHeight: 0, padding: 0 }}>
                  <input type="checkbox" checked={notifyMe} onChange={(e) => setNotifyMe(e.target.checked)} />
                  <span>{t('upload.notifyMe')}<br /><span className="xs muted">{galleryStatusText(wedding.gallery)}</span></span>
                </label>
                {notifyMe && (
                  <input className="input" type="email" inputMode="email" autoComplete="email" value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)} placeholder={t('notify.emailPlaceholder')} aria-label={t('upload.notifyEmailAria')} />
                )}
              </div>
            )}
            {alreadyNotified && (
              <p className="xs muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="mail" size={14} /> {t('upload.willNotifyGallery', { email: guest.notifyEmail })}
              </p>
            )}

            {uploading && (
              <div className="stack" style={{ '--gap': '6px' }}>
                <div className="progress" role="progressbar" aria-valuenow={upload.progress} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${upload.progress}%` }} />
                </div>
                <span className="xs muted">{t('upload.sending', { progress: upload.progress })}</span>
              </div>
            )}

            <button className="btn btn-primary btn-lg" onClick={send} disabled={!files.length || uploading}>
              {uploading ? <Spinner light /> : files.length ? t('upload.send', { photos: photosLabel(files.length) }) : t('upload.chooseFirst')}
            </button>

            <div className="row" style={{ alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'var(--surface-2)', '--gap': '10px' }}>
              <Icon name="lock" style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <p className="xs" style={{ color: 'var(--ink-2)', flex: 1 }}>
                {t('upload.privacy')} {galleryStatusText(wedding.gallery)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
