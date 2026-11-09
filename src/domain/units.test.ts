import { describe, expect, it } from 'vitest';
import { convertGlucose, formatGlucose, isGlucoseLow } from './units.ts';

describe('glucose units', () => {
  it('converts mg/dL and mmol/L both ways and formats per unit', () => {
    expect(convertGlucose(180, 'mg/dL', 'mmol/L')).toBeCloseTo(10.0, 1);
    expect(convertGlucose(5.6, 'mmol/L', 'mg/dL')).toBeCloseTo(100.9, 1);
    expect(convertGlucose(120, 'mg/dL', 'mg/dL')).toBe(120);
    expect(formatGlucose(6.55, 'mmol/L')).toBe('6.6');
    expect(formatGlucose(118, 'mg/dL')).toBe('118');
  });

  it('flags low glucose in either unit', () => {
    expect(isGlucoseLow(65, 'mg/dL')).toBe(true);
    expect(isGlucoseLow(3.5, 'mmol/L')).toBe(true);
    expect(isGlucoseLow(100, 'mg/dL')).toBe(false);
  });
});
