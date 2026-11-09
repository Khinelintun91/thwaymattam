import { describe, expect, it } from 'vitest';
import { parseMeterOcr } from './ocrParse.ts';

describe('meter OCR mapping', () => {
  it('reads a glucose screen and drops the date, time, and memory slot', () => {
    const parsed = parseMeterOcr({
      intent: 'glucose',
      text: '2026-11-09 07:42\nMEM 04\n126\nmg/dL',
    });
    expect(parsed.requiresManualConfirmation).toBe(true);
    expect(parsed.glucose).toMatchObject({ value: 126, uncertain: false, source: 'single' });
    expect(parsed.glucoseUnit).toBe('mg/dL');
    expect(parsed.unitExplicit).toBe(true);
    expect(parsed.failure).toBeNull();
    expect(parsed.discarded.map((item) => item.reason)).toEqual(expect.arrayContaining(['date-line', 'memory']));
    expect(parsed.alternatives.map((item) => item.value)).not.toContain(4);
    expect(parsed.systolic).toBeNull();
  });

  it('normalizes Burmese digits and a comma decimal with an explicit mmol unit', () => {
    const parsed = parseMeterOcr({ intent: 'glucose', text: '၅,၆ mmol/L\n09/11/2026 08:30' });
    expect(parsed.glucose?.value).toBe(5.6);
    expect(parsed.glucoseUnit).toBe('mmol/L');
    expect(parsed.unitExplicit).toBe(true);
    expect(parsed.discarded.some((item) => item.reason === 'date-line' || item.reason === 'date' || item.reason === 'time')).toBe(true);
  });

  it('does not choose when two glucose candidates remain', () => {
    const parsed = parseMeterOcr({ intent: 'glucose', text: '126\n98' });
    expect(parsed.glucose).toBeNull();
    expect(parsed.ambiguous).toBe(true);
    expect(parsed.failure).toBe('ambiguous');
    expect(parsed.alternatives.map((item) => item.value).sort((a, b) => a - b)).toEqual([98, 126]);
    expect(parsed.glucoseUnit).toBeNull();
  });

  it('uses the taller word when the reading is visually dominant', () => {
    const parsed = parseMeterOcr({
      intent: 'glucose',
      text: '126 98',
      words: [
        { text: '126', confidence: 92, bbox: { x0: 0, y0: 0, x1: 120, y1: 90 } },
        { text: '98', confidence: 90, bbox: { x0: 0, y0: 120, x1: 40, y1: 140 } },
      ],
    });
    expect(parsed.glucose).toMatchObject({ value: 126, source: 'prominence', uncertain: true });
    expect(parsed.notes).toContain('prominence');
    expect(parsed.notes).toContain('unit-missing');
  });

  it('withholds a low-confidence number', () => {
    const parsed = parseMeterOcr({
      intent: 'glucose',
      text: '126 mg/dL',
      words: [{ text: '126', confidence: 30, bbox: { x0: 0, y0: 0, x1: 40, y1: 40 } }],
    });
    expect(parsed.glucose).toBeNull();
    expect(parsed.failure).toBe('low-confidence');
    expect(parsed.alternatives.map((item) => item.value)).toContain(126);
  });

  it('maps SYS DIA PUL and ignores memory, date, and clock', () => {
    const parsed = parseMeterOcr({
      intent: 'bp',
      text: '2026/11/09 08:15\nPUL 76\nDIA 92\nSYS 148\nMEM 03',
    });
    expect(parsed.systolic).toMatchObject({ value: 148, source: 'label', uncertain: false });
    expect(parsed.diastolic).toMatchObject({ value: 92, source: 'label' });
    expect(parsed.pulse).toMatchObject({ value: 76, source: 'label' });
    expect(parsed.failure).toBeNull();
    expect(parsed.discarded.some((item) => item.reason === 'memory')).toBe(true);
    expect(parsed.alternatives.map((item) => item.value)).not.toEqual(expect.arrayContaining([3, 8, 15]));
  });

  it('accepts a blood-pressure fraction and rejects a calendar fraction', () => {
    const pair = parseMeterOcr({ intent: 'bp', text: '120/80\nPUL 70' });
    expect(pair.systolic?.value).toBe(120);
    expect(pair.diastolic?.value).toBe(80);
    expect(pair.pulse?.value).toBe(70);
    expect(pair.systolic?.uncertain).toBe(true);
    const date = parseMeterOcr({ intent: 'bp', text: '11/09/2026\n08:41' });
    expect(date.systolic).toBeNull();
    expect(date.diastolic).toBeNull();
    expect(date.failure).toBe('no-candidate');
  });

  it('does not guess when labels and the fraction disagree', () => {
    const parsed = parseMeterOcr({ intent: 'bp', text: 'SYS 120\nDIA 80\n120/90' });
    expect(parsed.systolic).toBeNull();
    expect(parsed.diastolic).toBeNull();
    expect(parsed.failure).toBe('ambiguous');
    expect(parsed.notes).toContain('label-conflict');
  });

  it('suggests an unlabeled triple only in systolic, diastolic, pulse order', () => {
    const ordered = parseMeterOcr({ intent: 'bp', text: '148\n92\n76' });
    expect(ordered.systolic?.value).toBe(148);
    expect(ordered.diastolic?.value).toBe(92);
    expect(ordered.pulse?.value).toBe(76);
    expect(ordered.systolic?.uncertain).toBe(true);
    const scrambled = parseMeterOcr({ intent: 'bp', text: '76\n148\n92' });
    expect(scrambled.systolic).toBeNull();
    expect(scrambled.failure).toBe('ambiguous');
  });

  it('fails honestly when the photo only has a date and a memory slot', () => {
    const parsed = parseMeterOcr({ intent: 'glucose', text: '2026-11-09\n07:42\nMEM 12' });
    expect(parsed.glucose).toBeNull();
    expect(parsed.failure).toBe('no-candidate');
    expect(parsed.requiresManualConfirmation).toBe(true);
  });

  it('drops a date that OCR glues to the clock', () => {
    const parsed = parseMeterOcr({ intent: 'glucose', text: '126\nmg/dL\n2026-11-0907:42\nMEM04' });
    expect(parsed.glucose?.value).toBe(126);
    expect(parsed.glucoseUnit).toBe('mg/dL');
    expect(parsed.alternatives).toEqual([]);
  });

  it('fixes a digit-like letter inside a numeric token', () => {
    const parsed = parseMeterOcr({ intent: 'glucose', text: '12O\nmg/dL' });
    expect(parsed.glucose?.value).toBe(120);
  });
});
