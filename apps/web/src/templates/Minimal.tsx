import { inviteInfo, MapLink, CalendarButton, SANS } from './shared';
import { Occasion, type TemplateProps } from './shared';
import { useTranslation } from 'react-i18next';

export default function Minimal({ wedding, guestName, children }: TemplateProps) {
  const { t, i18n } = useTranslation('templates');
  const locale = (i18n.resolvedLanguage ?? 'sr') as 'sr' | 'en' | 'ru';
  const x = inviteInfo(wedding, t, locale);
  const ink = '#151515';
  const line = '#E4E4E4';
  const label = {
    fontFamily: SANS,
    fontSize: 11,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: '#8A8A8A',
  };

  return (
    <div style={{ background: '#FFFFFF', color: ink, fontFamily: SANS }}>
      <header style={{ padding: '64px 28px 40px' }}>
        <div className="row between" style={{ marginBottom: 56 }}>
          <span style={label}>{guestName ? t('forName', { name: guestName }) : t('invitation')}</span>
          <span style={{ ...label, color: x.accent }}>
            {x.day}.{x.month}.{x.year}
          </span>
        </div>
        <h1
          style={{
            fontFamily: SANS,
            fontWeight: 300,
            fontSize: 'clamp(48px, 14vw, 72px)',
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
          }}
        >
          {wedding.partner1}
          {wedding.partner2 && (
            <>
              <br />
              <span style={{ color: x.accent }}>+</span> {wedding.partner2}
            </>
          )}
          <Occasion wedding={wedding} />
        </h1>
        <div style={{ width: 48, height: 2, background: x.accent, margin: '32px 0 20px' }} />
        <p style={{ fontSize: 17, fontWeight: 300, lineHeight: 1.5, maxWidth: 320 }}>{x.inv.headline}</p>
      </header>

      <section
        style={{
          padding: '0 28px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${line}`,
          borderBottom: `1px solid ${line}`,
        }}
      >
        <div style={{ padding: '18px 0', borderRight: `1px solid ${line}` }}>
          <div style={label}>{t('date')}</div>
          <div style={{ fontSize: 17, marginTop: 6, textTransform: 'capitalize' }}>{x.weekday}</div>
          <div style={{ fontSize: 15, fontWeight: 300 }}>{x.dateLong}</div>
        </div>
        <div style={{ padding: '18px 0 18px 18px' }}>
          <div style={label}>{t('countdownLabel')}</div>
          <div style={{ fontSize: 17, marginTop: 6 }}>{x.countdown || '—'}</div>
        </div>
      </section>

      {x.inv.message && (
        <section style={{ padding: '36px 28px 8px' }}>
          <p style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.7 }}>{x.inv.message}</p>
        </section>
      )}

      <section style={{ padding: '32px 28px' }} aria-label={t('schedule')}>
        <div style={{ ...label, marginBottom: 12 }}>{t('scheduleShort')}</div>
        {x.schedule.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr',
              gap: 12,
              padding: '16px 0',
              borderTop: `1px solid ${line}`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 300, color: x.accent }}>{e.time}</div>
            <div className="stack" style={{ '--gap': '2px' }}>
              <span style={{ fontWeight: 500 }}>{e.title}</span>
              <span className="small" style={{ color: '#6A6A6A', fontWeight: 300 }}>
                {e.place}
              </span>
              <MapLink event={e} color={ink} />
            </div>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${line}`, paddingTop: 20 }}>
          <CalendarButton
            wedding={wedding}
            style={{ background: 'transparent', color: ink, borderColor: ink, borderRadius: 0 }}
          />
        </div>
      </section>

      {children}
    </div>
  );
}
