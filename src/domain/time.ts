import { DAYPART_LABEL, MONTHS_MY } from './labels.ts';
import { TIMEZONE, type DayPart } from './types.ts';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone = TIMEZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatYmd(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function dateKey(date: Date, timeZone = TIMEZONE): string {
  return formatYmd(zonedParts(date, timeZone));
}

export function dayPart(date: Date, timeZone = TIMEZONE): DayPart {
  const hour = zonedParts(date, timeZone).hour;
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 16) return 'afternoon';
  if (hour >= 17 && hour <= 20) return 'evening';
  return 'night';
}

export function dayPartLabel(date: Date, timeZone = TIMEZONE): string {
  return DAYPART_LABEL[dayPart(date, timeZone)];
}

/** Wall-clock fields are always Myanmar time (Asia/Rangoon, UTC+6:30), not the browser zone. */
export function wallClockToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    month == null ||
    day == null ||
    hour == null ||
    minute == null ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  const iso = `${date}T${time}:00+06:30`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = zonedParts(parsed);
  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== hour ||
    parts.minute !== minute
  ) {
    return null;
  }
  return iso;
}

export function nowWallClock(now = new Date()): { date: string; time: string } {
  const parts = zonedParts(now);
  return {
    date: formatYmd(parts),
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  };
}

export function formatWallTime(date: Date): string {
  const parts = zonedParts(date);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatLongDate(date: Date): string {
  const parts = zonedParts(date);
  const month = MONTHS_MY[parts.month - 1] ?? '';
  return `${parts.day} ${month} ${parts.year}`;
}

export function shiftDateKey(date: string, days: number): string | null {
  const noon = wallClockToIso(date, '12:00');
  if (!noon) return null;
  return dateKey(new Date(new Date(noon).getTime() + days * 86_400_000));
}

export function rangoonOffsetMinutes(date: Date): number {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

export function relativeDayLabel(date: Date, now = new Date()): string | null {
  const key = dateKey(date);
  const today = dateKey(now);
  if (key === today) return 'ယနေ့';
  const yesterday = shiftDateKey(today, -1);
  if (yesterday && key === yesterday) return 'မနေ့';
  return null;
}
