import { describe, expect, it } from 'vitest';
import { bpSeries, glucoseSeries, polylines, yDomain, CHART_GAP_MS } from './chart.ts';
import { buildDemoReadings } from './demo.ts';
import { filterReadings, groupByDay, latestReading } from './history.ts';
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
});
