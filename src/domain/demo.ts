import type { Medication, Reading, StoreData } from './types.ts';
import { dateKey, shiftDateKey, wallClockToIso } from './time.ts';
import { emptyStore } from './validate.ts';

/**
 * True when a stored demo set predates the 3-month generated rows: the old
 * set has only the 9 anchor rows and no generated `demo-*-d<offset>-*` ids.
 * An empty set is not stale — the normal seeding path handles it.
 */
export function isStaleDemoSet(readings: Reading[]): boolean {
  return readings.length > 0 && !readings.some((reading) => /^demo-(glu|bp)-d\d+-/.test(reading.id));
}

/** Sample medicines for the demo room only. Clearly labelled as samples. */
export function buildDemoMedications(now = new Date()): Medication[] {
  const stamp = now.toISOString();
  const note = 'နမူနာသီးသန့်။';
  return [
    { id: 'demo-med-1', name: 'Metformin', dose: '500 mg · မနက် ၁ လုံး၊ ည ၁ လုံး', notes: note, createdAt: stamp, updatedAt: stamp },
    { id: 'demo-med-2', name: 'Amlodipine', dose: '5 mg · မနက် ၁ လုံး', notes: note, createdAt: stamp, updatedAt: stamp },
  ];
}

function at(day: string, time: string): string {
  const iso = wallClockToIso(day, time);
  if (!iso) throw new Error(`Bad demo timestamp ${day} ${time}`);
  return iso;
}

/** Deterministic 0..1 from two integers, so demo rows are stable for a given date. */
function pseudo(offset: number, salt: number): number {
  let x = (Math.imul(offset, 2654435761) + Math.imul(salt, 40503) + 12345) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function whole(value: number): number {
  return Math.floor(value);
}

/**
 * Generated demo rows for one older day (offset 4..89 days back), in the
 * same morning/evening rhythm as a real log: fasting glucose + blood
 * pressure in the morning, one glucose reading in the evening. A few days
 * are skipped entirely, and a few readings are low or high, so charts,
 * history and safety notices show realistic variety.
 */
function generatedDayRows(day: string, offset: number, stamp: string, note: string): Reading[] {
  const base = { symptoms: [] as Reading['symptoms'], source: 'manual' as const, createdAt: stamp, updatedAt: stamp, notes: note };
  if (pseudo(offset, 1) < 0.12) return [];
  const rows: Reading[] = [];
  const morningMinute = 5 + (offset % 3) * 4;
  const morningTime = `07:${String(morningMinute).padStart(2, '0')}`;
  const r = pseudo(offset, 2);
  const fasting = r < 0.06 ? 66 + whole(pseudo(offset, 3) * 9) : r < 0.14 ? 162 + whole(pseudo(offset, 3) * 27) : 92 + whole(pseudo(offset, 3) * 48);
  rows.push({
    ...base,
    id: `demo-glu-d${offset}-am`,
    type: 'glucose',
    recordedAt: at(day, morningTime),
    glucoseValue: fasting,
    glucoseUnit: 'mg/dL',
    mealContext: 'fasting',
    minutesSinceMealStart: null,
    symptoms: fasting < 70 ? ['sweating', 'shaking'] : fasting > 180 ? ['headache'] : [],
  });
  const highBp = pseudo(offset, 4) < 0.08;
  const systolic = highBp ? 152 + whole(pseudo(offset, 5) * 21) : 116 + whole(pseudo(offset, 5) * 28);
  const diastolic = highBp ? 92 + whole(pseudo(offset, 6) * 11) : 72 + whole(pseudo(offset, 6) * 16);
  rows.push({
    ...base,
    id: `demo-bp-d${offset}-am`,
    type: 'bp',
    recordedAt: at(day, `07:${String(20 + (offset % 4) * 3).padStart(2, '0')}`),
    systolic,
    diastolic,
    pulse: 66 + whole(pseudo(offset, 7) * 20),
  });
  if (pseudo(offset, 8) >= 0.25) {
    const eveningTime = `18:${String(30 + (offset % 4) * 7).padStart(2, '0')}`;
    if (offset % 10 === 0) {
      const mg = 120 + whole(pseudo(offset, 9) * 56);
      rows.push({
        ...base,
        id: `demo-glu-d${offset}-pm`,
        type: 'glucose',
        recordedAt: at(day, eveningTime),
        glucoseValue: Math.round((mg / 18.0182) * 10) / 10,
        glucoseUnit: 'mmol/L',
        mealContext: 'random',
        minutesSinceMealStart: null,
      });
    } else {
      const evening = pseudo(offset, 9) < 0.06 ? 205 + whole(pseudo(offset, 10) * 34) : 128 + whole(pseudo(offset, 10) * 51);
      rows.push({
        ...base,
        id: `demo-glu-d${offset}-pm`,
        type: 'glucose',
        recordedAt: at(day, eveningTime),
        glucoseValue: evening,
        glucoseUnit: 'mg/dL',
        mealContext: 'postmeal',
        minutesSinceMealStart: 60 + whole(pseudo(offset, 11) * 60),
        symptoms: evening > 220 ? ['headache'] : [],
      });
    }
  }
  return rows;
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
  // Anchor rows for today and the last 3 days (kept stable for tests and
  // for the first-run demo), then generated rows back to 90 days total.
  const generated: Reading[] = [];
  for (let offset = 4; offset <= 89; offset += 1) {
    const day = shiftDateKey(today, -offset);
    if (day) generated.push(...generatedDayRows(day, offset, stamp, note));
  }
  return [
    ...generated,
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
  return { ...emptyStore(now), readings: buildDemoReadings(now), medications: buildDemoMedications(now) };
}
