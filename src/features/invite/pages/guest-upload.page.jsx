import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchInvitation, fetchPublicWedding, subscribeNotify, uploadPhotos } from '../services/invite.service';
import { resetUpload } from '../store/invite.store';
import Icon from '../../../components/Icon';
import { PageLoading, Spinner } from '../../../components/ui';
import { photosLabel } from '../../../utils/format';
import NotFound from '../../common/pages/not-found.page';
import { galleryStatusText } from '../components/galleryStatus';
import { isEmail } from '../../../utils/gallery';

const MAX_FILES = 50;

export default function GuestUpload() {
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

  if (status === 'failed') return <NotFound title="Link nije ispravan" text={error} />;
  if (!loadedForThis) return <PageLoading />;
  if (!token && !wedding.settings?.allowGeneralUpload) {
    return <NotFound title="Slanje je isključeno" text="Mladenci su trenutno isključili slanje slika preko ovog linka." />;
  }

  const addFiles = (list) => {
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (imgs.length < list.length) setLocalError('Neki fajlovi nisu slike i preskočeni su.');
    else setLocalError('');
    const room = MAX_FILES - files.length;
    if (imgs.length > room) setLocalError(`Najviše ${MAX_FILES} fotografija odjednom.`);
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
    if (wantsNotify && !isEmail(notifyEmail)) return setLocalError('Unesite ispravan email za obaveštenje ili isključite tu opciju.');
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
            <Link to={backTo} className="icon-btn" aria-label="Nazad na pozivnicu"><Icon name="chevronLeft" /></Link>
          ) : <span style={{ width: 44 }} />}
          <div className="stack" style={{ '--gap': '0', textAlign: 'center' }}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{wedding.partner1} &amp; {wedding.partner2}</span>
            <span className="xs muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Album uspomena</span>
          </div>
          <span style={{ width: 44 }} />
        </header>

        {upload.status === 'succeeded' ? (
          <div className="stack reveal" style={{ padding: '64px 28px', alignItems: 'center', textAlign: 'center' }}>
            <span style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--green)', color: '#F6F3EE', display: 'grid', placeItems: 'center' }}>
              <Icon name="check" size={40} />
            </span>
            <h1>Hvala vam!</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 17 }}>
              Poslali ste {photosLabel(upload.result.uploaded)}. {wedding.partner1} i {wedding.partner2} će ih videti odmah, a najlepše ulaze u album.
            </p>
            {notifiedAs && (
              <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="mail" size={16} /> Javićemo vam na {notifiedAs} kad galerija bude otvorena.
              </p>
            )}
            <button className="btn btn-outline btn-lg" onClick={() => dispatch(resetUpload())}>Pošalji još</button>
            {wedding.gallery?.open && (token || wedding.gallery.viaQr) && (
              <Link to={token ? `/i/${token}/galerija` : `/w/${slug}/galerija`} className="btn btn-primary btn-lg"><Icon name="image" /> Pogledaj galeriju</Link>
            )}
            {backTo && <Link to={backTo} className="btn btn-ghost">Nazad na pozivnicu</Link>}
          </div>
        ) : (
          <div className="stack" style={{ padding: '20px 16px 40px', '--gap': '20px' }}>
            <div className="segmented" role="group" aria-label="Vrsta slika" style={{ width: '100%', gridAutoColumns: '1fr' }}>
              <button aria-pressed={category === 'wedding'} onClick={() => setCategory('wedding')}>Sa venčanja</button>
              <button aria-pressed={category === 'memories'} onClick={() => setCategory('memories')}>Naše zajedničke</button>
            </div>
            <p style={{ color: 'var(--ink-2)' }}>
              {category === 'wedding'
                ? 'Uslikali ste nešto lepo na proslavi? Pošaljite direktno ovde, bez aplikacije i bez prijave.'
                : 'Stare fotografije sa mladencima: putovanja, žurke, detinjstvo. Ulaze u poglavlje „Pre venčanja“.'}
            </p>

            <button type="button" className={`dropzone ${drag ? 'drag' : ''}`} onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
              disabled={uploading}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
                <Icon name="image" size={26} />
              </span>
              <strong style={{ fontWeight: 500, fontSize: 17 }}>Izaberi fotografije</strong>
              <span className="xs muted">Galerija ili kamera · do {MAX_FILES} odjednom · originalna rezolucija</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            {localError && <div className="form-error" role="alert">{localError}</div>}

            {files.length > 0 && (
              <div className="stack" style={{ '--gap': '10px' }}>
                <div className="row between">
                  <strong style={{ fontWeight: 500 }}>Izabrano: {files.length}</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => { files.forEach((f) => URL.revokeObjectURL(f.url)); setFiles([]); }} disabled={uploading}>Ukloni sve</button>
                </div>
                <div className="preview-grid">
                  {files.map((f, i) => (
                    <div className="tile" key={f.url}>
                      <img src={f.url} alt={f.file.name} />
                      {!uploading && (
                        <button className="remove" onClick={() => removeFile(i)} aria-label={`Ukloni ${f.file.name}`}><Icon name="x" size={14} stroke={2.2} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="field">
              <span>Šalje</span>
              <input className="input" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Vaše ime" />
            </label>
            <label className="field">
              <span>Poruka za mladence (biće uz slike u albumu)</span>
              <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Napišite par reči…" />
            </label>

            {canNotify && (
              <div className="stack" style={{ '--gap': '10px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)' }}>
                <label className="check" style={{ minHeight: 0, padding: 0 }}>
                  <input type="checkbox" checked={notifyMe} onChange={(e) => setNotifyMe(e.target.checked)} />
                  <span>Obavesti me kad galerija bude otvorena<br /><span className="xs muted">{galleryStatusText(wedding.gallery)}</span></span>
                </label>
                {notifyMe && (
                  <input className="input" type="email" inputMode="email" autoComplete="email" value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)} placeholder="vas@email.com" aria-label="Email za obaveštenje" />
                )}
              </div>
            )}
            {alreadyNotified && (
              <p className="xs muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="mail" size={14} /> Obavestićemo vas na {guest.notifyEmail} kad galerija bude otvorena.
              </p>
            )}

            {uploading && (
              <div className="stack" style={{ '--gap': '6px' }}>
                <div className="progress" role="progressbar" aria-valuenow={upload.progress} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${upload.progress}%` }} />
                </div>
                <span className="xs muted">Slanje… {upload.progress}%</span>
              </div>
            )}

            <button className="btn btn-primary btn-lg" onClick={send} disabled={!files.length || uploading}>
              {uploading ? <Spinner light /> : files.length ? `Pošalji ${photosLabel(files.length)}` : 'Prvo izaberite fotografije'}
            </button>

            <div className="row" style={{ alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'var(--surface-2)', '--gap': '10px' }}>
              <Icon name="lock" style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <p className="xs" style={{ color: 'var(--ink-2)', flex: 1 }}>
                Slike vide samo mladenci dok ih ne odobre. {galleryStatusText(wedding.gallery)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
