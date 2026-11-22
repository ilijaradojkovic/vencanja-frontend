import { CompanionType } from './enums.ts';
import { RuleViolation } from './errors.ts';
import { cleanNames, type CompanionSet } from './gallery.ts';

export const MAX_COMPANIONS = 19;

/** Number of companions a guest may bring, derived from their invitation. */
export const maxCompanions = (
  guest: { companions?: CompanionSet | null | undefined } | null | undefined,
): number => {
  const companions = guest?.companions;
  if (!companions || companions.type === CompanionType.NONE) return 0;
  if (companions.type === CompanionType.NAMED) return companions.names.length;
  return companions.max || 0;
};

/** Total number of people the invitation is for: the guest plus companions. */
export const maxPersons = (companions: CompanionSet | null | undefined): number => 1 + maxCompanions({ companions });

const noCompanions = (): CompanionSet => ({ type: CompanionType.NONE, max: 0, names: [] });

/** Builds the companion rule from the "max persons" field of the guest form. */
export const companionsFromMaxPersons = (maxPersonsInput: unknown): CompanionSet => {
  const companions = Math.max(1, Number(maxPersonsInput) || 1) - 1;
  return companions > 0
    ? { type: CompanionType.OPEN, max: companions, names: [] }
    : noCompanions();
};

const isCompanionType = (value: unknown): value is CompanionType =>
  value === CompanionType.NONE || value === CompanionType.OPEN || value === CompanionType.NAMED;

/**
 * Validates the companion rules when an organizer creates or edits a guest.
 * Throws a `RuleViolation` (422) for invalid named/open companion input.
 */
export const parseCompanions = (input: unknown, maxPersonsInput?: unknown): CompanionSet => {
  if (!input || typeof input !== 'object') return companionsFromMaxPersons(maxPersonsInput);
  const raw = input as { type?: unknown; max?: unknown; names?: unknown };
  const type = isCompanionType(raw.type) ? raw.type : CompanionType.NONE;

  if (type === CompanionType.NAMED) {
    const names = cleanNames(raw.names);
    if (names.length === 0) throw new RuleViolation('namedCompanionRequired');
    if (names.length > MAX_COMPANIONS) throw new RuleViolation('tooManyCompanions');
    return { type, max: names.length, names };
  }

  if (type === CompanionType.OPEN) {
    const max = Number(raw.max);
    if (!Number.isInteger(max) || max < 1 || max > MAX_COMPANIONS) throw new RuleViolation('companionsRange');
    return { type, max, names: [] };
  }

  return noCompanions();
};
