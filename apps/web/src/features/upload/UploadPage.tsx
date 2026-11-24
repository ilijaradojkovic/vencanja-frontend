'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { apiFetch } from '@/lib/diagnostics/api';
import { formatDate } from '@/lib/format';

import {
  MAX_FILES,
  MAX_UPLOAD_MB,
  RETRY_DELAYS_MS,
  requestTickets,
  runLimited,
  screenFiles,
  sendOne,
  UploadError,
  xhrPut,
  type FileState,
  type Ticket,
  type Transport,
} from './upload-engine';

type Item = { key: string; file: File; preview: string; ticket?: Ticket; state?: FileState };

export type UploadWedding = {
  names: string;
  partner1: string;
  partner2: string;
  allowGeneralUpload: boolean;
  gallery: { open: boolean; mode: 'now' | 'after_wedding' | 'manual'; opensAt: string | null; viaQr: boolean };
};

export type UploadGuest = { name: string; notifyEmail: string; prefillEmail: string };

const ACTIVE = new Set(['queued', 'uploading', 'processing']);
const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

/**
 * Guest upload (UC-65 personal link, UC-66 QR link) on the SPEC §7.1 flow: files
 * are screened (no HEIC, JPEG/PNG/WebP only, ≤ 30 MB), tickets are requested once,
 * up to three originals are PUT in parallel with per-file and total progress, each
 * is completed, failed files retry automatically three times on the same photo id
 * and can then be tried again or skipped; leaving mid-upload asks for confirmation.
 */
export function UploadPage({
  token,
  slug,
  wedding,
  guest,
  transport = xhrPut,
  retryDelays = RETRY_DELAYS_MS,
}: {
  token?: string;
  slug?: string;
  wedding: UploadWedding;
  guest?: UploadGuest | null;
  transport?: Transport;
  retryDelays?: number[];
}) {
  const { t, i18n } = useTranslation('invite');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState<'wedding' | 'memories'>('wedding');
  const [senderName, setSenderName] = useState(guest?.name ?? '');
  const [message, setMessage] = useState('');
  const [drag, setDrag] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<number | null>(null);
  const [notifyMe, setNotifyMe] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(guest?.prefillEmail ?? '');
  const [notifiedAs, setNotifiedAs] = useState('');
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const busy = items.some((item) => item.state && ACTIVE.has(item.state.phase));
  // SPEC §7.1 step 6: closing the tab while sending asks for confirmation.
  useEffect(() => {
    if (!busy) return undefined;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [busy]);

  if (!token && !wedding.allowGeneralUpload) {
    return (
      <div className="guest-page">
        <div className="stack" style={{ maxWidth: 520, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
          <h1>{t('upload.disabledTitle')}</h1>
          <p className="muted">{t('upload.disabledText')}</p>
        </div>
      </div>
    );
  }

  const galleryStatus = wedding.gallery.open
    ? t('gallery.statusOpen')
    : wedding.gallery.mode === 'after_wedding' && wedding.gallery.opensAt
      ? t('gallery.statusOpensAt', { date: formatDate(wedding.gallery.opensAt, locale) })
      : t('gallery.statusManual');
  const alreadyNotified = Boolean(guest?.notifyEmail);
  const canNotify = !alreadyNotified && (Boolean(token) || wedding.gallery.viaQr) && !wedding.gallery.open;
  const backTo = token ? `/i/${token}` : null;
  const photos = (count: number) => t('common:count.photos', { count });

  const addFiles = (list: FileList | File[]) => {
    const { accepted, rejected } = screenFiles(Array.from(list));
    const messages = rejected.map((entry) =>
      entry.reason === 'heic'
        ? t('upload.heic', { name: entry.name })
        : entry.reason === 'size'
          ? t('upload.tooLarge', { name: entry.name, max: MAX_UPLOAD_MB })
          : t('upload.wrongType', { name: entry.name }),
    );
    const room = MAX_FILES - items.length;
    if (accepted.length > room) messages.push(t('upload.tooMany', { max: MAX_FILES }));
    setNotices(messages);
    setError(null);
    setItems((current) => [
      ...current,
      ...accepted.slice(0, room).map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeItem = (key: string) =>
    setItems((current) => {
      const item = current.find((entry) => entry.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.key !== key);
    });

  const setState = (key: string, state: FileState) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, state } : item)));

  const sendItems = (batch: Item[]): Promise<FileState[]> =>
    runLimited(
      batch.map(
        (item) => () =>
          sendOne(item.ticket as Ticket, item.file, (state) => setState(item.key, state), {
            transport,
            delays: retryDelays,
          }),
      ),
    );

  /** All files are done or skipped → the thank-you screen counts the successful ones. */
  const settle = async (all: Item[]) => {
    if (all.some((item) => item.state?.phase !== 'done')) return;
    const sent = all.length;
    if (sent === 0) {
      // Everything was skipped: back to choosing photos instead of a "0 sent" thank-you.
      setItems([]);
      setStarted(false);
      return;
    }
    if (canNotify && notifyMe) {
      const path = token
        ? `/api/public/invitations/${encodeURIComponent(token)}/notify`
        : `/api/public/weddings/${encodeURIComponent(slug ?? '')}/notify`;
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: notifyEmail.trim(), name: senderName }),
      });
      if (response.ok) setNotifiedAs(((await response.json()) as { notifyEmail: string }).notifyEmail);
    }
    all.forEach((item) => URL.revokeObjectURL(item.preview));
    setItems([]);
    setStarted(false);
    setFinished(sent);
    setMessage('');
  };

  const send = async () => {
    if (!items.length) return;
    if (canNotify && notifyMe && !isEmail(notifyEmail)) return setError(t('upload.notifyEmailError'));
    setError(null);
    setNotices([]);
    setStarted(true);
    let tickets: Ticket[];
    try {
      tickets = await requestTickets(
        { token, slug },
        { category, senderName, message, files: items.map((i) => i.file) },
      );
    } catch (caught) {
      setStarted(false);
      return setError(caught instanceof UploadError ? caught.message : t('common:errors.saveFailed'));
    }
    const ready = items.map((item, index) => ({
      ...item,
      ticket: tickets[index],
      state: { phase: 'queued' } as FileState,
    }));
    setItems(ready);
    const results = await sendItems(ready);
    await settle(ready.map((item, index) => ({ ...item, state: results[index] })));
  };

  const retry = async (key: string) => {
    const item = itemsRef.current.find((entry) => entry.key === key);
    if (!item?.ticket) return;
    const [state] = await sendItems([item]);
    // Only this file was active, so the others' states in the ref are final.
    await settle(itemsRef.current.map((entry) => (entry.key === key ? { ...entry, state } : entry)));
  };

  const skip = (key: string) => {
    const remaining = itemsRef.current.filter((entry) => entry.key !== key);
    removeItem(key);
    void settle(remaining);
  };

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const sentBytes = items.reduce((sum, item) => {
    const state = item.state;
    if (!state) return sum;
    if (state.phase === 'uploading') return sum + Math.min(state.loaded, item.file.size);
    return state.phase === 'queued' || state.phase === 'failed' ? sum : sum + item.file.size;
  }, 0);
  const totalProgress = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0;
  const failed = items.filter((item) => item.state?.phase === 'failed' || item.state?.phase === 'rejected');

  const stateLabel = (item: Item) => {
    const state = item.state;
    if (!state) return null;
    if (state.phase === 'uploading') {
      return t('upload.state.uploading', { progress: Math.round((state.loaded / Math.max(item.file.size, 1)) * 100) });
    }
    return t(`upload.state.${state.phase}`);
  };

  return (
    <div className="guest-page">
      <div className="guest-wrap">
        <header className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          {backTo ? (
            <Link href={backTo} className="icon-btn" aria-label={t('backToInvitation')}>
              <Icon name="chevronLeft" />
            </Link>
          ) : (
            <span style={{ width: 44 }} />
          )}
          <div className="stack" style={{ '--gap': '0', textAlign: 'center' } as CSSProperties}>
            <span className="serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>
              {wedding.names}
            </span>
            <span className="xs muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('albumOfMemories')}
            </span>
          </div>
          <LanguageSwitcher current={locale} label="Jezik" />
        </header>

        {finished !== null ? (
          <div className="stack reveal" style={{ padding: '64px 28px', alignItems: 'center', textAlign: 'center' }}>
            <span
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'var(--green)',
                color: '#F6F3EE',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="check" size={40} />
            </span>
            <h1>{t('upload.thanks')}</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: 17 }}>
              {t('upload.sentText', { photos: photos(finished), p1: wedding.partner1, p2: wedding.partner2 })}
            </p>
            {notifiedAs ? (
              <p className="small muted">
                <Icon name="mail" size={16} /> {t('upload.willNotify', { email: notifiedAs })}
              </p>
            ) : null}
            <button type="button" className="btn btn-outline btn-lg" onClick={() => setFinished(null)}>
              {t('upload.sendMore')}
            </button>
            {wedding.gallery.open && (token || wedding.gallery.viaQr) ? (
              <Link
                href={token ? `/i/${token}/galerija` : `/w/${slug ?? ''}/galerija`}
                className="btn btn-primary btn-lg"
              >
                <Icon name="image" /> {t('gallery.view')}
              </Link>
            ) : null}
            {backTo ? (
              <Link href={backTo} className="btn btn-ghost">
                {t('backToInvitation')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="stack" style={{ padding: '20px 16px 40px', '--gap': '20px' } as CSSProperties}>
            <div
              className="segmented"
              role="group"
              aria-label={t('upload.kindAria')}
              style={{ width: '100%', gridAutoColumns: '1fr' }}
            >
              <button
                type="button"
                aria-pressed={category === 'wedding'}
                disabled={started}
                onClick={() => setCategory('wedding')}
              >
                {t('upload.kindWedding')}
              </button>
              <button
                type="button"
                aria-pressed={category === 'memories'}
                disabled={started}
                onClick={() => setCategory('memories')}
              >
                {t('upload.kindMemories')}
              </button>
            </div>
            <p style={{ color: 'var(--ink-2)' }}>
              {category === 'wedding' ? t('upload.kindWeddingText') : t('upload.kindMemoriesText')}
            </p>

            <button
              type="button"
              className={`dropzone ${drag ? 'drag' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDrag(false);
                addFiles(event.dataTransfer.files);
              }}
              disabled={started}
            >
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--gold)',
                }}
              >
                <Icon name="image" size={26} />
              </span>
              <strong style={{ fontWeight: 500, fontSize: 17 }}>{t('upload.choose')}</strong>
              <span className="xs muted">{t('upload.chooseHint', { max: MAX_FILES })}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              data-testid="file-input"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            {notices.length ? (
              <div className="form-error" role="alert">
                {notices.map((notice) => (
                  <div key={notice}>{notice}</div>
                ))}
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="stack" style={{ '--gap': '10px' } as CSSProperties}>
                <div className="row between">
                  <strong style={{ fontWeight: 500 }}>{t('upload.selected', { count: items.length })}</strong>
                  {!started ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        items.forEach((item) => URL.revokeObjectURL(item.preview));
                        setItems([]);
                      }}
                    >
                      {t('upload.removeAll')}
                    </button>
                  ) : null}
                </div>
                <div className="preview-grid">
                  {items.map((item) => (
                    <div className="tile" key={item.key} data-testid="upload-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                      <img src={item.preview} alt={item.file.name} />
                      {!started ? (
                        <button
                          type="button"
                          className="remove"
                          onClick={() => removeItem(item.key)}
                          aria-label={t('upload.removeFile', { name: item.file.name })}
                        >
                          <Icon name="x" size={14} stroke={2.2} />
                        </button>
                      ) : null}
                      {item.state ? (
                        <span
                          className="xs"
                          data-phase={item.state.phase}
                          style={{
                            position: 'absolute',
                            left: 4,
                            right: 4,
                            bottom: 4,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.92)',
                            textAlign: 'center',
                          }}
                        >
                          {stateLabel(item)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {failed.length > 0 && !busy ? (
              <div className="stack" role="alert" style={{ '--gap': '8px' } as CSSProperties}>
                <span className="small">{t('upload.someFailed', { count: failed.length })}</span>
                {failed.map((item) => (
                  <div key={item.key} className="row between" style={{ '--gap': '8px' } as CSSProperties}>
                    <span className="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.file.name}
                      {item.state?.phase === 'rejected' ? ` · ${item.state.message}` : ` · ${t('upload.state.failed')}`}
                    </span>
                    <div className="row" style={{ '--gap': '6px' } as CSSProperties}>
                      {item.state?.phase === 'failed' ? (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => void retry(item.key)}>
                          {t('upload.retry')}
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => skip(item.key)}>
                        {t('upload.skip')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="field">
              <span>{t('upload.sender')}</span>
              <input
                className="input"
                value={senderName}
                disabled={started}
                onChange={(event) => setSenderName(event.target.value)}
                placeholder={t('upload.senderPlaceholder')}
              />
            </label>
            <label className="field">
              <span>{t('upload.message')}</span>
              <textarea
                className="textarea"
                rows={3}
                value={message}
                disabled={started}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('upload.messagePlaceholder')}
              />
            </label>

            {canNotify ? (
              <div
                className="stack"
                style={
                  {
                    '--gap': '10px',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                  } as CSSProperties
                }
              >
                <label className="check" style={{ minHeight: 0, padding: 0 }}>
                  <input type="checkbox" checked={notifyMe} onChange={(event) => setNotifyMe(event.target.checked)} />
                  <span>
                    {t('upload.notifyMe')}
                    <br />
                    <span className="xs muted">{galleryStatus}</span>
                  </span>
                </label>
                {notifyMe ? (
                  <input
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={notifyEmail}
                    onChange={(event) => setNotifyEmail(event.target.value)}
                    placeholder={t('notify.emailPlaceholder')}
                    aria-label={t('upload.notifyEmailAria')}
                  />
                ) : null}
              </div>
            ) : null}
            {alreadyNotified ? (
              <p className="xs muted">
                <Icon name="mail" size={14} /> {t('upload.willNotifyGallery', { email: guest?.notifyEmail ?? '' })}
              </p>
            ) : null}
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}

            {started ? (
              <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={t('upload.progressAria')}
                  aria-valuenow={totalProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${totalProgress}%` }} />
                </div>
                <span className="xs muted">{t('upload.sending', { progress: totalProgress })}</span>
              </div>
            ) : null}

            {!started ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void send()}
                disabled={!items.length}
              >
                {items.length ? t('upload.send', { photos: photos(items.length) }) : t('upload.chooseFirst')}
              </button>
            ) : null}

            <div
              className="row"
              style={
                {
                  alignItems: 'flex-start',
                  padding: 14,
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  '--gap': '10px',
                } as CSSProperties
              }
            >
              <Icon name="lock" style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <p className="xs" style={{ color: 'var(--ink-2)', flex: 1 }}>
                {t('upload.privacy')} {galleryStatus}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
