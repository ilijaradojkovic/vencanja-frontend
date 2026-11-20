import { inviteInfo, MapLink, CalendarButton, Flowers, SERIF } from './shared';

export default function Romantika({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const rose = x.accent;
  const blush = '#F8ECE9';
  const ink = '#4A2E33';
  const leaf = '#9DB09A';

  return (
    <div style={{ background: blush, color: ink }}>
      <header style={{ position: 'relative', overflow: 'hidden', padding: '76px 24px 40px', textAlign: 'center' }} className="stack">
        <Flowers color={rose} leaf={leaf} size={130} style={{ top: -18, left: -18 }} />
        <Flowers color={rose} leaf={leaf} size={130} style={{ top: -18, right: -18, transform: 'scaleX(-1)' }} />

        {guestName && <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: rose }}>za {guestName},</p>}
        <p style={{ fontSize: 15, letterSpacing: '0.08em', opacity: 0.8 }}>{x.inv.headline}</p>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(46px, 13vw, 66px)', lineHeight: 0.95, marginTop: 12 }}>
          {wedding.partner1}
          <span style={{ display: 'block', fontSize: '1.6em', color: rose, lineHeight: 0.9, opacity: 0.85 }}>&amp;</span>
          {wedding.partner2}
        </h1>

        <div style={{ alignSelf: 'center', marginTop: 18, width: 128, height: 128, borderRadius: '50%', border: `1.5px solid ${rose}`, outline: `1px solid ${rose}55`, outlineOffset: 5, display: 'grid', placeItems: 'center', background: '#FFFFFF88' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{x.weekday}</div>
            <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1, color: rose }}>{x.day}</div>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 16 }}>{x.monthName} {x.year}</div>
          </div>
        </div>
        {x.countdown && <p className="small" style={{ marginTop: 12, color: rose }}>♥ {x.countdown}</p>}
      </header>

      {x.inv.message && (
        <section style={{ padding: '8px 28px 16px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 1.5, textAlign: 'center', fontStyle: 'italic' }}>“{x.inv.message}”</p>
        </section>
      )}

      <section style={{ padding: '20px 20px 28px' }} className="stack" aria-label="Raspored dana">
        <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', textAlign: 'center', color: rose }}>Naš dan</h2>
        {x.schedule.map((e) => (
          <div key={e.id} style={{ background: '#FFFFFF', borderRadius: 24, padding: '18px 20px', textAlign: 'center', boxShadow: '0 6px 20px rgba(74,46,51,0.06)' }}>
            <div style={{ display: 'inline-block', padding: '2px 14px', borderRadius: 999, background: `${rose}22`, color: rose, fontFamily: SERIF, fontSize: 20, fontWeight: 600 }}>{e.time}</div>
            <div style={{ fontFamily: SERIF, fontSize: 21, marginTop: 6 }}>{e.title}</div>
            <div className="small" style={{ opacity: 0.75 }}>{e.place}</div>
            <MapLink event={e} color={rose} />
          </div>
        ))}
        <CalendarButton wedding={wedding} style={{ background: rose, color: '#FFFFFF', borderColor: rose, borderRadius: 999 }} />
      </section>

      {children}
    </div>
  );
}
