import { inviteInfo, MapLink, CalendarButton, SERIF, Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

export default function Klasik({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const gold = '#D9C9A3';
  return (
    <div style={{ background: '#FBF8F2', color: '#1E2A24' }}>
      <header
        style={{ background: x.accent, color: '#F6F3EE', padding: '56px 28px 48px', textAlign: 'center' }}
        className="stack"
      >
        {guestName && (
          <p className="eyebrow" style={{ color: gold }}>
            {t('invitationFor', { name: guestName })}
          </p>
        )}
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: '#E6DCC6' }}>{x.inv.headline}</p>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(46px, 12vw, 64px)', lineHeight: 1 }}>
          {wedding.partner1}
          {wedding.partner2 && (
            <>
              {' '}
              <span style={{ fontStyle: 'italic', color: gold }}>&amp;</span> {wedding.partner2}
            </>
          )}
          <Occasion wedding={wedding} />
        </h1>
        <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
          <span style={{ width: 36, height: 1, background: gold }} />
          <span style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {x.weekday} · {x.dateLong}
          </span>
          <span style={{ width: 36, height: 1, background: gold }} />
        </div>
        {x.countdown && (
          <p className="small" style={{ color: gold }}>
            {x.countdown}
          </p>
        )}
      </header>

      {x.inv.message && (
        <section style={{ padding: '32px 24px 8px' }}>
          <p style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.45, textAlign: 'center', fontStyle: 'italic' }}>
            {x.inv.message}
          </p>
        </section>
      )}

      <section style={{ padding: 24 }} className="stack" aria-label={t('schedule')}>
        <h2 style={{ fontFamily: SERIF }}>{t('schedule')}</h2>
        {x.schedule.map((e) => (
          <div
            key={e.id}
            className="row"
            style={{
              alignItems: 'flex-start',
              gap: 16,
              padding: 16,
              borderRadius: 14,
              background: '#FFFFFF',
              border: '1px solid #E6DFD3',
            }}
          >
            <div style={{ minWidth: 62, fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: '#7A5C24' }}>
              {e.time}
            </div>
            <div className="grow stack" style={{ '--gap': '2px' }}>
              <strong style={{ fontWeight: 500 }}>{e.title}</strong>
              <span className="small" style={{ opacity: 0.8 }}>
                {e.place}
              </span>
              <MapLink event={e} color="#7A5C24" />
            </div>
          </div>
        ))}
        <CalendarButton wedding={wedding} />
      </section>

      {children}
    </div>
  );
}
