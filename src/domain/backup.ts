import { APP_ID, STORE_VERSION, TIMEZONE } from './types.ts';
import type { Reading } from './types.ts';
import { validateReading, type ValidateIssue, type ValidateOptions } from './validate.ts';

export interface BackupFile {
  app: typeof APP_ID;
  version: 1;
  timezone: typeof TIMEZONE;
  exportedAt: string;
  readings: Reading[];
}

export interface RejectedRow {
  index: number;
  errors: ValidateIssue[];
}

export type ImportReadResult =
  | { ok: true; readings: Reading[]; rejected: RejectedRow[] }
  | { ok: false; code: 'not-object' | 'wrong-app' | 'unsupported-version' | 'readings-missing' | 'too-many' };

export function buildBackup(readings: Reading[], now = new Date()): BackupFile {
  const sorted = [...readings].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id),
  );
  return {
    app: APP_ID,
    version: STORE_VERSION,
    timezone: TIMEZONE,
    exportedAt: now.toISOString(),
    readings: sorted,
  };
}

export function readingFingerprint(reading: Reading): string {
  const minute = Math.round(Date.parse(reading.recordedAt) / 60_000);
  if (reading.type === 'glucose') {
    return `g|${minute}|${reading.glucoseValue}|${reading.glucoseUnit}|${reading.mealContext}|${reading.minutesSinceMealStart ?? ''}`;
  }
  return `b|${minute}|${reading.systolic}|${reading.diastolic}|${reading.pulse ?? ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readImport(json: unknown, options: ValidateOptions & { maxReadings?: number } = {}): ImportReadResult {
  if (!isRecord(json)) return { ok: false, code: 'not-object' };
  if (json.app !== APP_ID) return { ok: false, code: 'wrong-app' };
  if (json.version !== STORE_VERSION) return { ok: false, code: 'unsupported-version' };
  if (!Array.isArray(json.readings)) return { ok: false, code: 'readings-missing' };
  if (json.readings.length > (options.maxReadings ?? 5000)) return { ok: false, code: 'too-many' };
  const readings: Reading[] = [];
  const rejected: RejectedRow[] = [];
  json.readings.forEach((row, index) => {
    const parsed = validateReading(row, { now: options.now, maxFutureMs: options.maxFutureMs ?? 48 * 60 * 60 * 1000 });
    if (!parsed.ok) rejected.push({ index, errors: parsed.errors });
    else readings.push(parsed.value);
  });
  return { ok: true, readings, rejected };
}

export interface DuplicateRow {
  reading: Reading;
  match: 'id' | 'fingerprint';
}

export interface ImportPlan {
  accepted: Reading[];
  updates: Reading[];
  duplicates: DuplicateRow[];
}

export function planImport(existing: Reading[], incoming: Reading[]): ImportPlan {
  const byId = new Map(existing.map((reading) => [reading.id, reading]));
  const originalIds = new Set(byId.keys());
  const fingerprintOwner = new Map(existing.map((reading) => [readingFingerprint(reading), reading.id]));
  const accepted: Reading[] = [];
  const updates = new Map<string, Reading>();
  const duplicates: DuplicateRow[] = [];

  for (const reading of incoming) {
    const current = byId.get(reading.id);
    if (current) {
      if (Date.parse(reading.updatedAt) > Date.parse(current.updatedAt)) {
        const previousFingerprint = readingFingerprint(current);
        if (fingerprintOwner.get(previousFingerprint) === reading.id) fingerprintOwner.delete(previousFingerprint);
        fingerprintOwner.set(readingFingerprint(reading), reading.id);
        byId.set(reading.id, reading);
        if (originalIds.has(reading.id)) updates.set(reading.id, reading);
        else {
          const index = accepted.findIndex((item) => item.id === reading.id);
          if (index >= 0) accepted[index] = reading;
        }
      } else {
        duplicates.push({ reading, match: 'id' });
      }
      continue;
    }
    const fingerprint = readingFingerprint(reading);
    const owner = fingerprintOwner.get(fingerprint);
    if (owner && owner !== reading.id) {
      duplicates.push({ reading, match: 'fingerprint' });
      continue;
    }
    fingerprintOwner.set(fingerprint, reading.id);
    byId.set(reading.id, reading);
    accepted.push(reading);
  }

  return { accepted, updates: [...updates.values()], duplicates };
}

export function applyMerge(existing: Reading[], plan: Pick<ImportPlan, 'accepted' | 'updates'>): Reading[] {
  const updates = new Map(plan.updates.map((reading) => [reading.id, reading]));
  const kept = existing.map((reading) => updates.get(reading.id) ?? reading);
  const present = new Set(kept.map((reading) => reading.id));
  const appended = [...plan.updates, ...plan.accepted].filter((reading) => !present.has(reading.id));
  return [...kept, ...appended];
}

export function applyImport(existing: Reading[], accepted: Reading[], mode: 'merge' | 'replace'): Reading[] {
  if (mode === 'replace') return [...accepted];
  return applyMerge(existing, { accepted, updates: [] });
}

export function importPreviewSummary(added: number, already: number, updated = 0): string {
  const parts = [`အသစ် ${added} ခု ထည့်မည်။`];
  if (updated > 0) parts.push(`နောက်ဆုံးပြင်ဆင်ချက် ${updated} ခု ကို ယူမည်။`);
  parts.push(`ရှိပြီးသား ${already} ခု ကို ထပ်မထည့်ပါ။`);
  return parts.join(' ');
}

export function importResultSummary(added: number, already: number, updated = 0): string {
  const parts = [`အသစ် ${added} ခု ထည့်ပြီးပါပြီ။`];
  if (updated > 0) parts.push(`နောက်ဆုံးပြင်ဆင်ချက် ${updated} ခု ကို ယူထားပါသည်။`);
  parts.push(`ရှိပြီးသား ${already} ခု ကို ထပ်မထည့်ပါ။`);
  return parts.join(' ');
}
