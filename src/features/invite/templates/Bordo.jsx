import { inviteInfo, MapLink, CalendarButton, mix, useSvgId, SERIF, SANS } from './shared';
import { tt, Occasion } from './shared';

const BROWN = '#6B4A2F';
const PAPER = '#F8F1E7';

function Rose({ cx, cy, r, color, rotate = 0 }) {
  const dark = mix(color, '#2A0F0A', 0.35);
  const light = mix(color, '#FFFFFF', 0.25);
  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.72" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={cx} cy={cy - r * 0.45} rx={r * 0.5} ry={r * 0.62} fill={light} opacity="0.5" transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.62} fill={color} opacity="0.88" />
      <path d={`M${cx - r * 0.4} ${cy} a${r * 0.4} ${r * 0.4} 0 1 1 ${r * 0.8} 0 a${r * 0.28} ${r * 0.28} 0 1 1 -${r * 0.56} 0`}
        fill="none" stroke={dark} strokeWidth={Math.max(1, r * 0.09)} opacity="0.6" />
      <circle cx={cx} cy={cy} r={r * 0.16} fill={dark} opacity="0.75" />
    </g>
  );
}

function Leaf({ x, y, len, angle, color }) {
  return (
    <g transform={`rotate(${angle} ${x} ${y})`}>
      <ellipse cx={x + len / 2} cy={y} rx={len / 2} ry={len * 0.17} fill={color} opacity="0.7" />
      <path d={`M${x} ${y} L${x + len * 0.92} ${y}`} stroke={mix(color, '#000000', 0.3)} strokeWidth="0.8" opacity="0.5" />
    </g>
  );
}

function Garland({ color, flip = false, width = 420, style }) {
  const id = useSvgId('bordo');
  const leaf = mix(BROWN, '#A0522D', 0.35);
  const olive = mix(BROWN, '#8C6B4A', 0.6);
  const blush = mix(color, '#E8B9A8', 0.6);
  return (
    <svg viewBox="0 0 420 170" width="100%" style={{ maxWidth: width, display: 'block', margin: '0 auto', transform: flip ? 'scaleY(-1)' : undefined, ...style }} aria-hidden="true">
      <defs>
        <filter id={id} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" />
          <feDisplacementMap in="SourceGraphic" scale="14" />
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        <ellipse cx="210" cy="70" rx="180" ry="46" fill={blush} opacity="0.28" />
        <Leaf x={40} y={72} len={70} angle={-18} color={leaf} />
        <Leaf x={70} y={96} len={56} angle={22} color={olive} />
        <Leaf x={300} y={60} len={78} angle={14} color={leaf} />
        <Leaf x={292} y={92} len={60} angle={-24} color={olive} />
        <Leaf x={150} y={26} len={48} angle={-40} color={olive} />
        <Leaf x={236} y={24} len={52} angle={-150} color={leaf} />
        <Leaf x={118} y={110} len={46} angle={40} color={leaf} />
        <Leaf x={262} y={116} len={44} angle={-210} color={olive} />
        <Rose cx={210} cy={74} r={36} color={color} rotate={10} />
        <Rose cx={156} cy={86} r={25} color={mix(color, BROWN, 0.25)} rotate={-20} />
        <Rose cx={266} cy={84} r={27} color={mix(color, '#B5523B', 0.35)} rotate={30} />
        <Rose cx={112} cy={70} r={15} color={blush} />
        <Rose cx={312} cy={74} r={16} color={blush} rotate={45} />
        <Rose cx={196} cy={124} r={12} color={mix(color, BROWN, 0.45)} />
      </g>
      {[[96, 52], [104, 44], [326, 50], [334, 58], [182, 136], [244, 132], [62, 62], [360, 70]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill={mix(color, '#2A0F0A', 0.25)} opacity="0.8" />
      ))}
      {[[30, 40, 5], [392, 34, 4], [372, 120, 6], [52, 128, 4], [210, 10, 3]].map(([x, y, r]) => (
        <circle key={`s${x}`} cx={x} cy={y} r={r} fill={color} opacity="0.18" />
      ))}
    </svg>
  );
}

function Rule({ color }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
      <span style={{ height: 1, width: 56, background: color, opacity: 0.5 }} />
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, opacity: 0.7 }} />
      <span style={{ height: 1, width: 56, background: color, opacity: 0.5 }} />
    </div>
  );
}

export default function Bordo({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const c = x.accent;
  const ink = mix(BROWN, '#2A1A12', 0.45);
  const wine = mix(c, '#2A0F0A', 0.15);
  const card = mix(PAPER, '#FFFFFF', 0.55);

  return (
    <div style={{
      color: ink, position: 'relative', overflow: 'hidden', fontFamily: SANS,
      background: `radial-gradient(ellipse at 50% 0%, ${mix(c, PAPER, 0.92)} 0%, ${PAPER} 55%), ${PAPER}`,
    }}>
      <div style={{ padding: '18px 10px 0' }}>
        <Garland color={c} />
      </div>

      <header style={{ position: 'relative', padding: '6px 26px 30px', textAlign: 'center' }} className="stack">
        {guestName && (
          <p style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', color: mix(BROWN, PAPER, 0.15) }}>
            {tt('dear', { name: guestName })}
          </p>
        )}
        <p style={{ fontFamily: SERIF, fontSize: 18, fontStyle: 'italic', color: mix(ink, PAPER, 0.15) }}>{x.inv.headline}</p>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(50px, 14vw, 72px)', lineHeight: 0.95, color: wine }}>
          {wedding.partner1}{wedding.partner2 && (<>
          <span style={{ display: 'block', fontSize: '0.42em', fontStyle: 'normal', letterSpacing: '0.3em', color: BROWN, margin: '10px 0 8px' }}>&amp;</span>
          {wedding.partner2}</>)}<Occasion wedding={wedding} />
        </h1>
        <Rule color={BROWN} />
        <div className="stack" style={{ '--gap': '2px', alignItems: 'center' }}>
          <span style={{ fontSize: 13, letterSpacing: '0.28em', textTransform: 'uppercase', color: BROWN }}>{x.weekday}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SERIF, color: wine }}>
            <span style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', borderTop: `1px solid ${BROWN}55`, borderBottom: `1px solid ${BROWN}55`, padding: '4px 0', minWidth: 74 }}>{x.monthName}</span>
            <span style={{ fontSize: 48, lineHeight: 1 }}>{x.day}</span>
            <span style={{ fontSize: 15, letterSpacing: '0.2em', borderTop: `1px solid ${BROWN}55`, borderBottom: `1px solid ${BROWN}55`, padding: '4px 0', minWidth: 74 }}>{x.year}</span>
          </div>
          {wedding.city && <span style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: BROWN, marginTop: 6 }}>{wedding.city}</span>}
        </div>
        {x.countdown && <p className="small" style={{ color: mix(BROWN, PAPER, 0.2), fontStyle: 'italic', fontFamily: SERIF }}>{x.countdown}</p>}
      </header>

      {x.inv.message && (
        <section style={{ padding: '0 32px 18px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.6, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '10px 18px 30px' }} aria-label={tt('schedule')}>
        <div className="stack" style={{
          '--gap': '18px', padding: '26px 20px', textAlign: 'center', background: card, borderRadius: 4,
          border: `1px solid ${mix(BROWN, PAPER, 0.6)}`, boxShadow: `0 0 0 5px ${card}, 0 0 0 6px ${mix(BROWN, PAPER, 0.75)}`,
        }}>
          <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 28, color: wine }}>{tt('schedule')}</h2>
          {x.schedule.map((e, i) => (
            <div key={e.id} className="stack" style={{ '--gap': '2px', alignItems: 'center' }}>
              {i > 0 && <span aria-hidden="true" style={{ width: 1, height: 16, background: mix(BROWN, PAPER, 0.5), marginBottom: 8 }} />}
              <span style={{ fontSize: 13, letterSpacing: '0.24em', color: c, fontWeight: 500 }}>{e.time}</span>
              <span style={{ fontFamily: SERIF, fontSize: 22 }}>{e.title}</span>
              {e.place && <span className="small" style={{ color: mix(ink, PAPER, 0.25) }}>{e.place}</span>}
              <MapLink event={e} color={BROWN} />
            </div>
          ))}
          <div>
            <CalendarButton wedding={wedding} style={{ background: 'transparent', color: wine, borderColor: mix(c, PAPER, 0.4), borderRadius: 999 }} />
          </div>
        </div>
      </section>

      <div style={{ padding: '0 10px 6px' }}>
        <Garland color={c} flip width={340} />
      </div>

      {children}
    </div>
  );
}
