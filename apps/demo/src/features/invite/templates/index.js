import { tt } from './shared';
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
import Bordo from './Bordo';

export const INVITATION_TEMPLATES = [
  {
    id: 'klasik',
    get name() { return tt('items.klasik.name'); },
    get description() { return tt('items.klasik.description'); },
    Component: Klasik,
    accents: ['#2D4A3E', '#3B3A5A', '#6B2E3A', '#7A5C24', '#1E2A24'],
  },
  {
    id: 'minimal',
    get name() { return tt('items.minimal.name'); },
    get description() { return tt('items.minimal.description'); },
    Component: Minimal,
    accents: ['#151515', '#B08D57', '#2F5D8A', '#A3473A', '#5A7A5A'],
  },
  {
    id: 'botanika',
    get name() { return tt('items.botanika.name'); },
    get description() { return tt('items.botanika.description'); },
    Component: Botanika,
    accents: ['#3F5A48', '#5E7A4E', '#2D4A3E', '#7A6A3F', '#4F6B6B'],
  },
  {
    id: 'romantika',
    get name() { return tt('items.romantika.name'); },
    get description() { return tt('items.romantika.description'); },
    Component: Romantika,
    accents: ['#C0707A', '#B25A6B', '#A8737F', '#C98B6B', '#8F5E8C'],
  },
  {
    id: 'editorijal',
    get name() { return tt('items.editorijal.name'); },
    get description() { return tt('items.editorijal.description'); },
    Component: Editorijal,
    accents: ['#D9472B', '#1F3A93', '#0F0F0F', '#2E7D5B', '#E0A100'],
  },
  {
    id: 'noc',
    get name() { return tt('items.noc.name'); },
    get description() { return tt('items.noc.description'); },
    Component: Noc,
    accents: [],
    envelope: '#161A18',
  },
  {
    id: 'rustik',
    get name() { return tt('items.rustik.name'); },
    get description() { return tt('items.rustik.description'); },
    Component: Rustik,
    accents: [],
    envelope: '#6B4F36',
  },
  {
    id: 'akvarel',
    get name() { return tt('items.akvarel.name'); },
    get description() { return tt('items.akvarel.description'); },
    Component: Akvarel,
    accents: ['#7C9CC4', '#D99AA5', '#A89BC9', '#93AE8F', '#E8A87C'],
    isNew: true,
  },
  {
    id: 'zlatna-geometrija',
    get name() { return tt('items.zlatna-geometrija.name'); },
    get description() { return tt('items.zlatna-geometrija.description'); },
    Component: ZlatnaGeometrija,
    accents: ['#B8913A', '#B76E79', '#8E9AA6', '#9A6B3F', '#2F6B5A'],
    isNew: true,
  },
  {
    id: 'boho',
    get name() { return tt('items.boho.name'); },
    get description() { return tt('items.boho.description'); },
    Component: Boho,
    accents: ['#C0673F', '#A4532F', '#C9962E', '#7D7A45', '#B9786E'],
    isNew: true,
  },
  {
    id: 'bordo',
    get name() { return tt('items.bordo.name'); },
    get description() { return tt('items.bordo.description'); },
    Component: Bordo,
    accents: ['#8E2B2B', '#A33A2E', '#7A2E3A', '#9C4A2F', '#6E3B2A'],
    isNew: true,
  },
];

export const INVITATION_TEMPLATE_MAP = Object.fromEntries(INVITATION_TEMPLATES.map((t) => [t.id, t]));

export const getInvitationTemplate = (id) => INVITATION_TEMPLATE_MAP[id] || INVITATION_TEMPLATE_MAP.klasik;

export const envelopeColor = (invitation) => {
  const t = getInvitationTemplate(invitation?.templateId);
  return t.accents.length ? invitation?.accentColor || t.accents[0] : t.envelope;
};
