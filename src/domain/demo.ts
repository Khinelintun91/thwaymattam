import type { Reading, StoreData } from './types.ts';
import { dateKey, shiftDateKey, wallClockToIso } from './time.ts';
import { emptyStore } from './validate.ts';

function at(day: string, time: string): string {
  const iso = wallClockToIso(day, time);
  if (!iso) throw new Error(`Bad demo timestamp ${day} ${time}`);
  return iso;
}

/** Synthetic rows for the isolated demo store. These are not patient records. */
export function buildDemoReadings(now = new Date()): Reading[] {
  const today = dateKey(now);
  const yesterday = shiftDateKey(today, -1);
  const two = shiftDateKey(today, -2);
  const three = shiftDateKey(today, -3);
  if (!yesterday || !two || !three) return [];
  const stamp = now.toISOString();
  const note = 'နမူနာသီးသန့်။ တကယ်လူနာမှတ်တမ်း မဟုတ်ပါ။';
  const base = { symptoms: [] as Reading['symptoms'], source: 'manual' as const, createdAt: stamp, updatedAt: stamp, notes: note };
  return [
    {
      ...base,
      id: 'demo-glu-fast',
      type: 'glucose',
      recordedAt: at(two, '07:10'),
      glucoseValue: 96,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
    },
    {
      ...base,
      id: 'demo-glu-post',
      type: 'glucose',
      recordedAt: at(two, '13:40'),
      glucoseValue: 154,
      glucoseUnit: 'mg/dL',
      mealContext: 'postmeal',
      minutesSinceMealStart: 90,
    },
    {
      ...base,
      id: 'demo-glu-mmol',
      type: 'glucose',
      recordedAt: at(three, '18:05'),
      glucoseValue: 6.4,
      glucoseUnit: 'mmol/L',
      mealContext: 'random',
      minutesSinceMealStart: null,
    },
    {
      ...base,
      id: 'demo-glu-unk',
      type: 'glucose',
      recordedAt: at(yesterday, '08:05'),
      glucoseValue: 110,
      glucoseUnit: 'mg/dL',
      mealContext: 'unknown',
      minutesSinceMealStart: null,
    },
    {
      ...base,
      id: 'demo-glu-low',
      type: 'glucose',
      recordedAt: at(yesterday, '21:20'),
      glucoseValue: 64,
      glucoseUnit: 'mg/dL',
      mealContext: 'random',
      minutesSinceMealStart: null,
      symptoms: ['sweating', 'shaking'],
    },
    {
      ...base,
      id: 'demo-bp-high',
      type: 'bp',
      recordedAt: at(yesterday, '22:00'),
      systolic: 186,
      diastolic: 110,
      pulse: 88,
    },
    {
      ...base,
      id: 'demo-bp-pain',
      type: 'bp',
      recordedAt: at(yesterday, '16:10'),
      systolic: 128,
      diastolic: 82,
      pulse: 90,
      symptoms: ['chest_pain'],
      notes: `${note} လက္ခဏာပြသရန်နမူနာ။`,
    },
    {
      ...base,
      id: 'demo-glu-today',
      type: 'glucose',
      recordedAt: at(today, '07:05'),
      glucoseValue: 101,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
    },
    {
      ...base,
      id: 'demo-bp-today',
      type: 'bp',
      recordedAt: at(today, '07:20'),
      systolic: 122,
      diastolic: 78,
      pulse: 72,
    },
  ];
}

export function buildDemoStore(now = new Date()): StoreData {
  return { ...emptyStore(now), readings: buildDemoReadings(now) };
}
