import { describe, expect, it } from 'vitest';
import { applyImport, applyMerge, buildBackup, importResultSummary, planImport, readImport, readingFingerprint } from './backup.ts';
import type { Reading } from './types.ts';
import { validateReading } from './validate.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

function glucose(id: string, value: number, minute = '07:30'): Reading {
  const parsed = validateReading(
    {
      id,
      type: 'glucose',
      recordedAt: `2026-11-09T${minute}:00+06:30`,
      glucoseValue: value,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    { now: NOW },
  );
  if (!parsed.ok) throw new Error(parsed.errors.map((issue) => `${issue.path}:${issue.code}`).join(','));
  return parsed.value;
}

describe('backup import', () => {
  it('rejects invalid rows, strips images, and dedupes before merge or replace', () => {
    const existing = glucose('reading01', 101);
    const file = buildBackup([existing], [], NOW);
    expect(file.app).toBe('thwaymattam');
    expect(file.timezone).toBe('Asia/Rangoon');
    const raw = {
      ...file,
      readings: [
        { ...existing, photo: 'data:image/png;base64,AAAA', imageData: 'secret' },
        {
          id: 'reading02',
          type: 'glucose',
          recordedAt: '2026-11-09T08:00:00+06:30',
          glucoseValue: 0,
          glucoseUnit: 'mg/dL',
          mealContext: 'fasting',
          symptoms: ['chest_pain'],
          notes: '',
          source: 'manual',
        },
        {
          id: 'reading03',
          type: 'bp',
          recordedAt: '2026-11-09T08:10:00+06:30',
          systolic: 80,
          diastolic: 90,
          pulse: null,
          symptoms: ['not-a-symptom'],
          notes: '',
          source: 'manual',
        },
        {
          id: 'reading04',
          type: 'bp',
          recordedAt: '2026-11-09T08:20:00+06:30',
          systolic: 128,
          diastolic: 76,
          pulse: 70,
          symptoms: [],
          notes: '',
          source: 'ocr',
        },
        { ...existing, id: 'reading05' },
      ],
    };
    const imported = readImport(raw, { now: NOW });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.rejected.map((row) => row.index)).toEqual([1, 2]);
    expect(JSON.stringify(imported.readings)).not.toMatch(/photo|imageData|base64/);
    const plan = planImport([existing], imported.readings);
    expect(plan.duplicates.map((row) => row.match)).toEqual(['id', 'fingerprint']);
    expect(plan.accepted.map((reading) => reading.id)).toEqual(['reading04']);
    expect(applyImport([existing], plan.accepted, 'merge').map((reading) => reading.id)).toEqual(['reading01', 'reading04']);
    expect(applyImport([existing], plan.accepted, 'replace').map((reading) => reading.id)).toEqual(['reading04']);
    expect(readingFingerprint(existing)).toBe(readingFingerprint({ ...existing, id: 'reading05', notes: 'different note' }));
  });

  it('merges the same file twice and back and forth without duplicating ids', () => {
    const first = glucose('reading01', 101, '07:30');
    const second = glucose('reading02', 140, '13:00');
    const phoneB = applyMerge([], planImport([], [first, second]));
    const again = planImport(phoneB, [first, second]);
    expect(again.accepted).toEqual([]);
    expect(again.updates).toEqual([]);
    expect(again.duplicates).toHaveLength(2);
    expect(applyMerge(phoneB, again)).toHaveLength(2);

    const third = glucose('reading03', 88, '20:15');
    const back = planImport([first, second], [...phoneB, third]);
    expect(back.accepted.map((reading) => reading.id)).toEqual(['reading03']);
    expect(back.duplicates).toHaveLength(2);
    const phoneA = applyMerge([first, second], back);

    const roundTrip = planImport([...phoneB, third], phoneA);
    expect(roundTrip.accepted).toEqual([]);
    expect(roundTrip.updates).toEqual([]);
    expect(roundTrip.duplicates.map((row) => row.reading.id).sort()).toEqual(['reading01', 'reading02', 'reading03']);
    expect(importResultSummary(0, 3)).toBe('အသစ် 0 ခု ထည့်ပြီးပါပြီ။ ရှိပြီးသား 3 ခု ကို ထပ်မထည့်ပါ။');
    expect(importResultSummary(1, 2, 1)).toBe(
      'အသစ် 1 ခု ထည့်ပြီးပါပြီ။ နောက်ဆုံးပြင်ဆင်ချက် 1 ခု ကို ယူထားပါသည်။ ရှိပြီးသား 2 ခု ကို ထပ်မထည့်ပါ။',
    );

    const edited = { ...first, notes: 'ပြင်ပြီး', updatedAt: '2026-11-09T10:00:00.000Z' };
    const editedPlan = planImport(phoneA, [edited, second, third]);
    expect(editedPlan.updates.map((reading) => reading.id)).toEqual(['reading01']);
    expect(editedPlan.accepted).toEqual([]);
    expect(applyMerge(phoneA, editedPlan).find((reading) => reading.id === 'reading01')?.notes).toBe('ပြင်ပြီး');

    const older = { ...edited, notes: 'အဟောင်း', updatedAt: '2026-11-09T01:00:00.000Z' };
    const olderPlan = planImport(applyMerge(phoneA, editedPlan), [older]);
    expect(olderPlan.updates).toEqual([]);
    expect(olderPlan.duplicates.map((row) => row.match)).toEqual(['id']);
  });

  it('rejects the wrong envelope', () => {
    expect(readImport({ app: 'other', version: 1, readings: [] }).ok).toBe(false);
    expect(readImport({ app: 'thwaymattam', version: 3, readings: [] })).toMatchObject({ ok: false, code: 'unsupported-version' });
    expect(readImport([])).toMatchObject({ ok: false, code: 'not-object' });
  });

  it('imports version 1 backups without medications and version 2 backups with them', () => {
    const v1 = readImport({ app: 'thwaymattam', version: 1, timezone: 'Asia/Rangoon', exportedAt: NOW.toISOString(), readings: [] });
    expect(v1.ok && v1.medications).toEqual([]);
    const med = { id: 'med-00001', name: 'Metformin', dose: '500 mg', notes: '', createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
    const v2 = readImport({
      app: 'thwaymattam',
      version: 2,
      timezone: 'Asia/Rangoon',
      exportedAt: NOW.toISOString(),
      readings: [],
      medications: [med, { ...med, id: 'med-00002', name: '' }],
    });
    expect(v2.ok && v2.medications).toEqual([med]);
    expect(v2.ok && v2.rejectedMedications).toBe(1);
  });
});
