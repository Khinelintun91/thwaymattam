import type { DayPart, GlucoseUnit, MealContext, Reading } from './types.ts';
import { dateKey, dayPart } from './time.ts';

export interface HistoryFilter {
  type: 'all' | 'glucose' | 'bp';
  context: 'all' | MealContext;
  unit: 'all' | GlucoseUnit;
  from: string;
  to: string;
}

export const EMPTY_FILTER: HistoryFilter = {
  type: 'all',
  context: 'all',
  unit: 'all',
  from: '',
  to: '',
};

export function filterReadings(readings: Reading[], filter: HistoryFilter): Reading[] {
  return readings.filter((reading) => {
    const key = dateKey(new Date(reading.recordedAt));
    if (filter.from && key < filter.from) return false;
    if (filter.to && key > filter.to) return false;
    if (filter.type !== 'all' && reading.type !== filter.type) return false;
    if (filter.context !== 'all') {
      if (reading.type !== 'glucose' || reading.mealContext !== filter.context) return false;
    }
    if (filter.unit !== 'all') {
      if (reading.type !== 'glucose' || reading.glucoseUnit !== filter.unit) return false;
    }
    return true;
  });
}

export interface DayGroup {
  date: string;
  items: Reading[];
}

export function groupByDay(readings: Reading[]): DayGroup[] {
  const sorted = [...readings].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id.localeCompare(a.id));
  const groups: DayGroup[] = [];
  for (const reading of sorted) {
    const date = dateKey(new Date(reading.recordedAt));
    const last = groups[groups.length - 1];
    if (!last || last.date !== date) groups.push({ date, items: [reading] });
    else last.items.push(reading);
  }
  return groups;
}

export interface DayPartGroup {
  part: DayPart;
  items: Reading[];
}

const DAY_PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

/**
 * A day's readings grouped by time of day, morning first, only non-empty
 * parts. Within a part the earliest reading comes first, so a day reads
 * top to bottom the way it happened.
 */
export function groupByDayPart(items: Reading[]): DayPartGroup[] {
  const byPart = new Map<DayPart, Reading[]>();
  for (const reading of [...items].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))) {
    const part = dayPart(new Date(reading.recordedAt));
    const list = byPart.get(part) ?? [];
    list.push(reading);
    byPart.set(part, list);
  }
  return DAY_PART_ORDER.filter((part) => byPart.has(part)).map((part) => ({ part, items: byPart.get(part) ?? [] }));
}

export function latestReading(readings: Reading[], type: Reading['type']): Reading | null {
  let best: Reading | null = null;
  let bestTime = -Infinity;
  for (const reading of readings) {
    if (reading.type !== type) continue;
    const time = Date.parse(reading.recordedAt);
    if (time >= bestTime) {
      best = reading;
      bestTime = time;
    }
  }
  return best;
}
