import { inviteInfo, MapLink, CalendarButton, SERIF, Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

function Twine({ ink }: { ink: string }) {
  return (
    <svg
      viewBox="0 0 300 16"
      width="100%"
      height="16"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', margin: '6px 0' }}
    >
      <path
        d="M0 8 Q 37 0 75 8 T 150 8 T 225 8 T 300 8"
        fill="none"
        stroke={ink}
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeDasharray="5 3"
      />
    </svg>
  );
}

export default function Rustik({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const kraft = '#E8D9BF';
  const ink = '#3E2F22';
  const stamp = '#8A3B2A';
  const paper = {
    background: `radial-gradient(circle at 20% 15%, #F0E4CD 0, transparent 40%), radial-gradient(circle at 85% 70%, #DCCBAE 0, transparent 45%), ${kraft}`,
  };
  return (
    <div style={{ ...paper, color: ink, padding: 12 }}>
      <div style={{ border: `2px dashed ${ink}55`, borderRadius: 10, padding: '44px 22px 26px' }}>
        <header className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          {guestName && (
            <p style={{ fontFamily: SERIF, fontSize: 17 }}>
              {t('forLabel')} <u style={{ textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>{guestName}</u>
            </p>
          )}
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 19 }}>{x.inv.headline}</p>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: 'clamp(42px, 12vw, 60px)',
              lineHeight: 1,
              letterSpacing: '0.01em',
            }}
          >
            {wedding.partner1}
            {wedding.partner2 && (
              <>
                {' '}
                <span style={{ fontWeight: 400, fontStyle: 'italic', color: stamp }}>&amp;</span> {wedding.partner2}
              </>
            )}
            <Occasion wedding={wedding} />
          </h1>

          <div
            style={{
              marginTop: 14,
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: `2px solid ${stamp}`,
              color: stamp,
              display: 'grid',
              placeItems: 'center',
              transform: 'rotate(-8deg)',
              position: 'relative',
            }}
          >
            <span style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: `1px dashed ${stamp}` }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{x.weekday}</div>
              <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 600, lineHeight: 1 }}>
                {x.day}.{x.month}.
              </div>
              <div style={{ fontSize: 13, letterSpacing: '0.2em' }}>{x.year}</div>
            </div>
          </div>
          {x.countdown && (
            <p className="small" style={{ marginTop: 8, opacity: 0.8 }}>
              {x.countdown}
            </p>
          )}
        </header>

        <Twine ink={ink} />

        {x.inv.message && (
          <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.5, textAlign: 'center', margin: '16px 0' }}>
            {x.inv.message}
          </p>
        )}

        <Twine ink={ink} />

        <section style={{ marginTop: 16 }} className="stack" aria-label={t('schedule')}>
          <h2 style={{ fontFamily: SERIF, textAlign: 'center' }}>{t('schedule')}</h2>
          {x.schedule.map((e, i) => (
            <div
              key={e.id}
              style={{
                background: '#FBF5E9',
                padding: '14px 16px',
                borderRadius: 4,
                boxShadow: '0 2px 0 rgba(62,47,34,0.15)',
                transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)`,
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: stamp }}>{e.time}</span>
                <span style={{ fontFamily: SERIF, fontSize: 19 }}>{e.title}</span>
              </div>
              <div className="small" style={{ opacity: 0.8 }}>
                {e.place}
              </div>
              <MapLink event={e} color={stamp} />
            </div>
          ))}
          <CalendarButton
            wedding={wedding}
            style={{ background: 'transparent', color: ink, borderColor: ink, borderStyle: 'dashed' }}
          />
        </section>
      </div>
      <div style={{ margin: '12px -12px -12px' }}>{children}</div>
    </div>
  );
}
