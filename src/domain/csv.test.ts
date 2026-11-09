import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from './csv.ts';
import type { Reading } from './types.ts';

describe('CSV export', () => {
  it('escapes formula triggers, quotes, and newlines', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1");
    expect(escapeCsvCell('+cmd')).toBe("'+cmd");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@sum')).toBe("'@sum");
    expect(escapeCsvCell('\t=1')).toBe("'\t=1");
    expect(escapeCsvCell(' =1+1')).toBe("' =1+1");
    expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    const reading: Reading = {
      id: 'reading01',
      type: 'glucose',
      recordedAt: '2026-11-09T07:30:00+06:30',
      glucoseValue: 126,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
      symptoms: ['chest_pain'],
      notes: '=HYPERLINK("http://evil")',
      source: 'manual',
      createdAt: '2026-11-09T01:00:00.000Z',
      updatedAt: '2026-11-09T01:00:00.000Z',
    };
    const csv = toCsv([reading]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('date_rangoon');
    expect(csv).toContain('2026-11-09');
    expect(csv).toContain('07:30');
    expect(csv).toContain('နံနက်');
    expect(csv).toContain('အစာရှောင်');
    expect(csv).toContain(`'=HYPERLINK(""http://evil"")`);
    expect(csv.split('\r\n')[1]?.startsWith('=')).toBe(false);
  });
});
