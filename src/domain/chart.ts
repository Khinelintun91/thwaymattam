import type { GlucoseUnit, MealContext, Reading } from './types.ts';
import { MEAL_CONTEXTS } from './types.ts';

export interface ChartPoint {
  t: number;
  y: number;
  id: string;
}

export interface GlucoseSeries {
  context: MealContext;
  points: ChartPoint[];
}

export function glucoseSeries(readings: Reading[], unit: GlucoseUnit): GlucoseSeries[] {
  const buckets = new Map<MealContext, ChartPoint[]>();
  for (const reading of readings) {
    if (reading.type !== 'glucose' || reading.glucoseUnit !== unit) continue;
    const points = buckets.get(reading.mealContext) ?? [];
    points.push({ t: Date.parse(reading.recordedAt), y: reading.glucoseValue, id: reading.id });
    buckets.set(reading.mealContext, points);
  }
  return MEAL_CONTEXTS.flatMap((context) => {
    const points = buckets.get(context);
    if (!points?.length) return [];
    points.sort((a, b) => a.t - b.t);
    return [{ context, points }];
  });
}

export function bpSeries(readings: Reading[]): { systolic: ChartPoint[]; diastolic: ChartPoint[]; pulse: ChartPoint[] } {
  const systolic: ChartPoint[] = [];
  const diastolic: ChartPoint[] = [];
  const pulse: ChartPoint[] = [];
  const rows = readings
    .filter((reading): reading is Extract<Reading, { type: 'bp' }> => reading.type === 'bp')
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  for (const reading of rows) {
    const t = Date.parse(reading.recordedAt);
    systolic.push({ t, y: reading.systolic, id: reading.id });
    diastolic.push({ t, y: reading.diastolic, id: reading.id });
    if (reading.pulse != null) pulse.push({ t, y: reading.pulse, id: reading.id });
  }
  return { systolic, diastolic, pulse };
}

/** Break the line when readings are far apart so the chart does not invent a trend. */
export function polylines<T extends { t: number }>(points: T[], gapMs: number): T[][] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const lines: T[][] = [];
  for (const point of sorted) {
    const last = lines[lines.length - 1];
    const previous = last?.[last.length - 1];
    if (!last || !previous || point.t - previous.t > gapMs) lines.push([point]);
    else last.push(point);
  }
  return lines;
}

export function yDomain(values: number[], guides: number[] = []): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-9) {
    const pad = Math.max(Math.abs(max) * 0.15, 8);
    min -= pad;
    max += pad;
  }
  const span = Math.max(max - min, 1);
  for (const guide of guides) {
    if (guide >= min - span * 0.35 && guide <= max + span * 0.35) {
      min = Math.min(min, guide);
      max = Math.max(max, guide);
    }
  }
  const pad = Math.max(max - min, 1) * 0.12;
  return { min: min - pad, max: max + pad };
}

export const CHART_GAP_MS = 36 * 60 * 60 * 1000;

/**
 * Display domain from values clamped to a cap, so one extreme spike does not
 * flatten the rest of the chart. Points above the cap are drawn at the cap
 * with a marker; their true value is shown as a label, never hidden.
 */
export function cappedDomain(values: number[], cap: number, guides: number[] = []): { min: number; max: number } {
  return yDomain(values.map((value) => Math.min(value, cap)), guides);
}
