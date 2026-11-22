import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createRequest } from '../../requests/services/requests.service';
import { toast } from 'react-toastify';
import { Modal, Spinner } from '../../../components/ui';
import Icon from '../../../components/Icon';
import { INVITATION_TEMPLATES } from '../templates';
import ContactPhoneNote from '../../../components/ContactPhoneNote';

const STYLES = ['romantic', 'modern', 'boho', 'editorial', 'illustration'];
const BUDGETS = ['upTo50', 'from50to100', 'from100to200', 'over200'];

export default function CustomDesignModal({ currentTemplateId, onClose }) {
  const { t } = useTranslation('invite');
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.requests.saving);
  const [style, setStyle] = useState(STYLES[0]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [liked, setLiked] = useState(currentTemplateId ? [currentTemplateId] : []);
  const [colors, setColors] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const toggle = (id) => setLiked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return setError(t('custom.describeError'));
    setError('');
    const names = INVITATION_TEMPLATES.filter((x) => liked.includes(x.id)).map((x) => x.name);
    const full = [
      description.trim(),
      names.length ? t('custom.lineInspiration', { names: names.join(', ') }) : '',
      colors.trim() ? t('custom.lineColors', { colors: colors.trim() }) : '',
      deadline ? t('custom.lineDeadline', { date: deadline }) : '',
    ].filter(Boolean).join('\n');
    const res = await dispatch(createRequest({ type: 'invitation', style: t(`custom.styles.${style}`), budget: t(`custom.budgets.${budget}`), pages: null, includePrint: false, description: full }));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('custom.sentToast'));
      setSent(true);
    } else {
      setError(res.payload?.message || t('common:errors.sendFailed'));
    }
  };

  if (sent) {
    return (
      <Modal title={t('custom.sentTitle')} onClose={onClose}
        footer={<>
          <Link to="/app/custom-dizajn" className="btn btn-outline">{t('custom.track')}</Link>
          <button className="btn btn-primary" onClick={onClose}>{t('common:actions.ok')}</button>
        </>}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
          <span style={{ color: 'var(--green)' }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
          <p>{t('custom.sentText')}</p>
          <ContactPhoneNote onNavigate={onClose} />
          <p className="small muted">{t('custom.meanwhile')}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t('custom.title')} onClose={onClose} wide
      footer={<>
        <button type="button" className="btn btn-soft" onClick={onClose}>{t('common:actions.cancel')}</button>
        <button type="submit" form="custom-design-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : t('custom.submit')}</button>
      </>}>
      <form id="custom-design-form" className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <p className="muted small" style={{ marginTop: -8 }}>
          {t('custom.intro')}
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="stack" style={{ '--gap': '8px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{t('custom.likedTitle')} <span className="muted">{t('custom.likedHint')}</span></span>
          <div className="row" style={{ '--gap': '8px', flexWrap: 'wrap' }} role="group" aria-label={t('custom.inspiration')}>
            {INVITATION_TEMPLATES.map((tpl) => (
              <button type="button" key={tpl.id} aria-pressed={liked.includes(tpl.id)} onClick={() => toggle(tpl.id)} className="btn btn-sm"
                style={liked.includes(tpl.id)
                  ? { background: 'var(--green)', color: '#F6F3EE', borderColor: 'var(--green)' }
                  : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--line-strong)' }}>
                {liked.includes(tpl.id) && <Icon name="check" size={14} />} {tpl.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="field grow" style={{ minWidth: 200 }}><span>{t('custom.style')}</span>
            <select className="select" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => <option key={s} value={s}>{t(`custom.styles.${s}`)}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>{t('custom.budget')}</span>
            <select className="select" value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => <option key={b} value={b}>{t(`custom.budgets.${b}`)}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>{t('custom.deadline')} <span className="muted">{t('custom.optional')}</span></span>
            <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>

        <label className="field"><span>{t('custom.colors')} <span className="muted">{t('custom.optional')}</span></span>
          <input className="input" value={colors} onChange={(e) => setColors(e.target.value)} placeholder={t('custom.colorsPlaceholder')} />
        </label>

        <label className="field"><span>{t('custom.description')}</span>
          <textarea className="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t('custom.descriptionPlaceholder')} />
        </label>

        <ContactPhoneNote onNavigate={onClose} />
      </form>
    </Modal>
  );
}
