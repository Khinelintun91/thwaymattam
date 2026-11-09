import { describe, expect, it } from 'vitest';
import { buildDemoReadings } from './demo.ts';
import { MONTHS_MY } from './labels.ts';
import { availableMonths, monthRange, previousMonth, summarizeReadings, weekSummary } from './summary.ts';
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
