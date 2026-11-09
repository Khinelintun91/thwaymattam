import { describe, expect, it } from 'vitest';
import { SAMPLE_NOTE } from '../domain/demo.ts';
import type { Reading } from '../domain/types.ts';
import { displayNotes } from './format.ts';

const stamp = '2026-11-09T00:00:00.000Z';

function glucoseRow(id: string, notes: string): Reading {
  return {
    id,
    type: 'glucose',
    recordedAt: '2026-11-09T07:10:00+06:30',
    glucoseValue: 110,
    glucoseUnit: 'mg/dL',
    mealContext: 'fasting',
    minutesSinceMealStart: null,
    symptoms: [],
    notes,
    source: 'manual',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

describe('displayNotes', () => {
  it('hides the repeated demo sample note but keeps other note text', () => {
    expect(displayNotes(glucoseRow('a', SAMPLE_NOTE))).toBe('');
    expect(displayNotes(glucoseRow('b', `${SAMPLE_NOTE} လက္ခဏာပြသရန်နမူနာ။`))).toBe('လက္ခဏာပြသရန်နမူနာ။');
    expect(displayNotes(glucoseRow('c', 'မနက်စာ စားပြီး'))).toBe('မနက်စာ စားပြီး');
  });
});
