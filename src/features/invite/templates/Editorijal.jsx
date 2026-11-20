import { inviteInfo, MapLink, CalendarButton, SANS, SERIF } from './shared';

export default function Editorijal({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const ink = '#0F0F0F';
  const paper = '#F3F0EA';
  const block = x.accent;

  return (
    <div style={{ background: paper, color: ink, fontFamily: SANS }}>
      <header style={{ background: block, color: '#FFFFFF', padding: '28px 22px 26px', position: 'relative', overflow: 'hidden' }}>
        <div className="row between" style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', opacity: 0.85 }}>
          <span>Save the date</span>
          <span>{guestName || 'Pozivnica'}</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(84px, 30vw, 132px)', lineHeight: 0.85, letterSpacing: '-0.05em', marginTop: 26 }}>
          {x.day}
          <span style={{ opacity: 0.45 }}>.</span>
          {x.month}
        </div>
        <div className="row between" style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.5)', paddingTop: 10, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          <span>{x.weekday}</span>
          <span>{x.year}</span>
        </div>
      </header>

      <section style={{ padding: '30px 22px 10px' }}>
        <h1 style={{ fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(40px, 12vw, 60px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          {wedding.partner1}
          <br />
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', textTransform: 'none', fontWeight: 400, color: block }}>&amp;</span> {wedding.partner2}
        </h1>
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, marginTop: 16 }}>{x.inv.headline}</p>
      </section>

      {x.inv.message && (
        <section style={{ padding: '10px 22px 6px', display: 'grid', gridTemplateColumns: '6px 1fr', gap: 16 }}>
          <span style={{ background: block }} />
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '28px 22px' }} aria-label="Raspored dana">
        <div className="row between" style={{ borderBottom: `3px solid ${ink}`, paddingBottom: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Program</span>
          {x.countdown && <span style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: block }}>{x.countdown}</span>}
        </div>
        {x.schedule.map((e, i) => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 12, padding: '16px 0', borderBottom: `1px solid ${ink}22`, alignItems: 'start' }}>
            <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, color: block }}>{String(i + 1).padStart(2, '0')}</span>
            <div className="stack" style={{ '--gap': '2px' }}>
              <span style={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{e.title}</span>
              <span className="small" style={{ opacity: 0.7 }}>{e.place}</span>
              <MapLink event={e} color={ink} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 500, background: ink, color: paper, padding: '2px 8px' }}>{e.time}</span>
          </div>
        ))}
        <div style={{ marginTop: 20 }}>
          <CalendarButton wedding={wedding} style={{ width: '100%', background: ink, color: paper, borderColor: ink, borderRadius: 0, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 13 }} />
        </div>
      </section>

      {children}
    </div>
  );
}
