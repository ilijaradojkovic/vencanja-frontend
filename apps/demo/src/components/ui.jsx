import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

export const Spinner = ({ light }) => {
  const { t } = useTranslation();
  return <span className={`spinner ${light ? 'spinner-light' : ''}`} role="status" aria-label={t('actions.loading')} />;
};

export const PageLoading = () => (
  <div className="page-loading"><Spinner /></div>
);

export function Modal({ title, onClose, children, footer, wide }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, textarea, select, button')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label={t('actions.close')}><Icon name="x" size={18} /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, text, confirmLabel, onConfirm, onClose, busy }) {
  const { t } = useTranslation();
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button className="btn btn-soft" onClick={onClose}>{t('actions.cancel')}</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? <Spinner light /> : confirmLabel || t('actions.delete')}</button>
      </>}
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}

export function Lightbox({ photos, index, onClose, onIndex }) {
  const { t } = useTranslation();
  const p = photos[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onIndex]);
  if (!p) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('lightbox.label')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button className="icon-btn" style={{ position: 'absolute', top: 16, right: 16 }} onClick={onClose} aria-label={t('actions.close')}><Icon name="x" /></button>
      <img src={p.url} alt={p.message || t('lightbox.photoFrom', { name: p.senderName })} />
      <div className="row" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <button className="icon-btn" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label={t('actions.previous')}><Icon name="chevronLeft" /></button>
        <div style={{ maxWidth: 480 }}>
          <strong>{p.senderName}</strong>
          {p.message && <p className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>„{p.message}“</p>}
          <span className="xs" style={{ opacity: 0.7 }}>{index + 1} / {photos.length}</span>
        </div>
        <button className="icon-btn" onClick={() => onIndex(index + 1)} disabled={index === photos.length - 1} aria-label={t('actions.next')}><Icon name="chevronRight" /></button>
      </div>
    </div>
  );
}


export function CopyButton({ text, label, className = 'btn btn-outline btn-sm' }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className={className} onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? t('actions.copied') : label || t('actions.copyLink')}
    </button>
  );
}

export const RsvpBadge = ({ status }) => {
  const { t } = useTranslation();
  const map = { yes: 'badge-yes', pending: 'badge-pending', no: 'badge-no' };
  const key = map[status] ? status : 'pending';
  return <span className={`badge ${map[key]}`}>{t(`rsvp.${key}`)}</span>;
};

export const PhotoStatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const map = { pending: 'badge-pending', approved: 'badge-yes', hidden: 'badge-no' };
  const key = map[status] ? status : 'pending';
  return <span className={`badge ${map[key]}`}>{t(`photoStatus.${key}`)}</span>;
};
