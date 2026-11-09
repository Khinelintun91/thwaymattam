import { describe, expect, it } from 'vitest';
import { bpSeries, cappedDomain, glucoseSeries, polylines, yDomain, CHART_GAP_MS } from './chart.ts';
import { buildDemoReadings } from './demo.ts';
import { filterReadings, groupByDay, groupByDayPart, latestReading } from './history.ts';
import { dateKey } from './time.ts';
import type { Reading } from './types.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

describe('history and charts', () => {
  it('groups by the Myanmar date and keeps units and contexts apart', () => {
    const readings = buildDemoReadings(NOW);
    const groups = groupByDay(readings);
    expect(groups[0]?.date).toBe('2026-11-09');
    expect(dateKey(new Date('2026-11-08T18:00:00Z'))).toBe('2026-11-09');
    const utcEvening: Reading = {
      id: 'edgecase1',
      type: 'bp',
      recordedAt: '2026-11-08T18:00:00Z',
      systolic: 118,
      diastolic: 76,
      pulse: null,
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    expect(groupByDay([utcEvening])[0]?.date).toBe('2026-11-09');
    expect(latestReading(readings, 'glucose')?.id).toBe('demo-glu-today');
    expect(latestReading(readings, 'bp')?.id).toBe('demo-bp-today');
    const fasting = filterReadings(readings, { type: 'glucose', context: 'fasting', unit: 'mg/dL', from: '', to: '' });
    expect(fasting.every((reading) => reading.type === 'glucose' && reading.mealContext === 'fasting' && reading.glucoseUnit === 'mg/dL')).toBe(true);
    const mg = glucoseSeries(readings, 'mg/dL');
    const mmol = glucoseSeries(readings, 'mmol/L');
    expect(mg.every((series) => series.points.every((point) => point.y > 40))).toBe(true);
    expect(mmol.every((series) => series.points.every((point) => point.y < 40))).toBe(true);
    expect(new Set(mg.map((series) => series.context)).size).toBeGreaterThan(1);
    expect(bpSeries(readings).systolic.length).toBeGreaterThan(0);
  });

  it('breaks chart lines across long gaps and does not anchor blood pressure at zero', () => {
    const hour = 60 * 60 * 1000;
    const points = [
      { t: 0, y: 120 },
      { t: 2 * hour, y: 130 },
      { t: 2 * hour + CHART_GAP_MS + 1, y: 128 },
    ];
    expect(polylines(points, CHART_GAP_MS)).toHaveLength(2);
    const domain = yDomain([118, 122, 78, 80], [180, 120]);
    expect(domain.min).toBeGreaterThan(40);
    expect(domain.max).toBeLessThan(220);
    const single = yDomain([126], [70, 300]);
    expect(single.max - single.min).toBeGreaterThan(20);
    expect(single.min).toBeGreaterThan(70);
    expect(single.max).toBeLessThan(300);
  });

  it('groups one day by time of day, morning first and earliest first within a part', () => {
    const stamp = NOW.toISOString();
    const row = (id: string, recordedAt: string): Reading => ({
      id,
      type: 'glucose',
      recordedAt,
      glucoseValue: 110,
      glucoseUnit: 'mg/dL',
      mealContext: 'random',
      minutesSinceMealStart: null,
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: stamp,
      updatedAt: stamp,
    });
    const parts = groupByDayPart([
      row('night-1', '2026-11-08T22:00:00+06:30'),
      row('evening-1', '2026-11-08T18:05:00+06:30'),
      row('morning-2', '2026-11-08T07:20:00+06:30'),
      row('afternoon-1', '2026-11-08T13:40:00+06:30'),
      row('morning-1', '2026-11-08T07:10:00+06:30'),
    ]);
    expect(parts.map((part) => part.part)).toEqual(['morning', 'afternoon', 'evening', 'night']);
    expect(parts[0]?.items.map((item) => item.id)).toEqual(['morning-1', 'morning-2']);
    expect(parts[3]?.items.map((item) => item.id)).toEqual(['night-1']);
  });

  it('caps the display domain so one spike does not flatten the chart', () => {
    const uncapped = yDomain([120, 130, 260], []);
    expect(uncapped.max).toBeGreaterThan(240);
    const capped = cappedDomain([120, 130, 260], 200, [180]);
    expect(capped.max).toBeLessThanOrEqual(220);
    expect(capped.max).toBeGreaterThanOrEqual(180);
    expect(capped.min).toBeLessThan(120);
  });
});
