import { EventType } from '../app/config/enums';

export const isCelebration = (w) => w?.type === EventType.CELEBRATION;

export const eventNames = (w) => {
  if (!w) return '';
  return isCelebration(w) || !w.partner2 ? w.partner1 : `${w.partner1} & ${w.partner2}`;
};

export const eventInitials = (w) => {
  const a = (w?.partner1 || '?')[0];
  return isCelebration(w) || !w?.partner2 ? a : `${a}${w.partner2[0]}`;
};
