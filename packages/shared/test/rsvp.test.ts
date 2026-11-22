import { describe, expect, it } from 'vitest';

import { CompanionType, RsvpStatus } from '../src/enums.ts';
import { RuleViolation } from '../src/errors.ts';
import type { CompanionSet } from '../src/gallery.ts';
import { parseRsvp, trimRsvpToCompanions, type RsvpResult } from '../src/rsvp.ts';

const namedGuest = {
  companions: { type: CompanionType.NAMED, max: 2, names: ['Marko', 'Jelena'] },
  rsvp: { note: 'stara napomena' },
};
const openGuest = { companions: { type: CompanionType.OPEN, max: 2, names: [] } };
const soloGuest = { companions: { type: CompanionType.NONE, max: 0, names: [] } };

const expectViolation = (code: string, run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RuleViolation);
    expect((error as RuleViolation).code).toBe(code);
    return;
  }
  throw new Error(`expected a RuleViolation with code ${code}`);
};

describe('parseRsvp', () => {
  it('rejects a missing or unknown answer', () => {
    expectViolation('chooseAttendance', () => parseRsvp(soloGuest, {}));
    expectViolation('chooseAttendance', () => parseRsvp(soloGuest, { status: 'maybe' }));
    expectViolation('chooseAttendance', () => parseRsvp(soloGuest, null));
  });

  it('rejects pending for guests but allows it for the organizer', () => {
    expectViolation('chooseAttendance', () => parseRsvp(soloGuest, { status: 'pending' }));
    expect(parseRsvp(soloGuest, { status: 'pending' }, { manual: true })).toEqual({
      status: RsvpStatus.PENDING,
      persons: 0,
      companions: [],
      note: '',
    });
  });

  it('clears the people count when the guest cannot come', () => {
    expect(parseRsvp(namedGuest, { status: 'no', note: 'nažalost ne mogu' })).toEqual({
      status: RsvpStatus.NO,
      persons: 0,
      companions: [],
      note: 'nažalost ne mogu',
    });
  });

  it('keeps the stored note when the answer does not send one', () => {
    expect(parseRsvp(namedGuest, { status: 'no' }).note).toBe('stara napomena');
  });

  it('keeps named companions in the invited order', () => {
    expect(parseRsvp(namedGuest, { status: 'yes', companions: ['Jelena', 'Marko'] })).toEqual({
      status: RsvpStatus.YES,
      persons: 3,
      companions: ['Marko', 'Jelena'],
      note: 'stara napomena',
    });
  });

  it('rejects a companion who is not on the invited list', () => {
    expectViolation('companionNotInvited', () =>
      parseRsvp(namedGuest, { status: 'yes', companions: ['Nepoznati'] }),
    );
  });

  it('accepts one named companion', () => {
    expect(parseRsvp(namedGuest, { status: 'yes', companions: ['Marko'] })).toEqual({
      status: RsvpStatus.YES,
      persons: 2,
      companions: ['Marko'],
      note: 'stara napomena',
    });
  });

  it('bounds an open answer by the invitation maximum', () => {
    expect(parseRsvp(openGuest, { status: 'yes', persons: 3 }).persons).toBe(3);
    expectViolation('personsRange', () => parseRsvp(openGuest, { status: 'yes', persons: 4 }));
    expectViolation('personsRange', () => parseRsvp(openGuest, { status: 'yes', persons: -2 }));
  });

  it('treats a missing, zero or non-numeric count as one person, like the prototype', () => {
    expect(parseRsvp(openGuest, { status: 'yes' }).persons).toBe(1);
    expect(parseRsvp(openGuest, { status: 'yes', persons: 0 }).persons).toBe(1);
    expect(parseRsvp(openGuest, { status: 'yes', persons: 'dvoje' }).persons).toBe(1);
  });

  it('reports the maximum in the personsRange message', () => {
    try {
      parseRsvp(openGuest, { status: 'yes', persons: 9 });
    } catch (error) {
      expect((error as RuleViolation).params).toEqual({ max: 3 });
    }
  });

  it('rejects more companion names than people coming', () => {
    expectViolation('moreNamesThanPersons', () =>
      parseRsvp(openGuest, { status: 'yes', persons: 2, companions: ['Ana', 'Bojan'] }),
    );
    expect(parseRsvp(openGuest, { status: 'yes', persons: 3, companions: ['Ana', 'Bojan'] }).companions).toEqual([
      'Ana',
      'Bojan',
    ]);
  });

  it('allows exactly one person when no companions are invited', () => {
    expect(parseRsvp(soloGuest, { status: 'yes', persons: 1 }).persons).toBe(1);
    expectViolation('personsRange', () => parseRsvp(soloGuest, { status: 'yes', persons: 2 }));
  });

  it('ignores a non-string note', () => {
    expect(parseRsvp(soloGuest, { status: 'yes', note: 42 }).note).toBe('');
  });
});

describe('trimRsvpToCompanions (SYS-5)', () => {
  const answer: RsvpResult = {
    status: RsvpStatus.YES,
    persons: 3,
    companions: ['Marko', 'Jelena'],
    note: '',
  };

  it('drops companions who are no longer invited', () => {
    const companions: CompanionSet = { type: CompanionType.NAMED, max: 2, names: ['Jelena'] };
    expect(trimRsvpToCompanions(answer, companions)).toEqual({
      status: RsvpStatus.YES,
      persons: 2,
      companions: ['Jelena'],
      note: '',
    });
  });

  it('lowers the persons when they exceed the new maximum', () => {
    const companions: CompanionSet = { type: CompanionType.OPEN, max: 1, names: [] };
    expect(trimRsvpToCompanions(answer, companions)).toEqual({
      status: RsvpStatus.YES,
      persons: 2,
      companions: ['Marko'],
      note: '',
    });
  });

  it('removes all companions when they are no longer allowed', () => {
    const companions: CompanionSet = { type: CompanionType.NONE, max: 0, names: [] };
    expect(trimRsvpToCompanions(answer, companions)).toEqual({
      status: RsvpStatus.YES,
      persons: 1,
      companions: [],
      note: '',
    });
  });

  it('leaves a negative answer untouched', () => {
    const declined: RsvpResult = { ...answer, status: RsvpStatus.NO, persons: 0, companions: [] };
    expect(trimRsvpToCompanions(declined, { type: CompanionType.NONE, max: 0, names: [] })).toBe(declined);
  });
});
