import type { GlucoseUnit, MealContext, Reading } from './types.ts';
import { dateKey } from './time.ts';

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
