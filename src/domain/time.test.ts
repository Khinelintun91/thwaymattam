import { describe, expect, it } from 'vitest';
import { MEAL_CONTEXTS, type DayPart } from './types.ts';
import { dateKey, dayPart, formatTime12, nowWallClock, rangoonOffsetMinutes, wallClockToIso, zonedParts } from './time.ts';

function at(date: string, time: string): Date {
  const iso = wallClockToIso(date, time);
  if (!iso) throw new Error(`invalid ${date} ${time}`);
  return new Date(iso);
}

describe('Asia/Rangoon clock', () => {
  it('stays at UTC+6:30 with no daylight saving', () => {
    expect(rangoonOffsetMinutes(new Date('2026-01-15T00:00:00Z'))).toBe(390);
    expect(rangoonOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(390);
  });

  it('labels day parts from the Myanmar wall clock', () => {
    const cases: [string, DayPart][] = [
      ['00:00', 'night'],
      ['04:59', 'night'],
      ['05:00', 'morning'],
      ['11:59', 'morning'],
      ['12:00', 'afternoon'],
      ['16:59', 'afternoon'],
      ['17:00', 'evening'],
      ['20:59', 'evening'],
      ['21:00', 'night'],
    ];
    for (const [time, part] of cases) expect(dayPart(at('2026-11-09', time)), time).toBe(part);
  });

  it('formats wall times on a 12-hour clock with the day-part word', () => {
    const cases: [string, string][] = [
      ['07:30', '7:30 နံနက်'],
      ['11:59', '11:59 နံနက်'],
      ['12:00', '12:00 နေ့လယ်'],
      ['13:40', '1:40 နေ့လယ်'],
      ['16:59', '4:59 နေ့လယ်'],
      ['18:30', '6:30 ညနေ'],
      ['21:15', '9:15 ည'],
      ['00:05', '12:05 ည'],
      ['04:59', '4:59 ည'],
    ];
    for (const [time, expected] of cases) expect(formatTime12(at('2026-11-09', time)), time).toBe(expected);
  });

  it('groups an evening UTC instant on the next Myanmar date', () => {
    const instant = new Date('2026-11-08T18:00:00Z');
    expect(dateKey(instant)).toBe('2026-11-09');
    expect(dayPart(instant)).toBe('night');
    expect(zonedParts(instant).hour).toBe(0);
    expect(zonedParts(instant).minute).toBe(30);
  });

  it('rejects impossible civil dates and does not infer a meal', () => {
    expect(wallClockToIso('2026-02-31', '00:00')).toBeNull();
    expect(wallClockToIso('2026-11-09', '25:00')).toBeNull();
    expect(wallClockToIso('2026-11-09', '00:30')).toBe('2026-11-09T00:30:00+06:30');
    const part = dayPart(at('2026-11-09', '07:15'));
    expect(MEAL_CONTEXTS).not.toContain(part);
    const wall = nowWallClock(new Date('2026-11-08T17:30:00Z'));
    expect(wall).toEqual({ date: '2026-11-09', time: '00:00' });
  });
});
