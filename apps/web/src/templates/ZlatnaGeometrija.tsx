import { inviteInfo, MapLink, CalendarButton, mix, useSvgId, SERIF, SANS } from './shared';
import { Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

export default function ZlatnaGeometrija({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const metal = x.accent;
  const light = mix(metal, '#ffffff', 0.55);
  const dark = mix(metal, '#000000', 0.25);
  const ink = '#2B2B2B';
  const gid = useSvgId('metal');
  const marble = {
    background: `linear-gradient(115deg, transparent 40%, rgba(160,160,160,0.10) 41%, transparent 43%),
      linear-gradient(160deg, transparent 62%, rgba(150,150,150,0.08) 63%, transparent 65%),
      linear-gradient(35deg, transparent 20%, rgba(170,170,170,0.07) 21%, transparent 23%),
      radial-gradient(circle at 30% 20%, #FFFFFF, #F1EFEC)`,
  };
  const caps = { fontFamily: SANS, letterSpacing: '0.32em', textTransform: 'uppercase' };
  const metalText = {
    background: `linear-gradient(100deg, ${dark}, ${light} 45%, ${metal} 60%, ${dark})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };

  return (
    <div style={{ ...marble, color: ink }}>
      <header style={{ padding: '40px 18px 20px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto', aspectRatio: '0.78' }}>
          <svg
            viewBox="0 0 300 384"
            width="100%"
            height="100%"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0 }}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={dark} />
                <stop offset="0.45" stopColor={light} />
                <stop offset="0.6" stopColor={metal} />
                <stop offset="1" stopColor={dark} />
              </linearGradient>
            </defs>
            <path
              d="M150 6 L292 70 V314 L150 378 L8 314 V70 Z"
              fill="rgba(255,255,255,0.55)"
              stroke={`url(#${gid})`}
              strokeWidth="2.2"
            />
            <path
              d="M150 20 L280 78 V306 L150 364 L20 306 V78 Z"
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth="0.8"
            />
            <path d="M150 0 L158 8 L150 16 L142 8 Z" fill={`url(#${gid})`} />
            <path d="M150 368 L158 376 L150 384 L142 376 Z" fill={`url(#${gid})`} />
            <line x1="60" y1="292" x2="240" y2="292" stroke={`url(#${gid})`} strokeWidth="0.8" />
            <line x1="60" y1="96" x2="240" y2="96" stroke={`url(#${gid})`} strokeWidth="0.8" />
          </svg>
          <div
            className="stack"
            style={{
              position: 'absolute',
              inset: '14% 12%',
              justifyContent: 'center',
              alignItems: 'center',
              '--gap': '10px',
            }}
          >
            <p style={{ ...caps, fontSize: 10.5, color: dark }}>
              {guestName ? t('forLowerShort', { name: guestName }) : t('invitation')}
            </p>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 15, lineHeight: 1.3 }}>{x.inv.headline}</p>
            <h1
              style={{
                ...caps,
                fontWeight: 400,
                fontSize: 'clamp(26px, 8vw, 34px)',
                letterSpacing: '0.16em',
                lineHeight: 1.15,
              }}
            >
              {wedding.partner1}
              {wedding.partner2 && (
                <>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: SERIF,
                      fontStyle: 'italic',
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontSize: '1.3em',
                      lineHeight: 1,
                      ...metalText,
                    }}
                  >
                    &amp;
                  </span>
                  {wedding.partner2}
                </>
              )}
              <Occasion wedding={wedding} />
            </h1>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 22, ...caps, fontSize: 13 }}>
          <span>{x.weekday}</span>
          <span style={{ width: 1, height: 28, background: metal }} />
          <span style={{ fontFamily: SERIF, fontSize: 30, letterSpacing: 0, ...metalText }}>{x.day}</span>
          <span style={{ width: 1, height: 28, background: metal }} />
          <span>{x.monthName}</span>
        </div>
        <p style={{ ...caps, fontSize: 12, marginTop: 6 }}>{x.year}</p>
        {x.countdown && (
          <p className="small" style={{ marginTop: 6, color: dark }}>
            {x.countdown}
          </p>
        )}
      </header>

      {x.inv.message && (
        <section style={{ padding: '10px 30px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.6, textAlign: 'center' }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '24px 20px 34px' }} aria-label={t('schedule')}>
        <p style={{ ...caps, fontSize: 12, textAlign: 'center', marginBottom: 14, color: dark }}>
          {t('scheduleShort')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {x.schedule.map((e) => (
            <div
              key={e.id}
              className="stack"
              style={{
                '--gap': '4px',
                alignItems: 'center',
                textAlign: 'center',
                padding: '16px 12px',
                background: 'rgba(255,255,255,0.7)',
                border: `1px solid ${metal}`,
                outline: `1px solid ${metal}55`,
                outlineOffset: -5,
              }}
            >
              <span style={{ fontFamily: SERIF, fontSize: 26, ...metalText }}>{e.time}</span>
              <span style={{ ...caps, fontSize: 11, letterSpacing: '0.18em' }}>{e.title}</span>
              <span className="xs" style={{ opacity: 0.75 }}>
                {e.place}
              </span>
              <MapLink event={e} color={dark} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <CalendarButton
            wedding={wedding}
            style={{
              background: 'transparent',
              color: ink,
              borderColor: metal,
              borderRadius: 0,
              letterSpacing: '0.1em',
            }}
          />
        </div>
      </section>

      {children}
    </div>
  );
}
