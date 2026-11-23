import { describe, expect, it } from 'vitest';

import {
  ACCENT_COLOR_PATTERN,
  INVITATION_TEMPLATE_IDS,
  isAccentColor,
  isInvitationTemplateId,
  isScheduleTime,
  MAX_SCHEDULE_ITEMS,
  normalizeScheduleItem,
} from '../src/invitation.ts';

describe('invitation templates (SPEC §6.6 item 4)', () => {
  it('accepts the 11 prototype templates and nothing else', () => {
    expect(INVITATION_TEMPLATE_IDS).toHaveLength(11);
    for (const id of INVITATION_TEMPLATE_IDS) expect(isInvitationTemplateId(id)).toBe(true);
    expect(isInvitationTemplateId('klasik')).toBe(true);
    expect(isInvitationTemplateId('custom')).toBe(false);
    expect(isInvitationTemplateId(undefined)).toBe(false);
    expect(isInvitationTemplateId(7)).toBe(false);
  });
});

describe('accent color', () => {
  it('accepts #RRGGBB in either case and rejects other formats', () => {
    expect(isAccentColor('#2D4A3E')).toBe(true);
    expect(isAccentColor('#abcdef')).toBe(true);
    expect(ACCENT_COLOR_PATTERN.test('#ABCDEF')).toBe(true);
    expect(isAccentColor('#abc')).toBe(false);
    expect(isAccentColor('2D4A3E')).toBe(false);
    expect(isAccentColor('#GGGGGG')).toBe(false);
    expect(isAccentColor(null)).toBe(false);
  });
});

describe('schedule validation (SPEC §6.6 item 3)', () => {
  it('accepts 24-hour times only', () => {
    expect(isScheduleTime('00:00')).toBe(true);
    expect(isScheduleTime('23:59')).toBe(true);
    expect(isScheduleTime('9:00')).toBe(false);
    expect(isScheduleTime('24:00')).toBe(false);
    expect(isScheduleTime('12:60')).toBe(false);
    expect(isScheduleTime('noon')).toBe(false);
  });

  it('caps the list at 20 items', () => {
    expect(MAX_SCHEDULE_ITEMS).toBe(20);
  });

  it('trims a valid entry and keeps the optional place, map link and id', () => {
    expect(
      normalizeScheduleItem({
        id: 'e1',
        time: ' 17:00 ',
        title: ' Ceremonija ',
        place: ' Crkva ',
        mapUrl: 'https://maps.example.com/x',
        ignored: 'field',
      }),
    ).toEqual({
      id: 'e1',
      time: '17:00',
      title: 'Ceremonija',
      place: 'Crkva',
      mapUrl: 'https://maps.example.com/x',
    });

    expect(normalizeScheduleItem({ time: '17:00', title: 'Ceremonija' })).toEqual({
      time: '17:00',
      title: 'Ceremonija',
    });
  });

  it('rejects missing titles, bad times, bad links and over-long text', () => {
    expect(normalizeScheduleItem(null)).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00' })).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00', title: '   ' })).toBeNull();
    expect(normalizeScheduleItem({ time: '25:00', title: 'X' })).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00', title: 'X'.repeat(201) })).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00', title: 'X', place: 'p'.repeat(201) })).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00', title: 'X', mapUrl: 'javascript:alert(1)' })).toBeNull();
    expect(normalizeScheduleItem({ time: '17:00', title: 'X', id: 'i'.repeat(65) })).toBeNull();
    expect(
      normalizeScheduleItem({ time: '17:00', title: 'X', mapUrl: `https://x.test/${'a'.repeat(500)}` }),
    ).toBeNull();
  });
});
