import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';

const FEATURES = [
  ['mail', 'Lična pozivnica za svakog gosta', 'Svaki gost dobija svoj link sa imenom, rasporedom dana, mapom i potvrdom dolaska.'],
  ['image', 'Slike skupljaju gosti', 'Preko ličnog linka ili QR koda na stolu, bez aplikacije i bez prijave, u punoj rezoluciji.'],
  ['heart', 'Veliki album koji se pravi sam', 'Svaka odobrena slika odmah stiže na tablu kao polaroid sa imenom gosta. Pustite je na TV-u na svadbi ili naručite poster.'],
  ['sparkle', 'Ili potpuno unikatno', 'Pošaljite zahtev i naš dizajner pravi pozivnicu ili veliki album samo za vas.'],
];

export default function Landing() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <nav className="landing-nav" aria-label="Glavni meni">
        <Link to="/" className="brand">Uspomena</Link>
        <div className="row">
          <Link to="/i/demo-jelena" className="btn btn-ghost">Pozivnica gosta</Link>
          <Link to="/login" className="btn btn-ghost">Prijava</Link>
          <Link to="/registracija" className="btn btn-primary">Napravi nalog</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="stack" style={{ '--gap': '22px' }}>
          <p className="eyebrow">Pozivnice i album venčanja</p>
          <h1>Album koji prave vaši gosti.</h1>
          <p style={{ fontSize: 19, color: 'var(--ink-2)', maxWidth: 520 }}>
            Pošaljite svakom gostu ličnu digitalnu pozivnicu. Posle venčanja svi njihovi kadrovi i poruke
            slažu se u jedan unikatan album.
          </p>
          <div className="row">
            <Link to="/registracija" className="btn btn-primary btn-lg">Napravi nalog</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Isprobaj demo</Link>
            <Link to="/i/demo-jelena" className="btn btn-outline btn-lg">Pogledaj kao gost</Link>
          </div>
          <p className="xs muted">Demo nalog: demo@uspomena.rs / demo123</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div style={{ width: 300, borderRadius: 28, overflow: 'hidden', boxShadow: 'var(--shadow)', background: '#FBF8F2', transform: 'rotate(-2deg)' }}>
            <div style={{ background: 'var(--green)', color: '#F6F3EE', padding: '40px 24px', textAlign: 'center' }} className="stack">
              <span className="eyebrow" style={{ color: 'var(--champagne)' }}>Pozivnica za: Jelena i Nikola</span>
              <span className="serif" style={{ fontSize: 46, lineHeight: 1 }}>Ana <i style={{ color: 'var(--champagne)' }}>&amp;</i> Marko</span>
              <span className="xs" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Subota · 12. jun 2027.</span>
            </div>
            <div style={{ padding: 20 }} className="stack">
              <div className="row" style={{ '--gap': '8px' }}>
                <span className="btn btn-primary btn-sm grow">Dolazimo</span>
                <span className="btn btn-outline btn-sm grow">Ne možemo</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {['#C9B48E', '#9DB09A', '#C49A8C'].map((c) => <span key={c} style={{ aspectRatio: '1', borderRadius: 8, background: c }} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" aria-label="Mogućnosti">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="card stack" style={{ '--gap': '10px' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
              <Icon name={icon} />
            </span>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
