import { describe, expect, it } from 'vitest';

import { CompanionType } from '../src/enums.ts';
import {
  companionsFromMaxPersons,
  MAX_COMPANIONS,
  maxCompanions,
  maxPersons,
  parseCompanions,
} from '../src/companions.ts';
import { RuleViolation } from '../src/errors.ts';
import type { CompanionSet } from '../src/gallery.ts';

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

describe('companionsFromMaxPersons', () => {
  it('turns extra persons into an open companion allowance', () => {
    expect(companionsFromMaxPersons(3)).toEqual({ type: CompanionType.OPEN, max: 2, names: [] });
  });

  it('never allows zero or negative companions', () => {
    expect(companionsFromMaxPersons(1).type).toBe(CompanionType.NONE);
    expect(companionsFromMaxPersons('nonsense').type).toBe(CompanionType.NONE);
  });
});

describe('parseCompanions', () => {
  it('defaults to no companions when the field is missing', () => {
    expect(parseCompanions(undefined, 2)).toEqual({ type: CompanionType.OPEN, max: 1, names: [] });
    expect(parseCompanions(null)).toEqual({ type: CompanionType.NONE, max: 0, names: [] });
  });

  it('accepts named companions and trims the names', () => {
    expect(parseCompanions({ type: 'named', names: [' Marko ', '', 'Jelena'] })).toEqual({
      type: CompanionType.NAMED,
      max: 2,
      names: ['Marko', 'Jelena'],
    });
  });

  it('rejects named companions without a name', () => {
    expectViolation('namedCompanionRequired', () => parseCompanions({ type: 'named', names: [] }));
  });

  it(`rejects more than ${MAX_COMPANIONS} named companions`, () => {
    const names = Array.from({ length: MAX_COMPANIONS + 1 }, (_, index) => `gost ${index}`);
    expectViolation('tooManyCompanions', () => parseCompanions({ type: 'named', names }));
  });

  it('accepts an open range and rejects invalid bounds', () => {
    expect(parseCompanions({ type: 'open', max: 4 })).toEqual({ type: CompanionType.OPEN, max: 4, names: [] });
    for (const max of [0, -1, 1.5, MAX_COMPANIONS + 1, 'x', undefined]) {
      expectViolation('companionsRange', () => parseCompanions({ type: 'open', max }));
    }
  });

  it('treats an unknown type as no companions', () => {
    expect(parseCompanions({ type: 'other', max: 5 })).toEqual({ type: CompanionType.NONE, max: 0, names: [] });
    expect(parseCompanions('nonsense')).toEqual({ type: CompanionType.NONE, max: 0, names: [] });
  });
});

describe('maxCompanions and maxPersons', () => {
  const named: CompanionSet = { type: CompanionType.NAMED, max: 2, names: ['a', 'b'] };

  it('reads the allowance from the invitation', () => {
    expect(maxCompanions({ companions: named })).toBe(2);
    expect(maxCompanions({ companions: { type: CompanionType.OPEN, max: 3, names: [] } })).toBe(3);
    expect(maxCompanions({ companions: { type: CompanionType.NONE, max: 0, names: [] } })).toBe(0);
    expect(maxCompanions({})).toBe(0);
    expect(maxCompanions(null)).toBe(0);
  });

  it('always counts the guest as a person', () => {
    expect(maxPersons(named)).toBe(3);
    expect(maxPersons(null)).toBe(1);
  });
});
