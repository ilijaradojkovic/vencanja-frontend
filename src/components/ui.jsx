import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { dismissToast } from '../features/common/store/common.store';
import Icon from './Icon';

export const Spinner = ({ light }) => <span className={`spinner ${light ? 'spinner-light' : ''}`} role="status" aria-label="Učitavanje" />;

export const PageLoading = () => (
  <div className="page-loading"><Spinner /></div>
);

export function Modal({ title, onClose, children, footer, wide }) {
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
          <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Zatvori"><Icon name="x" size={18} /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, text, confirmLabel = 'Obriši', onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button className="btn btn-soft" onClick={onClose}>Odustani</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? <Spinner light /> : confirmLabel}</button>
      </>}
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}

export function Lightbox({ photos, index, onClose, onIndex }) {
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
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Pregled fotografije" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button className="icon-btn" style={{ position: 'absolute', top: 16, right: 16 }} onClick={onClose} aria-label="Zatvori"><Icon name="x" /></button>
      <img src={p.url} alt={p.message || `Fotografija od ${p.senderName}`} />
      <div className="row" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <button className="icon-btn" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Prethodna"><Icon name="chevronLeft" /></button>
        <div style={{ maxWidth: 480 }}>
          <strong>{p.senderName}</strong>
          {p.message && <p className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>„{p.message}“</p>}
          <span className="xs" style={{ opacity: 0.7 }}>{index + 1} / {photos.length}</span>
        </div>
        <button className="icon-btn" onClick={() => onIndex(index + 1)} disabled={index === photos.length - 1} aria-label="Sledeća"><Icon name="chevronRight" /></button>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), toast.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast.id, toast.type, dispatch]);
  return (
    <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon name={toast.type === 'error' ? 'x' : 'check'} size={18} />
      <span>{toast.message}</span>
      <button onClick={() => dispatch(dismissToast(toast.id))} aria-label="Zatvori obaveštenje"><Icon name="x" size={16} /></button>
    </div>
  );
}

export function Toasts() {
  const toasts = useAppSelector((s) => s.common.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.slice(-3).map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}

export function CopyButton({ text, label = 'Kopiraj link', className = 'btn btn-outline btn-sm' }) {
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
      {copied ? 'Kopirano' : label}
    </button>
  );
}

export const RsvpBadge = ({ status }) => {
  const map = { yes: ['badge-yes', 'Dolazi'], pending: ['badge-pending', 'Čeka odgovor'], no: ['badge-no', 'Ne dolazi'] };
  const [cls, label] = map[status] || map.pending;
  return <span className={`badge ${cls}`}>{label}</span>;
};

export const PhotoStatusBadge = ({ status }) => {
  const map = { pending: ['badge-pending', 'Na čekanju'], approved: ['badge-yes', 'Odobrena'], hidden: ['badge-no', 'Sakrivena'] };
  const [cls, label] = map[status] || map.pending;
  return <span className={`badge ${cls}`}>{label}</span>;
};
