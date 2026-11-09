import { describe, expect, it } from 'vitest';
import { buildDemoReadings, buildDemoStore } from './demo.ts';
import { dateKey, shiftDateKey } from './time.ts';
import { validateStore } from './validate.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

describe('3-month demo data', () => {
  it('spans 90 days and stays within validation bounds', () => {
    const readings = buildDemoReadings(NOW);
    expect(readings.length).toBeGreaterThan(200);
    expect(readings.length).toBeLessThan(300);
    const dates = readings.map((reading) => dateKey(new Date(reading.recordedAt)));
    expect(Math.min(...dates.map((d) => Date.parse(d)))).toBe(Date.parse(shiftDateKey('2026-11-09', -89) ?? ''));
    expect(Math.max(...dates.map((d) => Date.parse(d)))).toBe(Date.parse('2026-11-09'));
    expect(new Set(readings.map((reading) => reading.id)).size).toBe(readings.length);
    expect(readings.every((reading) => Date.parse(reading.recordedAt) <= NOW.getTime())).toBe(true);
    const validated = validateStore(buildDemoStore(NOW), { now: NOW, maxFutureMs: 48 * 60 * 60 * 1000 });
    expect(validated.ok).toBe(true);
  });

  it('is deterministic for the same date and keeps units valid', () => {
    const first = buildDemoReadings(NOW);
    const second = buildDemoReadings(NOW);
    expect(second).toEqual(first);
    for (const reading of first) {
      if (reading.type !== 'glucose') continue;
      if (reading.glucoseUnit === 'mg/dL') {
        expect(Number.isInteger(reading.glucoseValue)).toBe(true);
        expect(reading.glucoseValue).toBeGreaterThan(40);
      } else {
        expect(Math.abs(reading.glucoseValue * 10 - Math.round(reading.glucoseValue * 10))).toBeLessThan(1e-6);
        expect(reading.glucoseValue).toBeLessThan(40);
      }
    }
    const mmol = first.filter((reading) => reading.type === 'glucose' && reading.glucoseUnit === 'mmol/L');
    expect(mmol.length).toBeGreaterThan(0);
    const bp = first.filter((reading) => reading.type === 'bp');
    expect(bp.length).toBeGreaterThan(50);
  });
});
