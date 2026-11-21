import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { updateMe } from '../features/auth/services/auth.service';
import { logout } from '../features/auth/store/auth.store';
import { toast } from 'react-toastify';
import { normalizePhone, phoneError } from '../utils/phone';
import PhoneField from './PhoneField';
import { Spinner } from './ui';

export default function PhoneRequiredModal() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.auth.savingMe);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const clean = normalizePhone(phone);
    if (!clean) return setError(phoneError());
    const res = await dispatch(updateMe({ phone: clean }));
    if (res.meta.requestStatus === 'fulfilled') toast.success(t('phone.saved'));
    else setError(res.payload?.message || t('errors.saveFailed'));
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="phone-req-h" onSubmit={submit}>
        <div className="stack" style={{ '--gap': '6px' }}>
          <h2 id="phone-req-h">{t('phoneRequired.title')}</h2>
          <p className="muted small">
            {t('phoneRequired.text')}
          </p>
        </div>
        <PhoneField value={phone} onChange={(v) => { setPhone(v); setError(''); }} error={error} autoFocus id="required-phone" />
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={() => dispatch(logout())}>{t('actions.logout')}</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : t('phoneRequired.save')}</button>
        </div>
      </form>
    </div>
  );
}
