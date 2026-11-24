import type { EventType } from '@uspomena/shared';

export type EventLike = {
  type?: EventType | string | null;
  partner1?: string | null;
  partner2?: string | null;
  occasion?: string | null;
};

export const isCelebration = (event?: EventLike | null): boolean => event?.type === 'celebration';

/** "Ana & Marko" for a wedding, "Luka" (plus the occasion line elsewhere) for a celebration. */
export const eventNames = (event?: EventLike | null): string => {
  if (!event) return '';
  return isCelebration(event) || !event.partner2
    ? String(event.partner1 ?? '')
    : `${event.partner1} & ${event.partner2}`;
};

export const eventInitials = (event?: EventLike | null): string => {
  const first = (event?.partner1 || '?')[0] ?? '?';
  return isCelebration(event) || !event?.partner2 ? first : `${first}${event.partner2[0] ?? ''}`;
};
