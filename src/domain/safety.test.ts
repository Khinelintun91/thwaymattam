import { describe, expect, it } from 'vitest';
import { evaluateReading, badgeFor } from './safety.ts';
import type { Reading } from './types.ts';
import { isBpCrisis, isGlucoseLow, isGlucoseVeryHigh, mmolToMgdl, roundGlucose } from './units.ts';
import { wallClockToIso } from './time.ts';

const NOW = '2026-11-09T03:00:00.000Z';

function glucose(partial: Partial<Extract<Reading, { type: 'glucose' }>> & Pick<Extract<Reading, { type: 'glucose' }>, 'id' | 'glucoseValue' | 'glucoseUnit'>): Reading {
  return {
    type: 'glucose',
    recordedAt: partial.recordedAt ?? '2026-11-09T07:30:00+06:30',
    mealContext: partial.mealContext ?? 'unknown',
    minutesSinceMealStart: partial.minutesSinceMealStart ?? null,
    symptoms: partial.symptoms ?? [],
    notes: '',
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function bp(partial: Partial<Extract<Reading, { type: 'bp' }>> & Pick<Extract<Reading, { type: 'bp' }>, 'id' | 'systolic' | 'diastolic'>): Reading {
  return {
    type: 'bp',
    recordedAt: partial.recordedAt ?? '2026-11-09T07:30:00+06:30',
    pulse: partial.pulse ?? null,
    symptoms: partial.symptoms ?? [],
    notes: '',
    source: 'manual',
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('units and safety flags', () => {
  it('uses the entered unit for thresholds', () => {
    expect(isGlucoseLow(69, 'mg/dL')).toBe(true);
    expect(isGlucoseLow(70, 'mg/dL')).toBe(false);
    expect(isGlucoseLow(3.8, 'mmol/L')).toBe(true);
    expect(isGlucoseLow(3.9, 'mmol/L')).toBe(false);
    expect(isGlucoseVeryHigh(300, 'mg/dL')).toBe(true);
    expect(isGlucoseVeryHigh(299, 'mg/dL')).toBe(false);
    expect(isGlucoseVeryHigh(16.7, 'mmol/L')).toBe(true);
    expect(isGlucoseVeryHigh(16.6, 'mmol/L')).toBe(false);
    expect(isBpCrisis(181, 80)).toBe(true);
    expect(isBpCrisis(180, 80)).toBe(false);
    expect(isBpCrisis(130, 121)).toBe(true);
    expect(isBpCrisis(130, 120)).toBe(false);
    expect(roundGlucose(mmolToMgdl(5), 'mg/dL')).toBe(90);
  });

  it('does not call an in-range or unknown-context reading normal', () => {
    const unknown = evaluateReading(glucose({ id: 'u', glucoseValue: 90, glucoseUnit: 'mg/dL', mealContext: 'unknown' }));
    expect(unknown.map((notice) => notice.code)).toEqual(['context-unknown']);
    expect(badgeFor(unknown)).toBe('info');
    const fasting = evaluateReading(
      glucose({ id: 'f', glucoseValue: 90, glucoseUnit: 'mg/dL', mealContext: 'fasting', recordedAt: '2026-11-09T07:10:00+06:30' }),
    );
    expect(fasting).toEqual([]);
    expect(badgeFor(fasting)).toBe('none');
    const blob = unknown.map((notice) => `${notice.title} ${notice.body}`).join(' ');
    expect(blob).not.toMatch(/ပုံမှန်ဖြစ်/);
    expect(blob.toLowerCase()).not.toMatch(/\bnormal\b/);
  });

  it('treats emergency symptoms as urgent regardless of the number', () => {
    const notices = evaluateReading(bp({ id: 'e', systolic: 110, diastolic: 70, symptoms: ['chest_pain'] }));
    expect(notices[0]?.code).toBe('emergency-symptoms');
    expect(notices[0]?.body).toMatch(/နံပါတ်/);
    expect(notices.some((notice) => notice.code === 'bp-crisis')).toBe(false);
  });

  it('warns for low glucose and includes swallowing caution', () => {
    const notices = evaluateReading(glucose({ id: 'low', glucoseValue: 64, glucoseUnit: 'mg/dL', mealContext: 'random' }));
    expect(notices.map((notice) => notice.code)).toContain('glucose-low');
    expect(notices[0]?.body).toMatch(/မျို/);
    expect(notices[0]?.body).toMatch(/ပါးစပ်/);
    const confused = evaluateReading(
      glucose({ id: 'low2', glucoseValue: 3.2, glucoseUnit: 'mmol/L', mealContext: 'fasting', symptoms: ['confusion'] }),
    );
    expect(confused[0]?.body).toMatch(/ပါးစပ်မှ အစာအရည် မတိုက်/);
  });

  it('separates a single very high glucose from a persistent or symptomatic one', () => {
    const once = evaluateReading(glucose({ id: 'h1', glucoseValue: 312, glucoseUnit: 'mg/dL', mealContext: 'random' }));
    expect(once.map((notice) => notice.code)).toEqual(['glucose-very-high-recheck']);
    const sick = evaluateReading(
      glucose({ id: 'h2', glucoseValue: 16.7, glucoseUnit: 'mmol/L', mealContext: 'unknown', symptoms: ['vomiting'] }),
    );
    expect(sick.map((notice) => notice.code)).toContain('glucose-very-high-urgent');
    expect(sick.map((notice) => notice.code)).not.toContain('context-unknown');
    const earlier = glucose({
      id: 'h0',
      glucoseValue: 305,
      glucoseUnit: 'mg/dL',
      mealContext: 'random',
      recordedAt: '2026-11-09T05:00:00+06:30',
    });
    const later = glucose({
      id: 'h3',
      glucoseValue: 310,
      glucoseUnit: 'mg/dL',
      mealContext: 'random',
      recordedAt: '2026-11-09T07:00:00+06:30',
    });
    expect(evaluateReading(later, [earlier]).map((notice) => notice.code)).toContain('glucose-very-high-urgent');
    const notHigh = evaluateReading(
      glucose({ id: 'v', glucoseValue: 180, glucoseUnit: 'mg/dL', mealContext: 'postmeal', symptoms: ['vomiting'], minutesSinceMealStart: 90 }),
    );
    expect(notHigh.map((notice) => notice.code)).not.toContain('glucose-very-high-urgent');
  });

  it('flags hypertensive crisis only above the stated cutoffs', () => {
    expect(evaluateReading(bp({ id: 'c', systolic: 186, diastolic: 110 })).map((notice) => notice.code)).toContain('bp-crisis');
    expect(evaluateReading(bp({ id: 'n', systolic: 180, diastolic: 120 }))).toEqual([]);
  });

  it('keeps the clinical timestamp in Rangoon when grouping would otherwise use UTC', () => {
    expect(wallClockToIso('2026-11-09', '00:30')).toBe('2026-11-09T00:30:00+06:30');
  });
});
