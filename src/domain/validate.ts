import type {
  BpReading,
  GlucoseReading,
  GlucoseUnit,
  MealContext,
  Reading,
  ReadingSource,
  StoreData,
  Symptom,
} from './types.ts';
import { isGlucoseUnit, isMealContext, isSymptom, STORE_VERSION } from './types.ts';

export interface ValidateIssue {
  path: string;
  code: string;
}

export type ValidateResult<T> = { ok: true; value: T } | { ok: false; errors: ValidateIssue[] };

export interface ValidateOptions {
  now?: Date;
  maxFutureMs?: number;
}

const EARLIEST = Date.parse('1990-01-01T00:00:00Z');

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function issueMessage(code: string): string {
  switch (code) {
    case 'required':
      return 'ဤအကွက်ကို ဖြည့်ပါ';
    case 'unit':
      return 'ယူနစ်ရွေးပါ';
    case 'out-of-range':
      return 'တန်ဖိုးသည် ဖြစ်နိုင်သော အပိုင်းအခြားထဲတွင် မရှိပါ';
    case 'order':
      return 'အပေါ်သွေးပေါင်သည် အောက်သွေးပေါင်ထက် ကြီးရမည်';
    case 'date':
      return 'နေ့ရက်နှင့် အချိန်ကို စစ်ပါ';
    case 'future':
      return 'အနာဂတ်အချိန်ကို သိမ်း၍မရပါ';
    case 'symptom':
      return 'လက္ခဏာမမှန်ပါ';
    case 'too-long':
      return 'မှတ်ချက် ရှည်လွန်းသည်';
    case 'minutes':
      return 'မိနစ်သည် ၀ မှ ၇၂၀ အတွင်း ကိန်းပြည့်ဖြစ်ရမည်';
    case 'minutes-context':
      return 'အစာစားပြီးချိန်တွင်သာ မိနစ်ဖြည့်ပါ';
    case 'decimal':
      return 'mg/dL ကို ကိန်းပြည့်ဖြင့် မှတ်ပါ။ mmol/L ကို ဒသမတစ်လုံးအထိ မှတ်ပါ';
    case 'integer':
      return 'ကိန်းပြည့်ဖြစ်ရမည်';
    default:
      return 'မမှန်သော အချက်အလက်';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function nearlyInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

function atMostOneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-6;
}

function readSymptoms(value: unknown, errors: ValidateIssue[]): Symptom[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ path: 'symptoms', code: 'symptom' });
    return null;
  }
  const symptoms: Symptom[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isSymptom(item)) {
      errors.push({ path: 'symptoms', code: 'symptom' });
      return null;
    }
    if (!symptoms.includes(item)) symptoms.push(item);
  }
  return symptoms;
}

function readNotes(value: unknown, errors: ValidateIssue[]): string | null {
  if (value == null) return '';
  if (typeof value !== 'string') {
    errors.push({ path: 'notes', code: 'invalid' });
    return null;
  }
  const notes = value.trim();
  if (notes.length > 2000) {
    errors.push({ path: 'notes', code: 'too-long' });
    return null;
  }
  return notes;
}

function readSource(value: unknown, errors: ValidateIssue[]): ReadingSource | null {
  if (value == null || value === 'manual') return 'manual';
  if (value === 'ocr') return 'ocr';
  errors.push({ path: 'source', code: 'invalid' });
  return null;
}

function readId(value: unknown, errors: ValidateIssue[]): string | null {
  if (value == null || value === '') return createId();
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(value)) {
    errors.push({ path: 'id', code: 'invalid' });
    return null;
  }
  return value;
}

function readTimestamp(value: unknown, field: string, errors: ValidateIssue[], fallback: string): string | null {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    errors.push({ path: field, code: 'date' });
    return null;
  }
  return value;
}

export function validateReading(input: unknown, options: ValidateOptions = {}): ValidateResult<Reading> {
  const errors: ValidateIssue[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ path: '', code: 'invalid' }] };
  const now = options.now ?? new Date();
  const maxFuture = options.maxFutureMs ?? 24 * 60 * 60 * 1000;
  const stamp = now.toISOString();

  const id = readId(input.id, errors);
  const notes = readNotes(input.notes, errors);
  const symptoms = readSymptoms(input.symptoms, errors);
  const source = readSource(input.source, errors);
  const createdAt = readTimestamp(input.createdAt, 'createdAt', errors, stamp);
  const updatedAt = readTimestamp(input.updatedAt, 'updatedAt', errors, stamp);
  const recordedAt = typeof input.recordedAt === 'string' ? input.recordedAt : '';
  if (!isIsoDate(recordedAt)) errors.push({ path: 'recordedAt', code: 'date' });
  else {
    const when = Date.parse(recordedAt);
    if (when < EARLIEST) errors.push({ path: 'recordedAt', code: 'date' });
    if (when > now.getTime() + maxFuture) errors.push({ path: 'recordedAt', code: 'future' });
  }

  if (input.type === 'glucose') {
    const glucose = readGlucose(input, errors);
    if (errors.length || !id || notes == null || !symptoms || !source || !createdAt || !updatedAt || !glucose) {
      return { ok: false, errors };
    }
    const reading: GlucoseReading = {
      id,
      type: 'glucose',
      recordedAt,
      glucoseValue: glucose.glucoseValue,
      glucoseUnit: glucose.glucoseUnit,
      mealContext: glucose.mealContext,
      minutesSinceMealStart: glucose.minutesSinceMealStart,
      symptoms,
      notes,
      source,
      createdAt,
      updatedAt,
    };
    return { ok: true, value: reading };
  }

  if (input.type === 'bp') {
    const bp = readBp(input, errors);
    if (errors.length || !id || notes == null || !symptoms || !source || !createdAt || !updatedAt || !bp) {
      return { ok: false, errors };
    }
    const reading: BpReading = {
      id,
      type: 'bp',
      recordedAt,
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      pulse: bp.pulse,
      symptoms,
      notes,
      source,
      createdAt,
      updatedAt,
    };
    return { ok: true, value: reading };
  }

  errors.push({ path: 'type', code: 'invalid' });
  return { ok: false, errors };
}

function readGlucose(
  input: Record<string, unknown>,
  errors: ValidateIssue[],
): Pick<GlucoseReading, 'glucoseValue' | 'glucoseUnit' | 'mealContext' | 'minutesSinceMealStart'> | null {
  const unit = input.glucoseUnit;
  if (!isGlucoseUnit(typeof unit === 'string' ? unit : '')) errors.push({ path: 'glucoseUnit', code: 'unit' });
  const meal = input.mealContext;
  if (!isMealContext(typeof meal === 'string' ? meal : '')) errors.push({ path: 'mealContext', code: 'context' });
  const value = typeof input.glucoseValue === 'number' ? input.glucoseValue : Number.NaN;
  if (!Number.isFinite(value)) errors.push({ path: 'glucoseValue', code: 'required' });
  else if (unit === 'mg/dL') {
    if (!nearlyInteger(value)) errors.push({ path: 'glucoseValue', code: 'decimal' });
    else if (value < 10 || value > 900) errors.push({ path: 'glucoseValue', code: 'out-of-range' });
  } else if (unit === 'mmol/L') {
    if (!atMostOneDecimal(value)) errors.push({ path: 'glucoseValue', code: 'decimal' });
    else if (value < 0.5 || value > 50) errors.push({ path: 'glucoseValue', code: 'out-of-range' });
  }

  let minutes: number | null = null;
  if (input.minutesSinceMealStart == null || input.minutesSinceMealStart === '') minutes = null;
  else if (typeof input.minutesSinceMealStart !== 'number' || !nearlyInteger(input.minutesSinceMealStart)) {
    errors.push({ path: 'minutesSinceMealStart', code: 'minutes' });
  } else minutes = Math.round(input.minutesSinceMealStart);

  if (meal !== 'postmeal' && minutes != null) errors.push({ path: 'minutesSinceMealStart', code: 'minutes-context' });
  if (minutes != null && (minutes < 0 || minutes > 720)) errors.push({ path: 'minutesSinceMealStart', code: 'minutes' });

  if (errors.some((issue) => issue.path.startsWith('glucose') || issue.path === 'mealContext' || issue.path.startsWith('minutes'))) {
    return null;
  }
  return {
    glucoseValue: value,
    glucoseUnit: unit as GlucoseUnit,
    mealContext: meal as MealContext,
    minutesSinceMealStart: minutes,
  };
}

function readBp(
  input: Record<string, unknown>,
  errors: ValidateIssue[],
): Pick<BpReading, 'systolic' | 'diastolic' | 'pulse'> | null {
  const systolic = typeof input.systolic === 'number' ? input.systolic : Number.NaN;
  const diastolic = typeof input.diastolic === 'number' ? input.diastolic : Number.NaN;
  if (!Number.isFinite(systolic)) errors.push({ path: 'systolic', code: 'required' });
  else if (!nearlyInteger(systolic)) errors.push({ path: 'systolic', code: 'integer' });
  else if (systolic < 60 || systolic > 260) errors.push({ path: 'systolic', code: 'out-of-range' });
  if (!Number.isFinite(diastolic)) errors.push({ path: 'diastolic', code: 'required' });
  else if (!nearlyInteger(diastolic)) errors.push({ path: 'diastolic', code: 'integer' });
  else if (diastolic < 30 || diastolic > 180) errors.push({ path: 'diastolic', code: 'out-of-range' });
  if (Number.isFinite(systolic) && Number.isFinite(diastolic) && systolic <= diastolic) {
    errors.push({ path: 'systolic', code: 'order' });
  }
  let pulse: number | null = null;
  if (input.pulse == null || input.pulse === '') pulse = null;
  else if (typeof input.pulse !== 'number' || !nearlyInteger(input.pulse)) errors.push({ path: 'pulse', code: 'integer' });
  else if (input.pulse < 25 || input.pulse > 240) errors.push({ path: 'pulse', code: 'out-of-range' });
  else pulse = Math.round(input.pulse);
  if (errors.some((issue) => issue.path === 'systolic' || issue.path === 'diastolic' || issue.path === 'pulse')) {
    return null;
  }
  return { systolic: Math.round(systolic), diastolic: Math.round(diastolic), pulse };
}

export function validateStore(input: unknown, options: ValidateOptions = {}): ValidateResult<StoreData> {
  if (!isRecord(input)) return { ok: false, errors: [{ path: '', code: 'invalid' }] };
  if (input.version !== STORE_VERSION) return { ok: false, errors: [{ path: 'version', code: 'invalid' }] };
  if (typeof input.revision !== 'number' || !nearlyInteger(input.revision) || input.revision < 0) {
    return { ok: false, errors: [{ path: 'revision', code: 'invalid' }] };
  }
  if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) {
    return { ok: false, errors: [{ path: 'updatedAt', code: 'date' }] };
  }
  if (!Array.isArray(input.readings)) return { ok: false, errors: [{ path: 'readings', code: 'invalid' }] };
  const readings: Reading[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < input.readings.length; index += 1) {
    const parsed = validateReading(input.readings[index], options);
    if (!parsed.ok) return { ok: false, errors: parsed.errors.map((issue) => ({ ...issue, path: `readings[${index}].${issue.path}` })) };
    if (ids.has(parsed.value.id)) return { ok: false, errors: [{ path: `readings[${index}].id`, code: 'duplicate' }] };
    ids.add(parsed.value.id);
    readings.push(parsed.value);
  }
  return {
    ok: true,
    value: {
      version: 1,
      revision: input.revision,
      updatedAt: input.updatedAt,
      readings,
    },
  };
}

export function emptyStore(now = new Date()): StoreData {
  return { version: 1, revision: 0, updatedAt: now.toISOString(), readings: [] };
}
