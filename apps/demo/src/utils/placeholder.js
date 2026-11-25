const PALETTES = [
  ['#E9DFCC', '#C9B48E', '#8A6A2F', '#F6EEDC'],
  ['#DCE3D7', '#9DB09A', '#4F6B58', '#F2F4EE'],
  ['#EAD9D2', '#C49A8C', '#7D4B44', '#F7EEEA'],
  ['#D8DEE6', '#93A3B8', '#4C5D74', '#EEF1F5'],
  ['#E6E0D3', '#A99C84', '#5E5442', '#F4F1EA'],
  ['#E3D7E0', '#A98EA2', '#5E4459', '#F3EEF2'],
];

export function placeholderPhoto(seed = 0, w = 1200, h = 900) {
  const p = PALETTES[seed % PALETTES.length];
  const r = (n) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  const sunX = Math.round(w * (0.2 + r(1) * 0.6));
  const sunY = Math.round(h * (0.2 + r(2) * 0.2));
  const h1 = Math.round(h * (0.55 + r(3) * 0.15));
  const h2 = Math.round(h * (0.7 + r(4) * 0.12));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<rect width="${w}" height="${h}" fill="${p[0]}"/>
<circle cx="${sunX}" cy="${sunY}" r="${Math.round(h * 0.09)}" fill="${p[3]}"/>
<path d="M0 ${h1} Q ${w * 0.3} ${h1 - h * 0.18} ${w * 0.55} ${h1} T ${w} ${h1 - h * 0.05} V ${h} H 0 Z" fill="${p[1]}"/>
<path d="M0 ${h2} Q ${w * 0.4} ${h2 - h * 0.12} ${w * 0.7} ${h2} T ${w} ${h2} V ${h} H 0 Z" fill="${p[2]}"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
