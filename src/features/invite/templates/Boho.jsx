import { inviteInfo, MapLink, CalendarButton, mix, SERIF, SANS } from './shared';
import { tt, Occasion } from './shared';

function Pampas({ color, style, flip }) {
  const stems = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg viewBox="0 0 120 160" width="96" height="128" aria-hidden="true" style={{ position: 'absolute', transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      {stems.map((i) => {
        const a = -38 + i * 7;
        const x2 = 60 + Math.sin((a * Math.PI) / 180) * 140;
        const y2 = 160 - Math.cos((a * Math.PI) / 180) * 140;
        return (
          <g key={i}>
            <path d={`M60 160 Q ${60 + a * 0.6} 90 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="1" opacity="0.7" />
            {Array.from({ length: 7 }, (_, j) => {
              const t = 0.45 + j * 0.08;
              const px = (1 - t) ** 2 * 60 + 2 * (1 - t) * t * (60 + a * 0.6) + t ** 2 * x2;
              const py = (1 - t) ** 2 * 160 + 2 * (1 - t) * t * 90 + t ** 2 * y2;
              return <ellipse key={j} cx={px} cy={py} rx="5" ry="1.4" fill={color} opacity="0.45" transform={`rotate(${a - 60 + (j % 2) * 120} ${px} ${py})`} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

export default function Boho({ wedding, guestName, children }) {
  const x = inviteInfo(wedding);
  const t1 = x.accent;
  const t2 = mix(t1, '#F2E6D8', 0.45);
  const t3 = mix(t1, '#F2E6D8', 0.75);
  const sand = '#F4EADF';
  const ink = '#4B3528';

  return (
    <div style={{ background: sand, color: ink, overflow: 'hidden' }}>
      <header style={{ position: 'relative', padding: '28px 22px 30px', textAlign: 'center' }}>
        <Pampas color={mix(t1, '#8C6E4E', 0.5)} style={{ top: 10, left: -8 }} />
        <Pampas color={mix(t1, '#8C6E4E', 0.5)} style={{ top: 10, right: -8 }} flip />

        <svg viewBox="0 0 220 150" width="220" height="150" aria-hidden="true" style={{ display: 'block', margin: '0 auto' }}>
          <path d="M20 150 V110 A90 90 0 0 1 200 110 V150 Z" fill={t3} />
          <path d="M45 150 V112 A65 65 0 0 1 175 112 V150 Z" fill={t2} />
          <path d="M70 150 V114 A40 40 0 0 1 150 114 V150 Z" fill={t1} />
          <circle cx="110" cy="38" r="14" fill={mix(t1, '#E8B04B', 0.6)} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i * Math.PI) / 8;
            return <line key={i} x1={110 + Math.cos(a) * 20} y1={38 + Math.sin(a) * 20} x2={110 + Math.cos(a) * 28} y2={38 + Math.sin(a) * 28} stroke={mix(t1, '#E8B04B', 0.6)} strokeWidth="2" strokeLinecap="round" />;
          })}
        </svg>

        <div className="stack" style={{ marginTop: 20, alignItems: 'center' }}>
          {guestName && <p style={{ fontFamily: SANS, fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: t1 }}>{guestName}</p>}
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 19 }}>{x.inv.headline}</p>
          <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(44px, 12vw, 62px)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {wedding.partner1}{wedding.partner2 && (<>
            <span style={{ display: 'block', fontStyle: 'italic', textTransform: 'lowercase', color: t1, fontSize: '0.6em', fontWeight: 400 }}>i</span>
            {wedding.partner2}</>)}<Occasion wedding={wedding} />
          </h1>
          <div style={{ marginTop: 6, padding: '8px 20px', borderRadius: 999, border: `1px solid ${t1}`, fontFamily: SANS, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {x.weekday} · {x.day}.{x.month}.{x.year}
          </div>
          {x.countdown && <p className="small" style={{ color: t1 }}>{x.countdown}</p>}
        </div>
      </header>

      {x.inv.message && (
        <section style={{ padding: '4px 28px 10px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.55, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '24px 18px 34px' }} aria-label={tt('schedule')}>
        <h2 style={{ fontFamily: SERIF, textAlign: 'center', marginBottom: 16 }}>{tt('schedule')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {x.schedule.map((e, i) => (
            <div key={e.id} className="stack" style={{ '--gap': '4px', alignItems: 'center', textAlign: 'center', padding: '28px 14px 18px', borderRadius: '999px 999px 12px 12px', background: [t3, '#FFFFFF'][i % 2], border: `1px solid ${t2}` }}>
              <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: t1 }}>{e.time}</span>
              <span style={{ fontFamily: SERIF, fontSize: 18 }}>{e.title}</span>
              <span className="xs" style={{ opacity: 0.8 }}>{e.place}</span>
              <MapLink event={e} color={t1} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <CalendarButton wedding={wedding} style={{ background: t1, color: '#FFF8F0', borderColor: t1, borderRadius: 999 }} />
        </div>
      </section>

      {children}
    </div>
  );
}
