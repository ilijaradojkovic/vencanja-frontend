import Klasik from './Klasik';
import Minimal from './Minimal';
import Botanika from './Botanika';
import Noc from './Noc';
import Romantika from './Romantika';
import Editorijal from './Editorijal';
import Rustik from './Rustik';
import Akvarel from './Akvarel';
import ZlatnaGeometrija from './ZlatnaGeometrija';
import Boho from './Boho';
import Limun from './Limun';
import Retro from './Retro';

/**
 * Katalog izgleda pozivnice. Svaki templejt je zaseban raspored (ne samo druga boja).
 * - accents: predložene boje koje se slažu sa templejtom (prva je podrazumevana);
 *   prazan niz = templejt ima svoju fiksnu paletu i ne koristi akcentnu boju
 * - envelope: boja ekrana sa kovertom kod gosta kada templejt ne koristi akcent
 * ID-jevi klasik/minimal/botanika/noc su isti kao ranije, pa sačuvane pozivnice rade i dalje.
 */
export const INVITATION_TEMPLATES = [
  {
    id: 'klasik',
    name: 'Klasik',
    description: 'Obojeno zaglavlje, serif i zlatni detalji',
    Component: Klasik,
    accents: ['#2D4A3E', '#3B3A5A', '#6B2E3A', '#7A5C24', '#1E2A24'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Belo, levo poravnato, tanak sans',
    Component: Minimal,
    accents: ['#151515', '#B08D57', '#2F5D8A', '#A3473A', '#5A7A5A'],
  },
  {
    id: 'botanika',
    name: 'Botanika',
    description: 'Luk, grančice i vremenska linija',
    Component: Botanika,
    accents: ['#3F5A48', '#5E7A4E', '#2D4A3E', '#7A6A3F', '#4F6B6B'],
  },
  {
    id: 'romantika',
    name: 'Romantika',
    description: 'Puder roze, cveće i pečat sa datumom',
    Component: Romantika,
    accents: ['#C0707A', '#B25A6B', '#A8737F', '#C98B6B', '#8F5E8C'],
  },
  {
    id: 'editorijal',
    name: 'Editorijal',
    description: 'Plakat: ogroman datum i velika slova',
    Component: Editorijal,
    accents: ['#D9472B', '#1F3A93', '#0F0F0F', '#2E7D5B', '#E0A100'],
  },
  {
    id: 'noc',
    name: 'Noć',
    description: 'Tamno, art-deco ram, zlatna slova',
    Component: Noc,
    accents: [],
    envelope: '#161A18',
  },
  {
    id: 'rustik',
    name: 'Rustik',
    description: 'Kraft papir, prošiven rub i pečat',
    Component: Rustik,
    accents: [],
    envelope: '#6B4F36',
  },
  {
    id: 'akvarel',
    name: 'Akvarel',
    description: 'Akvarel cveće u uglovima, nežni italik',
    Component: Akvarel,
    accents: ['#7C9CC4', '#D99AA5', '#A89BC9', '#93AE8F', '#E8A87C'],
    isNew: true,
  },
  {
    id: 'zlatna-geometrija',
    name: 'Zlatna geometrija',
    description: 'Mermer i metalik geometrijski okvir',
    Component: ZlatnaGeometrija,
    // boja = metal: zlato, roze zlato, srebro, bronza, smaragd
    accents: ['#B8913A', '#B76E79', '#8E9AA6', '#9A6B3F', '#2F6B5A'],
    isNew: true,
  },
  {
    id: 'boho',
    name: 'Boho',
    description: 'Terakota lukovi, sunce i pampas trava',
    Component: Boho,
    accents: ['#C0673F', '#A4532F', '#C9962E', '#7D7A45', '#B9786E'],
    isNew: true,
  },
  {
    id: 'limun',
    name: 'Limun',
    description: 'Mediteran: plave pločice i limunovi',
    Component: Limun,
    accents: ['#1F4E9C', '#2A6FB0', '#1F6F78', '#1B2F5E'],
    isNew: true,
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Duga iz 70-ih, krupna i razigrana slova',
    Component: Retro,
    accents: ['#E2622B', '#E07A9B', '#2E8C83', '#7A5BA6', '#C2452D'],
    isNew: true,
  },
];

export const INVITATION_TEMPLATE_MAP = Object.fromEntries(INVITATION_TEMPLATES.map((t) => [t.id, t]));

export const getInvitationTemplate = (id) => INVITATION_TEMPLATE_MAP[id] || INVITATION_TEMPLATE_MAP.klasik;

/** boja pozadine ekrana sa kovertom kod gosta */
export const envelopeColor = (invitation) => {
  const t = getInvitationTemplate(invitation?.templateId);
  return t.accents.length ? invitation?.accentColor || t.accents[0] : t.envelope;
};
