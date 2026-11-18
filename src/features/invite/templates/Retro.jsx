import { inviteInfo, MapLink, CalendarButton, mix, SANS, SERIF } from './shared';

// Retro – 70-e: duga od debelih lukova, krupna slova sa pomerenom senkom, zaobljene "chunky" kartice
export default function Retro({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const a = x.accent;
  const stripes = [a, '#F0A23B', '#F2C14E', mix(a, '#F7EBD9', 0.55)];
  const cream = '#FBF1E1';
  const ink = '#3A2418';
  const chunky = { border: `2.5px solid ${ink}`, borderRadius: 22, boxShadow: `5px 5px 0 ${ink}` };

  return (
    <div style={{ background: cream, color: ink, overflow: 'hidden' }}>
      <header style={{ position: 'relative', padding: '0 20px 30px', textAlign: 'center' }}>
        {/* duga */}
        <svg viewBox="0 0 300 150" width="100%" style={{ display: 'block', maxWidth: 360, margin: '0 auto' }} aria-hidden="true">
          {stripes.map((c, i) => {
            const r = 140 - i * 22;
            return <path key={c + i} d={`M${150 - r} 150 A${r} ${r} 0 0 1 ${150 + r} 150`} fill="none" stroke={c} strokeWidth="20" />;
          })}
          <circle cx="150" cy="150" r="44" fill={cream} />
          <text x="150" y="140" textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="30" fill={ink}>{x.initials[0]}+{x.initials[1]}</text>
        </svg>

        <div className="stack" style={{ marginTop: 18, alignItems: 'center' }}>
          {guestName && (
            <span style={{ ...chunky, boxShadow: `3px 3px 0 ${ink}`, borderRadius: 999, padding: '4px 14px', background: '#FFFFFF', fontFamily: SANS, fontWeight: 500, fontSize: 13 }}>
              Hej, {guestName}!
            </span>
          )}
          <p style={{ fontFamily: SANS, fontSize: 16 }}>{x.inv.headline}</p>
          <h1 style={{ fontFamily: SANS, fontWeight: 500, fontSize: 'clamp(46px, 14vw, 70px)', lineHeight: 0.92, color: a, letterSpacing: '-0.02em', textShadow: `3px 3px 0 ${ink}` }}>
            {wedding.partner1}
            <br />
            <span style={{ color: '#F0A23B' }}>&amp;</span> {wedding.partner2}
          </h1>
          <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[x.weekday, `${x.day}.${x.month}.`, x.year].map((v, i) => (
              <span key={i} style={{ ...chunky, boxShadow: `3px 3px 0 ${ink}`, padding: '6px 14px', background: [stripes[2], '#FFFFFF', stripes[3]][i], fontFamily: SANS, fontWeight: 500, textTransform: 'capitalize' }}>{v}</span>
            ))}
          </div>
          {x.countdown && <p className="small" style={{ marginTop: 4 }}>✿ {x.countdown} ✿</p>}
        </div>
      </header>

      {/* talas */}
      <svg viewBox="0 0 300 20" width="100%" height="20" preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
        <path d="M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 V20 H0 Z" fill={stripes[3]} />
      </svg>
      <div style={{ background: stripes[3] }}>
        {x.inv.message && (
          <section style={{ padding: '18px 26px 6px' }}>
            <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.55, textAlign: 'center' }}>{x.inv.message}</p>
          </section>
        )}

        <section style={{ padding: '20px 20px 34px' }} className="stack" aria-label="Raspored dana">
          <h2 style={{ fontFamily: SANS, fontWeight: 500, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan žurke</h2>
          {x.schedule.map((e, i) => (
            <div key={e.id} style={{ ...chunky, background: '#FFFFFF', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
              <span style={{ width: 64, height: 64, borderRadius: '50%', background: stripes[i % 3], border: `2.5px solid ${ink}`, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 16 }}>{e.time}</span>
              <div className="stack" style={{ '--gap': '2px' }}>
                <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 17 }}>{e.title}</span>
                <span className="small" style={{ opacity: 0.8 }}>{e.place}</span>
                <MapLink event={e} color={ink} />
              </div>
            </div>
          ))}
          <CalendarButton wedding={wedding} style={{ ...chunky, background: a, color: '#FFFFFF', borderColor: ink, fontWeight: 500 }} />
        </section>
        {children}
      </div>
    </div>
  );
}
