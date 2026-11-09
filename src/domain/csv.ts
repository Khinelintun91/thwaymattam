import { DAYPART_LABEL, MEAL_LABEL, SYMPTOM_LABEL } from './labels.ts';
import type { Reading } from './types.ts';
import { dateKey, dayPart, formatWallTime } from './time.ts';

const HEADERS = [
  'date_rangoon',
  'time_rangoon',
  'daypart',
  'type',
  'glucose_value',
  'glucose_unit',
  'meal_context',
  'minutes_since_meal_start',
  'systolic',
  'diastolic',
  'pulse',
  'symptoms',
  'notes',
  'source',
  'id',
] as const;

/** Prefix formula triggers so a spreadsheet does not execute cell text. */
export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const guarded = /^[\s]*[=+\-@]|^[\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(readings: Reading[]): string {
  const sorted = [...readings].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id),
  );
  const lines = [HEADERS.join(',')];
  for (const reading of sorted) {
    const when = new Date(reading.recordedAt);
    const symptoms = reading.symptoms.map((symptom) => SYMPTOM_LABEL[symptom]).join('၊ ');
    const cells =
      reading.type === 'glucose'
        ? [
            dateKey(when),
            formatWallTime(when),
            DAYPART_LABEL[dayPart(when)],
            'glucose',
            reading.glucoseValue,
            reading.glucoseUnit,
            MEAL_LABEL[reading.mealContext],
            reading.minutesSinceMealStart ?? '',
            '',
            '',
            '',
            symptoms,
            reading.notes,
            reading.source,
            reading.id,
          ]
        : [
            dateKey(when),
            formatWallTime(when),
            DAYPART_LABEL[dayPart(when)],
            'bp',
            '',
            '',
            '',
            '',
            reading.systolic,
            reading.diastolic,
            reading.pulse ?? '',
            symptoms,
            reading.notes,
            reading.source,
            reading.id,
          ];
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
