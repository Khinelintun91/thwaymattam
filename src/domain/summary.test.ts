import { describe, expect, it } from 'vitest';
import { buildDemoReadings } from './demo.ts';
import { MONTHS_MY } from './labels.ts';
import { availableMonths, monthRange, previousMonth, summarizeReadings, weekSummary, evaluateGlucose, evaluateBp, classifyReading, readingInRange } from './summary.ts';
import type { Reading, Symptom } from './types.ts';
import { validateReading } from './validate.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

function makeReading(input: Record<string, unknown>): Reading {
  const parsed = validateReading(
    {
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      ...input,
    },
    { now: NOW },
  );
  if (!parsed.ok) throw new Error(parsed.errors.map((issue) => `${issue.path}:${issue.code}`).join(','));
  return parsed.value;
}

function glu(id: string, date: string, value: number, context: 'fasting' | 'postmeal', unit: 'mg/dL' | 'mmol/L' = 'mg/dL'): Reading {
  return makeReading({
    id,
    type: 'glucose',
    recordedAt: `${date}T07:30:00+06:30`,
    glucoseValue: value,
    glucoseUnit: unit,
    mealContext: context,
    minutesSinceMealStart: null,
  });
}

function bp(id: string, date: string, systolic: number, diastolic: number, symptoms: Symptom[] = []): Reading {
  return makeReading({
    id,
    type: 'bp',
    recordedAt: `${date}T07:30:00+06:30`,
    systolic,
    diastolic,
    pulse: 72,
    symptoms,
  });
}

describe('monthly summary', () => {
  it('averages, ranges and out-of-target counts for a month', () => {
    const readings = [
      glu('reading01', '2026-11-02', 100, 'fasting'),
      glu('reading02', '2026-11-03', 140, 'fasting'),
      glu('reading03', '2026-11-04', 65, 'fasting'),
      glu('reading04', '2026-11-03', 150, 'postmeal'),
      glu('reading05', '2026-11-04', 200, 'postmeal'),
      bp('reading06', '2026-11-03', 120, 80),
      bp('reading07', '2026-11-04', 140, 90),
      bp('reading08', '2026-11-04', 110, 70, ['chest_pain']),
    ];
    const summary = summarizeReadings(readings, '2026-11-01', '2026-11-30');
    expect(summary.daysLogged).toBe(3);
    expect(summary.glucoseCount).toBe(5);
    expect(summary.bpCount).toBe(3);
    expect(summary.fasting).toEqual({ count: 3, avg: 102, min: 65, max: 140, aboveTarget: 1 });
    expect(summary.postmeal).toEqual({ count: 2, avg: 175, min: 150, max: 200, aboveTarget: 1 });
    expect(summary.lowCount).toBe(1);
    expect(summary.bp).toEqual({ count: 3, avgSys: 123, avgDia: 80, avgPulse: 72, maxSys: 140, aboveTarget: 2 });
    expect(summary.emergencySymptomCount).toBe(1);
    expect(summary.emergencySymptoms).toEqual([{ code: 'chest_pain', count: 1 }]);
  });

  it('converts mmol/L to mg/dL before averaging and returns nulls when empty', () => {
    const readings = [glu('reading01', '2026-11-02', 100, 'fasting'), glu('reading02', '2026-11-03', 7, 'fasting', 'mmol/L')];
    const summary = summarizeReadings(readings, '2026-11-01', '2026-11-30');
    expect(summary.fasting.avg).toBe(113);
    const empty = summarizeReadings(readings, '2026-10-01', '2026-10-31');
    expect(empty.glucoseCount).toBe(0);
    expect(empty.fasting.avg).toBeNull();
    expect(empty.bp.avgSys).toBeNull();
  });

  it('computes month ranges and previous months', () => {
    expect(monthRange(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(previousMonth(2026, 11)).toEqual({ year: 2026, month: 10 });
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it('lists months with readings, newest first', () => {
    const months = availableMonths(buildDemoReadings(NOW), MONTHS_MY);
    expect(months.map((month) => month.key)).toEqual(['2026-11', '2026-10', '2026-09', '2026-08']);
    expect(months[0]?.label).toBe('နိုဝင်ဘာ 2026');
  });

  it('summarizes this week: count and in-target share, ignoring older readings', () => {
    const readings = [
      glu('reading01', '2026-11-03', 100, 'fasting'),
      glu('reading02', '2026-11-04', 140, 'fasting'),
      glu('reading03', '2026-11-05', 65, 'fasting'),
      glu('reading04', '2026-11-06', 150, 'postmeal'),
      bp('reading05', '2026-11-07', 120, 70),
      bp('reading06', '2026-11-08', 140, 90),
      glu('reading07', '2026-10-20', 100, 'fasting'),
    ];
    expect(weekSummary(readings, NOW)).toEqual({ count: 6, inRangePercent: 50 });
    expect(weekSummary([], NOW)).toEqual({ count: 0, inRangePercent: null });
  });
});

describe('reading classification and chart status', () => {
  it('does not classify fasting 75 mg/dL as high (မြင့်) and matches normal status', () => {
    const r75 = glu('reading_g75', '2026-11-09', 75, 'fasting');
    const status = evaluateGlucose(r75 as Extract<Reading, { type: 'glucose' }>);
    expect(status.category).not.toBe('high');
    expect(status.label).not.toBe('မြင့်');
    expect(status.category).toBe('normal');
    expect(status.label).toBe('ပုံမှန်');
    expect(status.color).toBe('#10B981');
    expect(status.badgeClass).toBe('badge-normal');
    expect(readingInRange(r75)).toBe(true);
    expect(classifyReading(r75)).toEqual(status);
  });

  it('classifies fasting 100 and 130 as normal', () => {
    const r100 = glu('reading_g100', '2026-11-09', 100, 'fasting');
    const status100 = evaluateGlucose(r100 as Extract<Reading, { type: 'glucose' }>);
    expect(status100.category).toBe('normal');
    expect(status100.label).toBe('ပုံမှန်');
    expect(readingInRange(r100)).toBe(true);

    const r130 = glu('reading_g130', '2026-11-09', 130, 'fasting');
    const status130 = evaluateGlucose(r130 as Extract<Reading, { type: 'glucose' }>);
    expect(status130.category).toBe('normal');
    expect(status130.label).toBe('ပုံမှန်');
    expect(readingInRange(r130)).toBe(true);
  });

  it('classifies after-meal 140 as normal and 200 as high', () => {
    const r140 = glu('reading_g140', '2026-11-09', 140, 'postmeal');
    const status140 = evaluateGlucose(r140 as Extract<Reading, { type: 'glucose' }>);
    expect(status140.category).toBe('normal');
    expect(status140.label).toBe('ပုံမှန်');
    expect(readingInRange(r140)).toBe(true);

    const r200 = glu('reading_g200', '2026-11-09', 200, 'postmeal');
    const status200 = evaluateGlucose(r200 as Extract<Reading, { type: 'glucose' }>);
    expect(status200.category).toBe('high');
    expect(status200.label).toBe('မြင့်');
    expect(readingInRange(r200)).toBe(false);
  });

  it('places unknown meal timing in a separate neutral grey group using existing app wording', () => {
    const rUnknown = makeReading({
      id: 'reading_g_unk',
      type: 'glucose',
      recordedAt: '2026-11-09T07:30:00+06:30',
      glucoseValue: 90,
      glucoseUnit: 'mg/dL',
      mealContext: 'unknown',
      minutesSinceMealStart: null,
    });
    const status = evaluateGlucose(rUnknown as Extract<Reading, { type: 'glucose' }>);
    expect(status.category).not.toBe('normal');
    expect(status.label).not.toBe('ပုံမှန်');
    expect(status.category).toBe('unknown');
    expect(status.label).toBe('အခြေအနေမသိ');
    expect(status.color).toBe('#94A3B8');
    expect(status.badgeClass).toBe('badge-unknown');
    expect(readingInRange(rUnknown)).toBe(false);
  });

  it('classifies BP according to existing app thresholds without invented ranges', () => {
    const normalBp = bp('reading_bp1', '2026-11-09', 120, 75);
    expect(evaluateBp(normalBp as Extract<Reading, { type: 'bp' }>)).toEqual({
      category: 'normal',
      label: 'ပုံမှန်',
      badgeClass: 'badge-normal',
      color: '#10B981',
    });
    expect(readingInRange(normalBp)).toBe(true);

    const highBp = bp('reading_bp2', '2026-11-09', 135, 82);
    expect(evaluateBp(highBp as Extract<Reading, { type: 'bp' }>)).toEqual({
      category: 'high',
      label: 'မြင့်',
      badgeClass: 'badge-high',
      color: '#F59E0B',
    });
    expect(readingInRange(highBp)).toBe(false);

    const crisisBp = bp('reading_bp3', '2026-11-09', 185, 110);
    expect(evaluateBp(crisisBp as Extract<Reading, { type: 'bp' }>)).toEqual({
      category: 'alert',
      label: 'အလွန်မြင့်',
      badgeClass: 'badge-alert',
      color: '#EF4444',
    });
    expect(readingInRange(crisisBp)).toBe(false);

    // 180/120 is high, not crisis (>180 / >120 is crisis)
    const edgeBp = bp('reading_bp4', '2026-11-09', 180, 120);
    expect(evaluateBp(edgeBp as Extract<Reading, { type: 'bp' }>).category).toBe('high');
  });
});
