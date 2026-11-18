import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createRequest } from '../../requests/services/requests.service';
import { showToast } from '../../common/store/common.store';
import { Modal, Spinner } from '../../../components/ui';
import Icon from '../../../components/Icon';
import ContactPhoneNote from '../../../components/ContactPhoneNote';

export const PRODUCTS = [
  { id: 'poster', label: 'Poster', desc: 'Mat papir, spreman za ram', sizes: ['50 × 70 cm', '70 × 100 cm', '100 × 140 cm'] },
  { id: 'platno', label: 'Platno', desc: 'Na drvenom ramu, za zid', sizes: ['60 × 90 cm', '80 × 120 cm', '100 × 150 cm'] },
  { id: 'digital', label: 'Fajl za štampu', desc: 'PDF visoke rezolucije', sizes: ['A1', 'A0', 'Po meri'] },
];
const BUDGETS = ['do 50 €', '50–100 €', '100–200 €', '200 € +'];

/**
 * "Uradite ovo za nas" – mladenci traže da naš tim složi i pripremi veliki album
 * (zid polaroida). Šalje se kao design request tipa big_album; kontakt broj ide sa naloga.
 */
export default function BigAlbumRequestModal({ photoCount, background, scopeLabel, showMessages, onClose }) {
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
      `Veliki album – ${prod.label}, ${size}.`,
      `Slike: ${scopeLabel} (${photoCount} polaroida), pozadina: ${background}${showMessages ? ', sa porukama gostiju' : ''}.`,
      deadline ? `Potrebno do: ${deadline}` : '',
      note.trim() ? `Napomena: ${note.trim()}` : '',
    ].filter(Boolean).join('\n');
    const res = await dispatch(createRequest({
      type: 'big_album', style: `${prod.label}, ${size}`, budget, pages: null, includePrint: product !== 'digital', description,
    }));
    if (res.meta.requestStatus === 'fulfilled') {
      dispatch(showToast('Zahtev je poslat. Javljamo se u roku od 48 sati.'));
      setSent(true);
    } else setError(res.payload?.message || 'Slanje nije uspelo. Pokušajte ponovo.');
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
          <p>Naš tim slaže vaš veliki album od svih slika gostiju i javlja vam se sa predlogom i cenom. Ništa ne plaćate dok ne potvrdite.</p>
          <p className="small muted">Slike koje gosti pošalju u međuvremenu takođe ulaze u album.</p>
          <ContactPhoneNote onNavigate={onClose} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Uradite veliki album za nas" onClose={onClose} wide
      footer={<>
        <button type="button" className="btn btn-soft" onClick={onClose}>Otkaži</button>
        <button type="submit" form="big-album-form" className="btn btn-primary" disabled={saving}>{saving ? <Spinner light /> : 'Pošalji zahtev'}</button>
      </>}>
      <form id="big-album-form" className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <p className="muted small" style={{ marginTop: -8 }}>
          Naš dizajner ručno raspoređuje svih {photoCount} polaroida, sređuje boje i priprema album za štampu. Prvo dobijate predlog i cenu.
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="stack" style={{ '--gap': '8px' }}>
          <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>Šta želite?</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }} role="radiogroup" aria-label="Proizvod">
            {PRODUCTS.map((p) => (
              <button type="button" key={p.id} role="radio" aria-checked={product === p.id} onClick={() => pickProduct(p)} className="stack"
                style={{ '--gap': '2px', padding: 14, borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: '#fff',
                  border: product === p.id ? '2px solid var(--green)' : '1px solid var(--line)' }}>
                <span className="row between" style={{ fontWeight: 500 }}>{p.label}{product === p.id && <Icon name="checkCircle" size={16} />}</span>
                <span className="xs muted">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <label className="field" style={{ width: 170 }}><span>Veličina</span>
            <select className="select" value={size} onChange={(e) => setSize(e.target.value)}>
              {prod.sizes.map((s) => <option key={s}>{s}</option>)}
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

        <div className="row" style={{ '--gap': '8px', padding: '10px 12px', borderRadius: 12, background: 'var(--bg)', flexWrap: 'wrap' }}>
          <Icon name="image" size={18} />
          <span className="small">Šaljemo vaš trenutni izbor: <strong style={{ fontWeight: 500 }}>{scopeLabel}</strong> · {photoCount} slika · pozadina {background}{showMessages ? ' · sa porukama' : ''}</span>
        </div>

        <label className="field"><span>Napomena <span className="muted">(opciono)</span></span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Npr. naša slika u sredini, bez slika sa pripreme, naslov „Ana & Marko, 12. 6. 2027.“…" />
        </label>

        <ContactPhoneNote onNavigate={onClose} />
      </form>
    </Modal>
  );
}
