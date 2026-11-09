import { describe, expect, it } from 'vitest';
import { asciiDigitsToBurmese, burmeseDigitsToAscii, normalizeNumericInput, parseLooseNumber } from './numerals.ts';

describe('Burmese numerals', () => {
  it('maps every Myanmar digit', () => {
    expect(burmeseDigitsToAscii('၀၁၂၃၄၅၆၇၈၉')).toBe('0123456789');
    expect(asciiDigitsToBurmese('0123456789')).toBe('၀၁၂၃၄၅၆၇၈၉');
  });

  it('normalizes mixed input and a single decimal', () => {
    expect(normalizeNumericInput('၁2၃')).toBe('123');
    expect(normalizeNumericInput('၅.၆')).toBe('5.6');
    expect(normalizeNumericInput('၅။၆')).toBe('5.6');
    expect(normalizeNumericInput('12.3.4 mg')).toBe('12.34');
    expect(parseLooseNumber('၁၂၆')).toBe(126);
    expect(parseLooseNumber('5.6')).toBe(5.6);
    expect(parseLooseNumber('12.')).toBeNull();
    expect(parseLooseNumber('')).toBeNull();
  });
});
