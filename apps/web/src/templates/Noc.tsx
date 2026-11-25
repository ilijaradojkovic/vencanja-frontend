import { inviteInfo, MapLink, CalendarButton, DecoCorner, Diamond, SERIF, SANS } from './shared';
import { Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

export default function Noc({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const gold = '#D9C9A3';
  const bg = '#161A18';
  const caps = { fontFamily: SANS, fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: gold };

  return (
    <div style={{ background: bg, color: '#F1E9D8', padding: 14 }}>
      <div style={{ position: 'relative', border: `1px solid ${gold}66`, padding: '56px 22px 32px' }}>
        <DecoCorner color={gold} style={{ top: 6, left: 6 }} />
        <DecoCorner color={gold} rotate={90} style={{ top: 6, right: 6 }} />
        <DecoCorner color={gold} rotate={270} style={{ bottom: 6, left: 6 }} />
        <DecoCorner color={gold} rotate={180} style={{ bottom: 6, right: 6 }} />

        <header className="stack" style={{ textAlign: 'center', alignItems: 'center', '--gap': '18px' }}>
          <div
            style={{
              width: 74,
              height: 74,
              transform: 'rotate(45deg)',
              border: `1px solid ${gold}`,
              display: 'grid',
              placeItems: 'center',
              margin: '8px 0 10px',
            }}
          >
            <span
              style={{ transform: 'rotate(-45deg)', fontFamily: SERIF, fontSize: 24, fontStyle: 'italic', color: gold }}
            >
              {x.initials.length > 1 ? (
                <>
                  {x.initials[0]}&amp;{x.initials[1]}
                </>
              ) : (
                x.initials
              )}
            </span>
          </div>
          {guestName && <p style={caps}>{guestName}</p>}
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 19, color: '#CFC4AE' }}>{x.inv.headline}</p>
          <h1
            style={{
              fontFamily: SERIF,
              fontWeight: 400,
              fontSize: 'clamp(40px, 11vw, 56px)',
              lineHeight: 1.05,
              color: '#F6EFDF',
              letterSpacing: '0.02em',
            }}
          >
            {wedding.partner1}
            {wedding.partner2 && (
              <>
                <br />
                <span style={{ fontStyle: 'italic', color: gold, fontSize: '0.7em' }}>&amp;</span>
                <br />
                {wedding.partner2}
              </>
            )}
            <Occasion wedding={wedding} />
          </h1>
          <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
            <span style={{ width: 40, height: 1, background: gold }} />
            <Diamond color={gold} />
            <span style={{ width: 40, height: 1, background: gold }} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              maxWidth: 300,
            }}
          >
            <span
              style={{
                ...caps,
                borderTop: `1px solid ${gold}66`,
                borderBottom: `1px solid ${gold}66`,
                padding: '6px 0',
                fontSize: 11,
              }}
            >
              {x.weekday}
            </span>
            <span style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1, color: gold }}>{x.day}</span>
            <span
              style={{
                ...caps,
                borderTop: `1px solid ${gold}66`,
                borderBottom: `1px solid ${gold}66`,
                padding: '6px 0',
                fontSize: 11,
              }}
            >
              {x.monthName}
            </span>
          </div>
          <p style={caps}>{x.year}</p>
          {x.countdown && (
            <p className="small" style={{ color: '#CFC4AE' }}>
              {x.countdown}
            </p>
          )}
        </header>

        {x.inv.message && (
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 19,
              lineHeight: 1.55,
              textAlign: 'center',
              fontStyle: 'italic',
              color: '#E5DCC8',
              margin: '36px 0 8px',
            }}
          >
            {x.inv.message}
          </p>
        )}

        <section style={{ marginTop: 32, textAlign: 'center' }} aria-label={t('schedule')}>
          <p style={{ ...caps, marginBottom: 18 }}>{t('eveningSchedule')}</p>
          {x.schedule.map((e, i) => (
            <div key={e.id} className="stack" style={{ '--gap': '4px', alignItems: 'center' }}>
              {i > 0 && (
                <div style={{ margin: '14px 0' }}>
                  <Diamond color={gold} size={6} />
                </div>
              )}
              <span style={{ fontFamily: SERIF, fontSize: 30, color: gold }}>{e.time}</span>
              <span style={{ fontFamily: SANS, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 13 }}>
                {e.title}
              </span>
              <span className="small" style={{ color: '#BDB39F' }}>
                {e.place}
              </span>
              <MapLink event={e} color={gold} />
            </div>
          ))}
          <div style={{ marginTop: 24 }}>
            <CalendarButton
              wedding={wedding}
              style={{
                background: 'transparent',
                color: gold,
                borderColor: gold,
                borderRadius: 0,
                letterSpacing: '0.08em',
              }}
            />
          </div>
        </section>
      </div>
      <div style={{ margin: '14px -14px -14px' }}>{children}</div>
    </div>
  );
}
