export const APP_ID = 'thwaymattam';
export const STORE_VERSION = 1;
export const TIMEZONE = 'Asia/Rangoon';
export const OFFSET_LABEL = 'UTC+6:30';

export const STORAGE_KEY = 'thwaymattam.store.v1';
export const DEMO_STORAGE_KEY = 'thwaymattam.demo.v1';
export const PREF_KEY = 'thwaymattam.pref.v1';
export const ACK_KEY = 'thwaymattam.ack.v1';
export const DRAFT_KEY = 'thwaymattam.draft.v1';

export const SYMPTOMS = [
  'chest_pain',
  'dyspnea',
  'stroke_signs',
  'vomiting',
  'deep_breathing',
  'confusion',
  'sweating',
  'shaking',
  'dizziness',
  'headache',
  'weakness',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

export const EMERGENCY_SYMPTOMS = ['chest_pain', 'dyspnea', 'stroke_signs'] as const;
export type EmergencySymptom = (typeof EMERGENCY_SYMPTOMS)[number];

export const HIGH_GLUCOSE_URGENT_SYMPTOMS = ['vomiting', 'deep_breathing', 'confusion'] as const;

export const MEAL_CONTEXTS = ['fasting', 'premeal', 'postmeal', 'random', 'unknown'] as const;
export type MealContext = (typeof MEAL_CONTEXTS)[number];

export const GLUCOSE_UNITS = ['mg/dL', 'mmol/L'] as const;
export type GlucoseUnit = (typeof GLUCOSE_UNITS)[number];

export const DAY_PARTS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export type ReadingSource = 'manual' | 'ocr';

interface ReadingBase {
  id: string;
  recordedAt: string;
  symptoms: Symptom[];
  notes: string;
  source: ReadingSource;
  createdAt: string;
  updatedAt: string;
}

export interface GlucoseReading extends ReadingBase {
  type: 'glucose';
  glucoseValue: number;
  glucoseUnit: GlucoseUnit;
  mealContext: MealContext;
  minutesSinceMealStart: number | null;
}

export interface BpReading extends ReadingBase {
  type: 'bp';
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

export type Reading = GlucoseReading | BpReading;

export interface StoreData {
  version: 1;
  revision: number;
  updatedAt: string;
  readings: Reading[];
}

export function isSymptom(value: string): value is Symptom {
  return (SYMPTOMS as readonly string[]).includes(value);
}

export function isMealContext(value: string): value is MealContext {
  return (MEAL_CONTEXTS as readonly string[]).includes(value);
}

export function isGlucoseUnit(value: string): value is GlucoseUnit {
  return (GLUCOSE_UNITS as readonly string[]).includes(value);
}

export function isEmergencySymptom(value: Symptom): value is EmergencySymptom {
  return (EMERGENCY_SYMPTOMS as readonly string[]).includes(value);
}
