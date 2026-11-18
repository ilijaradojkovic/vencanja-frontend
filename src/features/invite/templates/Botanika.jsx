import { inviteInfo, MapLink, CalendarButton, Branch, SERIF } from './shared';

// Botanika – žalfija pozadina, krem panel u obliku luka, grančice, raspored kao vremenska linija
export default function Botanika({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const ink = '#24372C';
  const leaf = x.accent;
  const cream = '#F7F4EC';

  return (
    <div style={{ background: '#DDE4D6', color: ink, padding: '28px 16px 0' }}>
      <header
        style={{
          background: cream,
          borderRadius: '999px 999px 18px 18px',
          padding: '72px 24px 36px',
          textAlign: 'center',
          border: `1px solid ${leaf}33`,
          boxShadow: '0 10px 30px rgba(36,55,44,0.08)',
        }}
        className="stack"
      >
        <Branch color={leaf} width={180} style={{ margin: '0 auto' }} />
        {guestName && <p style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: leaf }}>Dragi/a {guestName}</p>}
        <p style={{ fontFamily: SERIF, fontSize: 19, fontStyle: 'italic', opacity: 0.85 }}>{x.inv.headline}</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(42px, 11vw, 58px)', lineHeight: 1.05 }}>
          {wedding.partner1}
          <span style={{ display: 'block', fontSize: '0.5em', fontStyle: 'italic', color: leaf, margin: '4px 0' }}>i</span>
          {wedding.partner2}
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 19, textTransform: 'capitalize' }}>
          {x.weekday}, {x.dateLong}
        </p>
        {x.countdown && (
          <span style={{ alignSelf: 'center', padding: '4px 14px', borderRadius: 999, background: `${leaf}1A`, color: leaf, fontSize: 13 }}>{x.countdown}</span>
        )}
        <Branch color={leaf} width={180} flip style={{ margin: '0 auto' }} />
      </header>

      {x.inv.message && (
        <section style={{ padding: '32px 12px 8px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.5, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '24px 12px' }} aria-label="Raspored dana">
        <h2 style={{ fontFamily: SERIF, textAlign: 'center', marginBottom: 20 }}>Raspored dana</h2>
        <div style={{ position: 'relative', paddingLeft: 30 }}>
          <span style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 1, background: `${leaf}66` }} />
          {x.schedule.map((e) => (
            <div key={e.id} style={{ position: 'relative', paddingBottom: 22 }}>
              <svg viewBox="0 0 20 20" width="20" height="20" style={{ position: 'absolute', left: -30, top: 2 }} aria-hidden="true">
                <circle cx="10" cy="10" r="9" fill={cream} stroke={leaf} />
                <ellipse cx="10" cy="10" rx="5" ry="2.4" fill={leaf} transform="rotate(-35 10 10)" />
              </svg>
              <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: leaf, lineHeight: 1.1 }}>{e.time}</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>{e.title}</div>
              <div className="small" style={{ opacity: 0.8 }}>{e.place}</div>
              <MapLink event={e} color={leaf} />
            </div>
          ))}
        </div>
        <CalendarButton wedding={wedding} style={{ width: '100%', background: cream, color: ink, borderColor: leaf, borderRadius: 999 }} />
      </section>

      <div style={{ margin: '0 -16px' }}>{children}</div>
    </div>
  );
}
