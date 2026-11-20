import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { updateMe } from '../features/auth/services/auth.service';
import { logout } from '../features/auth/store/auth.store';
import { toast } from 'react-toastify';
import { normalizePhone, PHONE_ERROR } from '../utils/phone';
import PhoneField from './PhoneField';
import { Spinner } from './ui';

export default function PhoneRequiredModal() {
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.auth.savingMe);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const clean = normalizePhone(phone);
    if (!clean) return setError(PHONE_ERROR);
    const res = await dispatch(updateMe({ phone: clean }));
    if (res.meta.requestStatus === 'fulfilled') toast.success('Broj telefona je sačuvan');
    else setError(res.payload?.message || 'Čuvanje nije uspelo.');
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="phone-req-h" onSubmit={submit}>
        <div className="stack" style={{ '--gap': '6px' }}>
          <h2 id="phone-req-h">Dodajte broj telefona</h2>
          <p className="muted small">
            Broj je obavezan za svaki nalog. Koristimo ga samo da vas kontaktiramo za custom dizajn, štampu albuma i slična pitanja.
          </p>
        </div>
        <PhoneField value={phone} onChange={(v) => { setPhone(v); setError(''); }} error={error} autoFocus id="required-phone" />
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={() => dispatch(logout())}>Odjavi se</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : 'Sačuvaj broj'}</button>
        </div>
      </form>
    </div>
  );
}
