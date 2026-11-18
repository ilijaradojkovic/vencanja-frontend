import { useId } from 'react';
import { daysUntil, formatDate, weekday, plural } from '../../../utils/format';
import Icon from '../../../components/Icon';

export const SERIF = "'EB Garamond', Georgia, serif";
export const SANS = "'Jost', system-ui, sans-serif";

export const mapsUrl = (e) => e.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.place)}`;

/** .ics fajl za dodavanje u kalendar (radi bez backenda) */
export const icsHref = (wedding) => {
  const first = wedding.invitation.schedule[0];
  const [hh, mm] = (first?.time || '12:00').split(':');
  const d = wedding.date.replace(/-/g, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Uspomena//SR', 'BEGIN:VEVENT',
    `UID:${wedding.slug}@uspomena`,
    `DTSTART:${d}T${hh}${mm}00`,
    `DTEND:${d}T235900`,
    `SUMMARY:Venčanje – ${wedding.partner1} i ${wedding.partner2}`,
    `LOCATION:${first?.place || wedding.city || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
};

/** sve izvedene vrednosti koje templejti prikazuju */
export function inviteInfo(wedding) {
  const inv = wedding.invitation;
  const days = wedding.date ? daysUntil(wedding.date) : null;
  const d = wedding.date ? new Date(`${wedding.date}T00:00:00`) : null;
  return {
    inv,
    schedule: inv.schedule || [],
    accent: inv.accentColor || '#2D4A3E',
    dateLong: formatDate(wedding.date),
    weekday: wedding.date ? weekday(wedding.date) : '',
    day: d ? String(d.getDate()).padStart(2, '0') : '',
    month: d ? String(d.getMonth() + 1).padStart(2, '0') : '',
    monthName: wedding.date ? formatDate(wedding.date, { month: 'long' }) : '',
    year: d ? d.getFullYear() : '',
    initials: `${(wedding.partner1 || '?')[0]}${(wedding.partner2 || '?')[0]}`,
    countdown:
      days == null ? '' : days > 0 ? `Još ${days} ${plural(days, 'dan', 'dana', 'dana')}` : days === 0 ? 'Danas je veliki dan!' : '',
  };
}

export function MapLink({ event, color }) {
  if (!event.place) return null;
  return (
    <a href={mapsUrl(event)} target="_blank" rel="noreferrer" className="small"
      style={{ color, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}>
      <Icon name="pin" size={16} /> Otvori mapu
    </a>
  );
}

export function CalendarButton({ wedding, style, className = 'btn btn-outline' }) {
  return (
    <a className={className} href={icsHref(wedding)} download={`vencanje-${wedding.slug}.ics`} style={style}>
      <Icon name="calendar" size={18} /> Dodaj u kalendar
    </a>
  );
}

// ---------- ornamenti (čist SVG, boja preko props) ----------

/** grančica sa listovima – listovi se ređaju duž krive */
export function Branch({ color, width = 220, flip = false, style }) {
  const leaves = [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84];
  const pt = (t) => {
    // kvadratna bezijeova kriva (10,40) → (110,8) → (210,40)
    const x = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 110 + t ** 2 * 210;
    const y = (1 - t) ** 2 * 40 + 2 * (1 - t) * t * 8 + t ** 2 * 40;
    return [x, y];
  };
  return (
    <svg viewBox="0 0 220 52" width={width} height={(width / 220) * 52} aria-hidden="true"
      style={{ transform: flip ? 'scaleY(-1)' : undefined, display: 'block', ...style }}>
      <path d="M10 40 Q110 8 210 40" fill="none" stroke={color} strokeWidth="1.4" />
      {leaves.map((t, i) => {
        const [x, y] = pt(t);
        const up = i % 2 === 0;
        const rot = (t - 0.5) * 50 + (up ? -40 : 40);
        return <ellipse key={t} cx={x} cy={y + (up ? -6 : 6)} rx="9" ry="3.6" fill={color} opacity={up ? 0.9 : 0.6} transform={`rotate(${rot} ${x} ${y + (up ? -6 : 6)})`} />;
      })}
      <circle cx="110" cy="16" r="3" fill={color} />
    </svg>
  );
}

/** art-deco ugao */
export function DecoCorner({ color, size = 44, rotate = 0, style }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true"
      style={{ position: 'absolute', transform: `rotate(${rotate}deg)`, ...style }}>
      <path d="M2 42 V2 H42" fill="none" stroke={color} strokeWidth="1.2" />
      <path d="M8 42 V8 H42" fill="none" stroke={color} strokeWidth="0.8" />
      <path d="M14 14 L20 8 L26 14 L20 20 Z" fill="none" stroke={color} strokeWidth="0.8" transform="translate(-6 -0)" />
    </svg>
  );
}

/** buket u uglu – ruže od koncentričnih krugova + listovi */
export function Flowers({ color, leaf, size = 120, style }) {
  const rose = (cx, cy, r) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.9" />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r * 0.36} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
    </g>
  );
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={{ position: 'absolute', ...style }}>
      <ellipse cx="62" cy="22" rx="16" ry="6" fill={leaf} transform="rotate(-20 62 22)" />
      <ellipse cx="22" cy="64" rx="16" ry="6" fill={leaf} transform="rotate(70 22 64)" />
      <ellipse cx="70" cy="48" rx="14" ry="5" fill={leaf} opacity="0.7" transform="rotate(30 70 48)" />
      {rose(30, 30, 18)}
      {rose(54, 40, 11)}
      {rose(38, 54, 9)}
      <circle cx="12" cy="40" r="3" fill={color} opacity="0.6" />
      <circle cx="44" cy="10" r="3" fill={color} opacity="0.6" />
    </svg>
  );
}

export function Diamond({ color, size = 8 }) {
  return <span aria-hidden="true" style={{ width: size, height: size, transform: 'rotate(45deg)', border: `1px solid ${color}`, display: 'inline-block' }} />;
}

// ---------- pomoćno za boje i SVG ----------

/** meša dve hex boje: t=0 → a, t=1 → b */
export function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** jedinstven id za SVG filtere/gradijente (više pregleda na istoj strani) */
export function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}
