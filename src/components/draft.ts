import { nowWallClock } from '../domain/time.ts';
import type { GlucoseUnit, MealContext, Reading, Symptom } from '../domain/types.ts';
import { DRAFT_KEY } from '../domain/types.ts';
import { formatGlucose } from '../domain/units.ts';

export interface Draft {
  type: 'glucose' | 'bp';
  date: string;
  time: string;
  glucoseValue: string;
  glucoseUnit: GlucoseUnit | '';
  mealContext: MealContext;
  minutesSinceMealStart: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  symptoms: Symptom[];
  notes: string;
  source: 'manual' | 'ocr';
}

export function blankDraft(type: 'glucose' | 'bp', now = new Date()): Draft {
  const wall = nowWallClock(now);
  return {
    type,
    date: wall.date,
    time: wall.time,
    glucoseValue: '',
    glucoseUnit: 'mg/dL',
    mealContext: 'unknown',
    minutesSinceMealStart: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    symptoms: [],
    notes: '',
    source: 'manual',
  };
}

export function draftFromReading(reading: Reading): Draft {
  const wall = wallParts(reading.recordedAt);
  const base = blankDraft(reading.type, new Date(reading.recordedAt));
  return {
    ...base,
    date: wall.date,
    time: wall.time,
    symptoms: reading.symptoms,
    notes: reading.notes,
    source: reading.source,
    glucoseValue: reading.type === 'glucose' ? formatGlucose(reading.glucoseValue, reading.glucoseUnit) : '',
    glucoseUnit: reading.type === 'glucose' ? reading.glucoseUnit : '',
    mealContext: reading.type === 'glucose' ? reading.mealContext : 'unknown',
    minutesSinceMealStart: reading.type === 'glucose' && reading.minutesSinceMealStart != null ? String(reading.minutesSinceMealStart) : '',
    systolic: reading.type === 'bp' ? String(reading.systolic) : '',
    diastolic: reading.type === 'bp' ? String(reading.diastolic) : '',
    pulse: reading.type === 'bp' && reading.pulse != null ? String(reading.pulse) : '',
  };
}

function wallParts(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  const wall = nowWallClock(date);
  return wall;
}

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    if (parsed.type !== 'glucose' && parsed.type !== 'bp') return null;
    if (!parsed.date || !parsed.time) return null;
    return { ...blankDraft(parsed.type), ...parsed, symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [] };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* The text draft is optional. */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
