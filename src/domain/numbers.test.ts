import { describe, expect, it } from 'vitest';
import { normalizeNumericInput, parseLooseNumber } from './numbers.ts';

describe('English-only numbers', () => {
  it('keeps ASCII digits and a single decimal point', () => {
    expect(normalizeNumericInput('120.5')).toBe('120.5');
    expect(normalizeNumericInput('12..5')).toBe('12.5');
    expect(normalizeNumericInput('a120b')).toBe('120');
  });

  it('drops Burmese digits instead of converting them', () => {
    expect(normalizeNumericInput('၁၂၀')).toBe('');
    expect(normalizeNumericInput('1၂0')).toBe('10');
    expect(parseLooseNumber('၁၂၀')).toBeNull();
  });

  it('drops fullwidth digits and commas', () => {
    expect(normalizeNumericInput('１２０')).toBe('');
    expect(normalizeNumericInput('1,200')).toBe('1200');
  });

  it('parses an English number or returns null', () => {
    expect(parseLooseNumber('120')).toBe(120);
    expect(parseLooseNumber('5.5')).toBe(5.5);
    expect(parseLooseNumber('')).toBeNull();
    expect(parseLooseNumber('.')).toBeNull();
  });
});
