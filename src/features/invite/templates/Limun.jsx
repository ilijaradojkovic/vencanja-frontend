import { inviteInfo, MapLink, CalendarButton, mix, useSvgId, SERIF, SANS } from './shared';

function Tiles({ color, height = 34 }) {
  const id = useSvgId('tile');
  return (
    <svg width="100%" height={height} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <pattern id={id} width={height} height={height} patternUnits="userSpaceOnUse">
          <rect width={height} height={height} fill="#FFFFFF" />
          <rect x="0.5" y="0.5" width={height - 1} height={height - 1} fill="none" stroke={color} strokeWidth="1" />
          <g transform={`translate(${height / 2} ${height / 2})`} fill={color}>
            {[0, 90, 180, 270].map((a) => (
              <ellipse key={a} cx="0" cy={-height * 0.2} rx={height * 0.1} ry={height * 0.17} transform={`rotate(${a})`} />
            ))}
            <circle r={height * 0.07} fill="#FFFFFF" />
          </g>
          {[[0, 0], [height, 0], [0, height], [height, height]].map(([cx, cy]) => (
            <path key={`${cx}${cy}`} d={`M${cx - 5} ${cy} L${cx} ${cy - 5} L${cx + 5} ${cy} L${cx} ${cy + 5} Z`} fill={color} opacity="0.6" />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
}

function Lemon({ x, y, r = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M-4 -26 Q 18 -30 22 -8" fill="none" stroke="#4E7A3A" strokeWidth="1.6" />
      <ellipse cx="14" cy="-24" rx="13" ry="5" fill="#5F8F45" transform="rotate(-25 14 -24)" />
      <ellipse cx="-12" cy="-24" rx="11" ry="4.4" fill="#4E7A3A" transform="rotate(30 -12 -24)" />
      <path d="M-26 0 Q -28 -18 -6 -20 Q 18 -22 26 -4 Q 30 4 26 6 Q 14 22 -10 20 Q -28 16 -30 4 Q -32 0 -26 0 Z" fill="#F4CF3A" />
      <path d="M-14 -10 Q -4 -16 10 -12" fill="none" stroke="#FFF3B0" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

export default function Limun({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const blue = x.accent;
  const ink = mix(blue, '#1A1A1A', 0.45);

  return (
    <div style={{ background: '#FFFDF7', color: ink }}>
      <Tiles color={blue} />
      <header style={{ padding: '18px 22px 28px', textAlign: 'center' }} className="stack">
        <svg viewBox="0 0 240 70" width="240" height="70" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
          <Lemon x={60} y={44} r={-18} s={0.9} />
          <Lemon x={120} y={40} r={4} s={1.05} />
          <Lemon x={182} y={46} r={20} s={0.85} />
        </svg>
        {guestName && <p style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: blue }}>Dragi/a {guestName}</p>}
        <p style={{ fontFamily: SERIF, fontSize: 18, fontStyle: 'italic' }}>{x.inv.headline}</p>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: blue, fontSize: 'clamp(46px, 13vw, 64px)', lineHeight: 1 }}>
          {wedding.partner1} <span style={{ color: '#D9A900' }}>&amp;</span> {wedding.partner2}
        </h1>
        <div style={{ alignSelf: 'center', display: 'grid', gridTemplateColumns: 'auto auto auto', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{x.weekday}</span>
          <span style={{ width: 54, height: 54, borderRadius: '50%', background: blue, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontFamily: SERIF, fontSize: 26 }}>{x.day}</span>
          <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{x.monthName} {x.year}</span>
        </div>
        {x.countdown && <p className="small" style={{ color: blue }}>{x.countdown}</p>}
      </header>

      {x.inv.message && (
        <section style={{ padding: '0 28px 10px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.55, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '22px 18px 30px' }} className="stack" aria-label="Raspored dana">
        <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', color: blue, textAlign: 'center' }}>Program dana</h2>
        {x.schedule.map((e) => (
          <div key={e.id} style={{ background: '#FFFFFF', border: `1.5px solid ${blue}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ background: blue, color: '#FFFFFF', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 13, letterSpacing: '0.1em' }}>
              <span>{e.time}</span>
              <span>🍋</span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: SERIF, fontSize: 20 }}>{e.title}</div>
              <div className="small" style={{ opacity: 0.8 }}>{e.place}</div>
              <MapLink event={e} color={blue} />
            </div>
          </div>
        ))}
        <CalendarButton wedding={wedding} style={{ background: '#F4CF3A', color: ink, borderColor: '#F4CF3A' }} />
      </section>
      <Tiles color={blue} height={24} />

      {children}
    </div>
  );
}
