import { filterReadings } from './history.ts';
import { isEmergencySymptom, type Reading, type Symptom } from './types.ts';
import { dateKey, shiftDateKey } from './time.ts';
import { convertGlucose } from './units.ts';

/**
 * The app's documented target ranges (see the safety thresholds):
 * fasting glucose 80–130 mg/dL, postmeal below 180 mg/dL, blood pressure
 * below 130/80. These are display references only — never a diagnosis.
 */
export const FASTING_TARGET = { min: 80, max: 130 };
export const POSTMEAL_TARGET_MAX = 180;
export const LOW_GLUCOSE_MGDL = 70;
export const BP_TARGET = { sys: 130, dia: 80 };

export interface GroupStats {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  aboveTarget: number;
}

export interface MonthSummary {
  from: string;
  to: string;
  daysLogged: number;
  glucoseCount: number;
  bpCount: number;
  fasting: GroupStats;
  postmeal: GroupStats;
  lowCount: number;
  bp: { count: number; avgSys: number | null; avgDia: number | null; avgPulse: number | null; maxSys: number | null; aboveTarget: number };
  emergencySymptomCount: number;
  emergencySymptoms: { code: Symptom; count: number }[];
}

function stats(values: number[], aboveTarget: (value: number) => boolean): GroupStats {
  if (values.length === 0) return { count: 0, avg: null, min: null, max: null, aboveTarget: 0 };
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    aboveTarget: values.filter(aboveTarget).length,
  };
}

function glucoseMgdl(reading: Extract<Reading, { type: 'glucose' }>): number {
  return Math.round(convertGlucose(reading.glucoseValue, reading.glucoseUnit, 'mg/dL'));
}

/** Plain-number summary of the readings in a date range, for charts and the doctor's monthly summary. */
export function summarizeReadings(readings: Reading[], from: string, to: string): MonthSummary {
  const rows = filterReadings(readings, { type: 'all', context: 'all', unit: 'all', from, to });
  const glucose = rows.filter((reading): reading is Extract<Reading, { type: 'glucose' }> => reading.type === 'glucose');
  const bp = rows.filter((reading): reading is Extract<Reading, { type: 'bp' }> => reading.type === 'bp');
  const fasting = glucose.filter((reading) => reading.mealContext === 'fasting').map(glucoseMgdl);
  const postmeal = glucose.filter((reading) => reading.mealContext === 'postmeal').map(glucoseMgdl);
  const allMgdl = glucose.map(glucoseMgdl);
  const sysValues = bp.map((reading) => reading.systolic);
  const diaValues = bp.map((reading) => reading.diastolic);
  const pulseValues = bp.map((reading) => reading.pulse).filter((pulse): pulse is number => pulse != null);
  const emergency = new Map<Symptom, number>();
  let emergencySymptomCount = 0;
  for (const reading of rows) {
    const found = reading.symptoms.filter(isEmergencySymptom);
    if (found.length > 0) emergencySymptomCount += 1;
    for (const symptom of found) emergency.set(symptom, (emergency.get(symptom) ?? 0) + 1);
  }
  return {
    from,
    to,
    daysLogged: new Set(rows.map((reading) => dateKey(new Date(reading.recordedAt)))).size,
    glucoseCount: glucose.length,
    bpCount: bp.length,
    fasting: stats(fasting, (value) => value > FASTING_TARGET.max),
    postmeal: stats(postmeal, (value) => value >= POSTMEAL_TARGET_MAX),
    lowCount: allMgdl.filter((value) => value < LOW_GLUCOSE_MGDL).length,
    bp: {
      count: bp.length,
      avgSys: sysValues.length ? Math.round(sysValues.reduce((a, b) => a + b, 0) / sysValues.length) : null,
      avgDia: diaValues.length ? Math.round(diaValues.reduce((a, b) => a + b, 0) / diaValues.length) : null,
      avgPulse: pulseValues.length ? Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length) : null,
      maxSys: sysValues.length ? Math.max(...sysValues) : null,
      aboveTarget: bp.filter((reading) => reading.systolic >= BP_TARGET.sys || reading.diastolic >= BP_TARGET.dia).length,
    },
    emergencySymptomCount,
    emergencySymptoms: [...emergency.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface WeekSummary {
  count: number;
  /** Share of the week's readings inside their own target, or null when there are none. */
  inRangePercent: number | null;
}

function readingInRange(reading: Reading): boolean {
  if (reading.type === 'glucose') {
    const mg = Math.round(convertGlucose(reading.glucoseValue, reading.glucoseUnit, 'mg/dL'));
    if (mg < LOW_GLUCOSE_MGDL) return false;
    if (reading.mealContext === 'fasting') return mg >= FASTING_TARGET.min && mg <= FASTING_TARGET.max;
    if (reading.mealContext === 'postmeal') return mg < POSTMEAL_TARGET_MAX;
    return mg <= 180;
  }
  return reading.systolic < BP_TARGET.sys && reading.diastolic < BP_TARGET.dia;
}

/** This week's readings (today + 6 days back) with the in-target share, for the Home summary strip. */
export function weekSummary(readings: Reading[], now = new Date()): WeekSummary {
  const to = dateKey(now);
  const from = shiftDateKey(to, -6) ?? to;
  const rows = filterReadings(readings, { type: 'all', context: 'all', unit: 'all', from, to });
  if (rows.length === 0) return { count: 0, inRangePercent: null };
  const inRange = rows.filter(readingInRange).length;
  return { count: rows.length, inRangePercent: Math.round((inRange / rows.length) * 100) };
}

export interface MonthOption {
  key: string;
  year: number;
  month: number;
  label: string;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(daysInMonth)}` };
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Months that have readings, newest first, labelled in Burmese. */
export function availableMonths(readings: Reading[], monthsMy: readonly string[]): MonthOption[] {
  const keys = new Set(readings.map((reading) => dateKey(new Date(reading.recordedAt)).slice(0, 7)));
  return [...keys]
    .sort()
    .reverse()
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      return { key, year: year ?? 0, month: month ?? 0, label: `${monthsMy[(month ?? 1) - 1] ?? ''} ${year ?? ''}` };
    });
}
