import { inviteInfo, MapLink, CalendarButton, mix, useSvgId, SERIF } from './shared';
import { Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

function Wash({
  color,
  second,
  leaf,
  size = 190,
  style,
}: {
  color: string;
  second: string;
  leaf: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const id = useSvgId('wash');
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}
    >
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="26" />
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>
        <ellipse cx="70" cy="64" rx="62" ry="50" fill={color} opacity="0.32" />
        <circle cx="112" cy="92" r="40" fill={second} opacity="0.32" />
        <circle cx="58" cy="118" r="30" fill={color} opacity="0.22" />
        <ellipse cx="128" cy="44" rx="22" ry="9" fill={leaf} opacity="0.45" transform="rotate(-30 128 44)" />
        <ellipse cx="34" cy="150" rx="22" ry="9" fill={leaf} opacity="0.4" transform="rotate(60 34 150)" />
      </g>
      {[
        [70, 66, 15],
        [104, 98, 11],
        [52, 104, 8],
      ].map(([cx, cy, r]) => (
        <g key={cx} opacity="0.85">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx={cx}
              cy={cy - r * 0.55}
              rx={r * 0.42}
              ry={r * 0.6}
              fill={mix(color, '#ffffff', 0.15)}
              opacity="0.75"
              transform={`rotate(${a} ${cx} ${cy})`}
            />
          ))}
          <circle cx={cx} cy={cy} r={r * 0.22} fill={mix(color, '#000000', 0.25)} />
        </g>
      ))}
    </svg>
  );
}

export default function Akvarel({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const c = x.accent;
  const second = mix(c, '#E9B8A8', 0.55);
  const leaf = '#8DA68A';
  const ink = '#3D3F4A';
  const soft = mix(c, '#ffffff', 0.85);

  return (
    <div style={{ background: '#FFFFFF', color: ink, position: 'relative', overflow: 'hidden' }}>
      <Wash color={c} second={second} leaf={leaf} style={{ top: -40, left: -50 }} />
      <Wash
        color={c}
        second={second}
        leaf={leaf}
        style={{ top: -50, right: -60, transform: 'scaleX(-1) rotate(10deg)' }}
        size={160}
      />

      <header style={{ position: 'relative', padding: '120px 26px 36px', textAlign: 'center' }} className="stack">
        {guestName && (
          <p style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: mix(c, ink, 0.4) }}>
            {t('dear', { name: guestName })}
          </p>
        )}
        <p style={{ fontFamily: SERIF, fontSize: 18, fontStyle: 'italic', opacity: 0.85 }}>{x.inv.headline}</p>
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(48px, 13vw, 68px)',
            lineHeight: 1,
          }}
        >
          {wedding.partner1}
          {wedding.partner2 && (
            <>
              <span style={{ display: 'block', fontSize: '0.55em', color: c, margin: '6px 0' }}>&amp;</span>
              {wedding.partner2}
            </>
          )}
          <Occasion wedding={wedding} />
        </h1>
        <div
          style={{
            alignSelf: 'center',
            marginTop: 10,
            padding: '10px 22px',
            background: soft,
            borderRadius: '40% 60% 55% 45% / 55% 45% 55% 45%',
          }}
        >
          <span style={{ fontSize: 14, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{x.weekday}</span>
          <div style={{ fontFamily: SERIF, fontSize: 24 }}>{x.dateLong}</div>
        </div>
        {x.countdown && (
          <p className="small" style={{ color: mix(c, ink, 0.4) }}>
            {x.countdown}
          </p>
        )}
      </header>

      {x.inv.message && (
        <section style={{ padding: '0 30px 12px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.55, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section
        style={{ position: 'relative', padding: '24px 22px 40px', textAlign: 'center' }}
        aria-label={t('schedule')}
      >
        <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', marginBottom: 14 }}>{t('schedule')}</h2>
        <div className="stack" style={{ '--gap': '18px' }}>
          {x.schedule.map((e) => (
            <div key={e.id} className="stack" style={{ '--gap': '2px', alignItems: 'center' }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: soft,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: SERIF,
                  color: mix(c, '#000000', 0.2),
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {e.time}
              </span>
              <span style={{ fontFamily: SERIF, fontSize: 21 }}>{e.title}</span>
              <span className="small" style={{ opacity: 0.75 }}>
                {e.place}
              </span>
              <MapLink event={e} color={mix(c, '#000000', 0.2)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22 }}>
          <CalendarButton
            wedding={wedding}
            style={{ background: soft, color: ink, borderColor: 'transparent', borderRadius: 999 }}
          />
        </div>
        <Wash
          color={c}
          second={second}
          leaf={leaf}
          size={150}
          style={{ bottom: -70, right: -50, transform: 'rotate(180deg)', opacity: 0.8 }}
        />
      </section>

      {children}
    </div>
  );
}
