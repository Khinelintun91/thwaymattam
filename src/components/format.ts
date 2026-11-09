import { SAMPLE_NOTE } from '../domain/demo.ts';
import { MEAL_LABEL, MONTHS_MY } from '../domain/labels.ts';
import { evaluateReading, badgeFor, badgeLabel, type SafetyNotice } from '../domain/safety.ts';
import { formatLongDate, formatTime12, relativeDayLabel } from '../domain/time.ts';
import type { Reading } from '../domain/types.ts';
import { formatGlucose } from '../domain/units.ts';

export function readingValue(reading: Reading): string {
  if (reading.type === 'glucose') {
    return `${formatGlucose(reading.glucoseValue, reading.glucoseUnit)} ${reading.glucoseUnit}`;
  }
  const pulse = reading.pulse == null ? '' : ` · ${reading.pulse}`;
  return `${reading.systolic}/${reading.diastolic}${pulse} mmHg`;
}

export function readingContext(reading: Reading): string {
  if (reading.type === 'bp') return 'သွေးပေါင်';
  const minutes = reading.minutesSinceMealStart == null ? '' : ` · ${reading.minutesSinceMealStart} မိနစ်`;
  return `${MEAL_LABEL[reading.mealContext]}${minutes}`;
}

export function whenLabel(reading: Reading, now = new Date()): string {
  const date = new Date(reading.recordedAt);
  const relative = relativeDayLabel(date, now);
  const day = relative ?? formatLongDate(date);
  return `${day} · ${formatTime12(date)}`;
}

export function noticesFor(reading: Reading, all: Reading[]): SafetyNotice[] {
  return evaluateReading(reading, all);
}

export function badgeText(reading: Reading, all: Reading[]): string | null {
  return badgeLabel(badgeFor(noticesFor(reading, all)));
}

/**
 * Notes for display in history rows. The demo sample note repeats on every
 * demo row, so it is stripped (the demo chip at the top already says it);
 * any other note text is kept.
 */
export function displayNotes(reading: Reading): string {
  return reading.notes.replace(SAMPLE_NOTE, '').replace(/\s+/g, ' ').trim();
}

export function dayHeading(date: string, now = new Date()): string {
  const [year, month, day] = date.split('-').map(Number);
  const label = `${day ?? ''} ${MONTHS_MY[(month ?? 1) - 1] ?? ''} ${year ?? ''}`;
  const relative = relativeDayLabel(new Date(`${date}T12:00:00+06:30`), now);
  return relative ? `${relative} · ${label}` : label;
}
