import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createRequest } from '../../requests/services/requests.service';
import { toast } from 'react-toastify';
import { Modal, Spinner } from '../../../components/ui';
import Icon from '../../../components/Icon';
import ContactPhoneNote from '../../../components/ContactPhoneNote';

export const PRODUCTS = [
  { id: 'poster', sizes: ['50 × 70 cm', '70 × 100 cm', '100 × 140 cm'] },
  { id: 'platno', sizes: ['60 × 90 cm', '80 × 120 cm', '100 × 150 cm'] },
  { id: 'digital', sizes: ['A1', 'A0', 'custom'] },
];
const BUDGETS = ['upTo50', 'from50to100', 'from100to200', 'over200'];

export default function BigAlbumRequestModal({ photoCount, background, scopeLabel, showMessages, onClose }) {
  const { t } = useTranslation('bigAlbum');
  const sizeLabel = (s) => (s === 'custom' ? t('request.customSize') : s);
  const productLabel = (p) => t(`request.products.${p.id}.label`);
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.requests.saving);
  const [product, setProduct] = useState(PRODUCTS[0].id);
  const [size, setSize] = useState(PRODUCTS[0].sizes[1]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [deadline, setDeadline] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const prod = PRODUCTS.find((p) => p.id === product);

  const pickProduct = (p) => {
    setProduct(p.id);
    setSize(p.sizes[1] || p.sizes[0]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const description = [
      t('request.lineProduct', { product: productLabel(prod), size: sizeLabel(size) }),
      t(showMessages ? 'request.linePhotosWithMessages' : 'request.linePhotos', { scope: scopeLabel, count: photoCount, background }),
      deadline ? t('invite:custom.lineDeadline', { date: deadline }) : '',
      note.trim() ? t('request.lineNote', { note: note.trim() }) : '',
    ].filter(Boolean).join('\n');
    const res = await dispatch(createRequest({
      type: 'big_album', style: `${productLabel(prod)}, ${sizeLabel(size)}`, budget: t(`invite:custom.budgets.${budget}`), pages: null, includePrint: product !== 'digital', description,
    }));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('request.sentToast'));
      setSent(true);
    } else setError(res.payload?.message || t('common:errors.sendFailed'));
  };

  if (sent) {
    return (
      <Modal title={t('invite:custom.sentTitle')} onClose={onClose}
        footer={<>
          <Link to="/app/custom-dizajn" className="btn btn-outline">{t('invite:custom.track')}</Link>
          <button className="btn btn-primary" onClick={onClose}>{t('common:actions.ok')}</button>
        </>}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
          <span style={{ color: 'var(--green)' }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
          <p>{t('request.sentText')}</p>
          <p className="small muted">{t('request.sentMeanwhile')}</p>
          <ContactPhoneNote onNavigate={onClose} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t('request.title')} onClose={onClose} wide
      footer={<>
        <button type="button" className="btn btn-soft" onClick={onClose}>{t('common:actions.cancel')}</button>
        <button type="submit" form="big-album-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : t('invite:custom.submit')}</button>
      </>}>
      <form id="big-album-form" className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <p className="muted small" style={{ marginTop: -8 }}>
          {t('request.intro', { count: photoCount })}
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="stack" style={{ '--gap': '8px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{t('request.what')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }} role="radiogroup" aria-label={t('request.productAria')}>
            {PRODUCTS.map((p) => (
              <button type="button" key={p.id} role="radio" aria-checked={product === p.id} onClick={() => pickProduct(p)} className="stack"
                style={{ '--gap': '2px', padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: '#fff',
                  border: product === p.id ? '2px solid var(--green)' : '1px solid var(--line)' }}>
                <span className="row between" style={{ fontWeight: 500 }}>{productLabel(p)}{product === p.id && <Icon name="checkCircle" size={16} />}</span>
                <span className="xs muted">{t(`request.products.${p.id}.desc`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="field" style={{ width: 170 }}><span>{t('request.size')}</span>
            <select className="select" value={size} onChange={(e) => setSize(e.target.value)}>
              {prod.sizes.map((s) => <option key={s} value={s}>{sizeLabel(s)}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>{t('invite:custom.budget')}</span>
            <select className="select" value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => <option key={b} value={b}>{t(`invite:custom.budgets.${b}`)}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>{t('invite:custom.deadline')} <span className="muted">{t('invite:custom.optional')}</span></span>
            <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>

        <div className="row" style={{ '--gap': '8px', padding: '10px 12px', borderRadius: 12, background: 'var(--bg)', flexWrap: 'wrap' }}>
          <Icon name="image" size={18} />
          <span className="small">{t('request.selection')} <strong style={{ fontWeight: 500 }}>{scopeLabel}</strong> · {t(showMessages ? 'request.selectionDetailsWithMessages' : 'request.selectionDetails', { count: photoCount, background })}</span>
        </div>

        <label className="field"><span>{t('request.note')} <span className="muted">{t('invite:custom.optional')}</span></span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={t('request.notePlaceholder')} />
        </label>

        <ContactPhoneNote onNavigate={onClose} />
      </form>
    </Modal>
  );
}
