import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createAccount, updateAccount } from '../services/admin.service';
import { Modal, Spinner } from '../../../components/ui';
import PhoneField from '../../../components/PhoneField';
import { normalizePhone, phoneError } from '../../../utils/phone';
import { EventType } from '../../../app/config/enums';

const TYPES = [EventType.WEDDING, EventType.CELEBRATION];

export default function AccountModal({ account, onClose, onCreated }) {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.admin.saving);
  const [f, setF] = useState({
    type: account?.wedding?.type || EventType.WEDDING,
    partner1: account?.wedding?.partner1 || '',
    partner2: account?.wedding?.partner2 || '',
    occasion: account?.wedding?.occasion || '',
    date: account?.wedding?.date || '',
    email: account?.email || '',
    phone: account?.phone || '',
    password: '',
  });
  const [phoneErr, setPhoneErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const celebration = f.type === EventType.CELEBRATION;

  const submit = async (e) => {
    e.preventDefault();
    const phone = normalizePhone(f.phone);
    if (!phone) return setPhoneErr(phoneError());
    setPhoneErr('');
    const payload = {
      type: f.type,
      partner1: f.partner1.trim(),
      partner2: celebration ? '' : f.partner2.trim(),
      occasion: celebration ? f.occasion.trim() : '',
      date: f.date,
      email: f.email.trim(),
      phone,
    };
    if (account) {
      const res = await dispatch(updateAccount({ id: account.id, ...payload }));
      if (res.meta.requestStatus === 'fulfilled') onClose();
    } else {
      const res = await dispatch(createAccount({ ...payload, password: f.password.trim() }));
      if (res.meta.requestStatus === 'fulfilled') onCreated(res.payload);
    }
  };

  return (
    <Modal
      title={account ? t('modal.editTitle') : t('modal.newTitle')}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-soft" onClick={onClose}>{t('common:actions.cancel')}</button>
        <button type="submit" form="account-form" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner light /> : account ? t('common:actions.save') : t('modal.create')}
        </button>
      </>}
    >
      <form id="account-form" className="stack" style={{ '--gap': '16px' }} onSubmit={submit}>
        <fieldset className="stack" style={{ '--gap': '8px', border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ marginBottom: 8, color: 'var(--ink-2)', fontWeight: 500 }}>{t('fields.type')}</legend>
          <div className="chips" role="radiogroup">
            {TYPES.map((type) => (
              <button key={type} type="button" className="chip" role="radio" aria-checked={f.type === type} aria-pressed={f.type === type} onClick={() => setF({ ...f, type })}>
                {t(`type.${type}`)}
              </button>
            ))}
          </div>
          <span className="xs muted">{t(`typeHint.${f.type}`)}</span>
        </fieldset>

        {celebration ? (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <label className="field grow"><span>{t('fields.celebrant')}</span>
              <input className="input" required value={f.partner1} onChange={set('partner1')} placeholder="Luka" /></label>
            <label className="field grow"><span>{t('fields.occasion')}</span>
              <input className="input" value={f.occasion} onChange={set('occasion')} placeholder={t('fields.occasionPlaceholder')} /></label>
          </div>
        ) : (
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <label className="field grow"><span>{t('fields.partner1')}</span>
              <input className="input" required value={f.partner1} onChange={set('partner1')} placeholder="Ana" /></label>
            <label className="field grow"><span>{t('fields.partner2')}</span>
              <input className="input" required value={f.partner2} onChange={set('partner2')} placeholder="Marko" /></label>
          </div>
        )}
        <label className="field"><span>{celebration ? t('fields.celebrationDate') : t('fields.date')}</span>
          <input className="input" type="date" required value={f.date} onChange={set('date')} /></label>
        <label className="field"><span>{t('fields.email')}</span>
          <input className="input" type="email" required autoComplete="off" value={f.email} onChange={set('email')} />
          <span className="xs muted">{t(celebration ? 'modal.emailHintCelebration' : 'modal.emailHint')}</span></label>
        <PhoneField value={f.phone} onChange={(v) => { setF({ ...f, phone: v }); if (phoneErr) setPhoneErr(''); }} error={phoneErr} />
        {!account && (
          <label className="field"><span>{t('fields.password')}</span>
            <input className="input" type="text" minLength={6} autoComplete="off" value={f.password} onChange={set('password')} placeholder={t('modal.passwordPlaceholder')} />
            <span className="xs muted">{t('modal.passwordHint')}</span></label>
        )}
      </form>
    </Modal>
  );
}
