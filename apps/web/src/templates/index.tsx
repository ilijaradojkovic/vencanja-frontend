import Akvarel from './Akvarel';
import Boho from './Boho';
import Bordo from './Bordo';
import Botanika from './Botanika';
import Editorijal from './Editorijal';
import Klasik from './Klasik';
import Minimal from './Minimal';
import Noc from './Noc';
import Romantika from './Romantika';
import Rustik from './Rustik';
import ZlatnaGeometrija from './ZlatnaGeometrija';
import type { InvitationWedding, TemplateProps } from './shared';

export type InvitationTemplate = {
  id: string;
  accents: string[];
  envelope?: string;
  isNew?: boolean;
  Component: (props: TemplateProps) => React.ReactElement;
};

/**
 * The 11 invitation templates from the prototype (templates/index.js). The editor
 * resolves names/descriptions from `templates:items.<id>` so no translation state
 * is stored here.
 */
export const INVITATION_TEMPLATES: InvitationTemplate[] = [
  { id: 'klasik', accents: ['#2D4A3E', '#3B3A5A', '#6B2E3A', '#7A5C24', '#1E2A24'], Component: Klasik },
  { id: 'minimal', accents: ['#151515', '#B08D57', '#2F5D8A', '#A3473A', '#5A7A5A'], Component: Minimal },
  { id: 'botanika', accents: ['#3F5A48', '#5E7A4E', '#2D4A3E', '#7A6A3F', '#4F6B6B'], Component: Botanika },
  { id: 'romantika', accents: ['#C0707A', '#B25A6B', '#A8737F', '#C98B6B', '#8F5E8C'], Component: Romantika },
  { id: 'editorijal', accents: ['#D9472B', '#1F3A93', '#0F0F0F', '#2E7D5B', '#E0A100'], Component: Editorijal },
  { id: 'noc', accents: [], envelope: '#161A18', Component: Noc },
  { id: 'rustik', accents: [], envelope: '#6B4F36', Component: Rustik },
  { id: 'akvarel', accents: ['#7C9CC4', '#D99AA5', '#A89BC9', '#93AE8F', '#E8A87C'], isNew: true, Component: Akvarel },
  {
    id: 'zlatna-geometrija',
    accents: ['#B8913A', '#B76E79', '#8E9AA6', '#9A6B3F', '#2F6B5A'],
    isNew: true,
    Component: ZlatnaGeometrija,
  },
  { id: 'boho', accents: ['#C0673F', '#A4532F', '#C9962E', '#7D7A45', '#B9786E'], isNew: true, Component: Boho },
  { id: 'bordo', accents: ['#8E2B2B', '#A33A2E', '#7A2E3A', '#9C4A2F', '#6E3B2A'], isNew: true, Component: Bordo },
];

const TEMPLATE_MAP = new Map(INVITATION_TEMPLATES.map((template) => [template.id, template]));

export const getInvitationTemplate = (id?: string | null): InvitationTemplate =>
  (id ? TEMPLATE_MAP.get(id) : undefined) ?? (TEMPLATE_MAP.get('klasik') as InvitationTemplate);

/** Envelope colour: the template's accent or its fixed dark envelope colour. */
export const envelopeColor = (invitation?: { templateId?: string; accentColor?: string } | null): string => {
  const template = getInvitationTemplate(invitation?.templateId);
  return template.accents.length ? invitation?.accentColor || template.accents[0] : (template.envelope ?? '#2D4A3E');
};

export function InvitationView({
  wedding,
  guestName,
  children,
}: {
  wedding: InvitationWedding;
  guestName?: string;
  children?: React.ReactNode;
}) {
  const { Component } = getInvitationTemplate(wedding.invitation?.templateId);
  return (
    <Component wedding={wedding} guestName={guestName}>
      {children}
    </Component>
  );
}
