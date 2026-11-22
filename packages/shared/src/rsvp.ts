import { CompanionType, RsvpStatus } from './enums.ts';
import { RuleViolation } from './errors.ts';
import { maxCompanions, maxPersons } from './companions.ts';
import { cleanNames, type CompanionSet } from './gallery.ts';

export type RsvpInput = {
  status?: unknown;
  persons?: unknown;
  companions?: unknown;
  note?: unknown;
};

export type RsvpResult = {
  status: RsvpStatus;
  persons: number;
  companions: string[];
  note: string;
};

export type RsvpGuest = {
  companions: CompanionSet;
  rsvp?: { note?: string } | null;
};

const isAttendingStatus = (value: unknown): value is RsvpStatus =>
  value === RsvpStatus.YES || value === RsvpStatus.NO || value === RsvpStatus.PENDING;

const noteOf = (input: RsvpInput, guest: RsvpGuest): string =>
  typeof input.note === 'string' ? input.note : (guest.rsvp?.note ?? '');

/**
 * Validates a guest RSVP answer. Named companions are kept in the invited order
 * and uninvited names are rejected; open invitations are bounded by the guest's
 * maximum number of persons (`personsRange`). Organizers may also set `pending`.
 */
export const parseRsvp = (
  guest: RsvpGuest,
  input: RsvpInput | null | undefined,
  options: { manual?: boolean } = {},
): RsvpResult => {
  const body = input ?? {};
  const valid = options.manual ? [RsvpStatus.YES, RsvpStatus.NO, RsvpStatus.PENDING] : [RsvpStatus.YES, RsvpStatus.NO];
  const status = body.status;
  if (!isAttendingStatus(status) || !valid.includes(status)) throw new RuleViolation('chooseAttendance');

  if (status !== RsvpStatus.YES) {
    return { status, persons: 0, companions: [], note: noteOf(body, guest) };
  }

  const companions = guest.companions;
  const selected = cleanNames(body.companions);

  if (companions.type === CompanionType.NAMED) {
    if (selected.some((name) => !companions.names.includes(name))) {
      throw new RuleViolation('companionNotInvited');
    }
    const kept = companions.names.filter((name) => selected.includes(name));
    return { status, persons: 1 + kept.length, companions: kept, note: noteOf(body, guest) };
  }

  const allowed = maxCompanions(guest);
  const persons = Number(body.persons) || 1;
  if (persons < 1 || persons > allowed + 1) {
    throw new RuleViolation('personsRange', { max: allowed + 1 });
  }
  if (selected.length > persons - 1) throw new RuleViolation('moreNamesThanPersons');

  return { status, persons, companions: selected, note: noteOf(body, guest) };
};

/**
 * Keeps an existing answer consistent after the organizer changes the companions
 * (SYS-5): companions no longer invited (or beyond the new maximum) are dropped
 * and the number of people is lowered to the new maximum.
 */
export const trimRsvpToCompanions = <T extends RsvpResult>(rsvp: T, companions: CompanionSet): T => {
  if (rsvp.status !== RsvpStatus.YES) return rsvp;
  const kept =
    companions.type === CompanionType.NAMED
      ? rsvp.companions.filter((name) => companions.names.includes(name))
      : rsvp.companions.slice(0, companions.max);
  const persons =
    companions.type === CompanionType.NAMED ? 1 + kept.length : Math.min(rsvp.persons, maxPersons(companions));
  return { ...rsvp, persons, companions: kept.slice(0, persons - 1) };
};
