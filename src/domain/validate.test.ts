import { describe, expect, it } from 'vitest';
import { emptyStore, validateMedication, validateStore } from './validate.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

function med(input: Record<string, unknown> = {}) {
  return {
    id: 'med-00001',
    name: 'Metformin',
    dose: '500 mg',
    notes: '',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...input,
  };
}

describe('medications', () => {
  it('validates a medication and rejects an empty name', () => {
    expect(validateMedication(med()).ok).toBe(true);
    const bad = validateMedication(med({ name: '  ' }));
    expect(bad.ok).toBe(false);
  });

  it('migrates a version 1 store to version 2 with an empty medication list', () => {
    const parsed = validateStore(
      { version: 1, revision: 3, updatedAt: NOW.toISOString(), readings: [] },
      { now: NOW },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.version).toBe(2);
    expect(parsed.value.medications).toEqual([]);
    expect(parsed.value.revision).toBe(3);
  });

  it('keeps version 2 medications and rejects unknown versions', () => {
    const parsed = validateStore(
      { ...emptyStore(NOW), medications: [med()] },
      { now: NOW },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.medications).toEqual([med()]);
    expect(validateStore({ version: 3, revision: 0, updatedAt: NOW.toISOString(), readings: [] }).ok).toBe(false);
    expect(validateStore({ version: 2, revision: 0, updatedAt: NOW.toISOString(), readings: [], medications: [med({ name: '' })] }).ok).toBe(false);
  });
});
