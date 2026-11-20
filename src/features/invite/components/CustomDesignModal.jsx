import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createRequest } from '../../requests/services/requests.service';
import { toast } from 'react-toastify';
import { Modal, Spinner } from '../../../components/ui';
import Icon from '../../../components/Icon';
import { INVITATION_TEMPLATES } from '../templates';
import ContactPhoneNote from '../../../components/ContactPhoneNote';

const STYLES = ['Romantičan, klasičan', 'Moderan, minimalistički', 'Boho, prirodni tonovi', 'Editorial, kao magazin', 'Ilustracije / akvarel'];
const BUDGETS = ['do 50 €', '50–100 €', '100–200 €', '200 € +'];

export default function CustomDesignModal({ currentTemplateId, onClose }) {
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
    if (!description.trim()) return setError('Opišite kakvu pozivnicu želite.');
    setError('');
    const names = INVITATION_TEMPLATES.filter((t) => liked.includes(t.id)).map((t) => t.name);
    const full = [
      description.trim(),
      names.length ? `Inspiracija (postojeći izgledi): ${names.join(', ')}` : '',
      colors.trim() ? `Boje: ${colors.trim()}` : '',
      deadline ? `Potrebno do: ${deadline}` : '',
    ].filter(Boolean).join('\n');
    const res = await dispatch(createRequest({ type: 'invitation', style, budget, pages: null, includePrint: false, description: full }));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success('Zahtev je poslat. Dizajner se javlja u roku od 48 sati.');
      setSent(true);
    } else {
      setError(res.payload?.message || 'Slanje nije uspelo. Pokušajte ponovo.');
    }
  };

  if (sent) {
    return (
      <Modal title="Zahtev je poslat" onClose={onClose}
        footer={<>
          <Link to="/app/custom-dizajn" className="btn btn-outline">Prati zahtev</Link>
          <button className="btn btn-primary" onClick={onClose}>U redu</button>
        </>}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
          <span style={{ color: 'var(--green)' }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
          <p>Naš dizajner će vam se javiti u roku od 48 sati sa predlogom i cenom. Ništa ne plaćate dok ne potvrdite.</p>
          <ContactPhoneNote onNavigate={onClose} />
          <p className="small muted">Do tada možete da koristite bilo koji od gotovih izgleda.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Custom dizajn pozivnice" onClose={onClose} wide
      footer={<>
        <button type="button" className="btn btn-soft" onClick={onClose}>Otkaži</button>
        <button type="submit" form="custom-design-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : 'Pošalji zahtev'}</button>
      </>}>
      <form id="custom-design-form" className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <p className="muted small" style={{ marginTop: -8 }}>
          Dizajner pravi pozivnicu samo za vas, po vašoj priči i bojama. Prvo dobijate predlog i cenu, a tek onda potvrđujete.
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="stack" style={{ '--gap': '8px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>Koji izgledi vam se sviđaju? <span className="muted">(opciono, više izbora)</span></span>
          <div className="row" style={{ '--gap': '8px', flexWrap: 'wrap' }} role="group" aria-label="Inspiracija">
            {INVITATION_TEMPLATES.map((t) => (
              <button type="button" key={t.id} aria-pressed={liked.includes(t.id)} onClick={() => toggle(t.id)} className="btn btn-sm"
                style={liked.includes(t.id)
                  ? { background: 'var(--green)', color: '#F6F3EE', borderColor: 'var(--green)' }
                  : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--line-strong)' }}>
                {liked.includes(t.id) && <Icon name="check" size={14} />} {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="field grow" style={{ minWidth: 200 }}><span>Stil</span>
            <select className="select" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>Okvirni budžet</span>
            <select className="select" value={budget} onChange={(e) => setBudget(e.target.value)}>
              {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 170 }}><span>Potrebno do <span className="muted">(opciono)</span></span>
            <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>

        <label className="field"><span>Boje <span className="muted">(opciono)</span></span>
          <input className="input" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="npr. žalfija zelena i krem, bez roze" />
        </label>

        <label className="field"><span>Kakvu pozivnicu želite?</span>
          <textarea className="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Npr. ilustracija crkve u kojoj se venčavamo, naš monogram, motiv mora jer smo se upoznali na Hvaru…" />
        </label>

        <ContactPhoneNote onNavigate={onClose} />
      </form>
    </Modal>
  );
}
