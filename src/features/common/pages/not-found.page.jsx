import { Link } from 'react-router-dom';

export default function NotFound({ title = 'Stranica nije pronađena', text = 'Proverite link ili se vratite na početnu.' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div className="stack" style={{ alignItems: 'center', maxWidth: 420 }}>
        <p className="eyebrow">Ups</p>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        <Link to="/" className="btn btn-primary">Na početnu</Link>
      </div>
    </div>
  );
}
