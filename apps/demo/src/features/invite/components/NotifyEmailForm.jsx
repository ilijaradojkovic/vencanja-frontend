import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { subscribeNotify } from '../services/invite.service';
import { Spinner } from '../../../components/ui';
import { isEmail } from '../../../utils/gallery';

export default function NotifyEmailForm({ token, slug, name, initialEmail = '', accent, onDone, onSkip, skipLabel, submitLabel }) {
  const { t } = useTranslation('invite');
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.invite.notifySaving);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) return setError(t('notify.invalidEmail'));
    setError('');
    const res = await dispatch(subscribeNotify({ token, slug, email: email.trim(), name }));
    if (res.meta.requestStatus === 'fulfilled') onDone?.(res.payload.notifyEmail);
    else setError(res.payload?.message || t('common:errors.saveFailed'));
  };

  return (
    <form onSubmit={submit} className="stack" style={{ '--gap': '12px' }}>
      <label className="field">
        <span>{t('auth:fields.email')}</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }} placeholder={t('notify.emailPlaceholder')} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="row" style={{ '--gap': '10px' }}>
        <button className="btn grow" style={accent ? { background: accent, color: '#F6F3EE' } : undefined} disabled={saving}>
          {saving ? <Spinner light /> : submitLabel || t('notify.submit')}
        </button>
        {onSkip && <button type="button" className="btn btn-ghost" onClick={onSkip}>{skipLabel || t('notify.skip')}</button>}
      </div>
      <p className="xs muted">{t('notify.privacy')}</p>
    </form>
  );
}
