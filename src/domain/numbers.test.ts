import { describe, expect, it } from 'vitest';
import { normalizeNumericInput, parseLooseNumber } from './numbers.ts';

describe('Number normalization & conversion', () => {
  it('keeps ASCII digits and a single decimal point', () => {
    expect(normalizeNumericInput('120.5')).toBe('120.5');
    expect(normalizeNumericInput('12..5')).toBe('12.5');
    expect(normalizeNumericInput('a120b')).toBe('120');
  });

  it('automatically converts Burmese digits to Western digits', () => {
    expect(normalizeNumericInput('၁၂၀')).toBe('120');
    expect(normalizeNumericInput('1၂0')).toBe('120');
    expect(normalizeNumericInput('၁၂၀.၅')).toBe('120.5');
    expect(parseLooseNumber('၁၂၀')).toBe(120);
    expect(parseLooseNumber('၁၂၀.၅')).toBe(120.5);
  });

  it('converts fullwidth digits and drops commas/letters', () => {
    expect(normalizeNumericInput('１２０')).toBe('120');
    expect(normalizeNumericInput('1,200')).toBe('1200');
  });

  it('parses numbers or returns null for invalid strings', () => {
    expect(parseLooseNumber('120')).toBe(120);
    expect(parseLooseNumber('5.5')).toBe(5.5);
    expect(parseLooseNumber('')).toBeNull();
    expect(parseLooseNumber('.')).toBeNull();
  });
});
