import { burmeseDigitsToAscii } from './numerals.ts';
import type { GlucoseUnit } from './types.ts';
import { inDiastolicOcr, inGlucoseOcrRange, inPulseOcr, inSystolicOcr } from './units.ts';

export interface OcrWordInput {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

export interface DiscardedItem {
  raw: string;
  reason: 'date' | 'time' | 'memory' | 'year' | 'out-of-range' | 'date-line';
}

export interface OcrAlternative {
  value: number;
  confidence: number | null;
}

export interface FieldSuggestion {
  value: number;
  confidence: number | null;
  uncertain: boolean;
  source: 'label' | 'single' | 'prominence' | 'pair' | 'layout';
}

export type ParseNote =
  | 'discarded-non-reading'
  | 'labeled-bp'
  | 'unlabeled-bp'
  | 'ambiguous'
  | 'unit-missing'
  | 'unit-explicit'
  | 'unit-conflict'
  | 'low-confidence'
  | 'no-candidate'
  | 'empty'
  | 'label-conflict'
  | 'prominence'
  | 'single';

export type ParseFailure = 'empty' | 'no-candidate' | 'ambiguous' | 'low-confidence' | null;

export interface MeterParseResult {
  intent: 'glucose' | 'bp';
  rawText: string;
  glucose: FieldSuggestion | null;
  glucoseUnit: GlucoseUnit | null;
  unitExplicit: boolean;
  systolic: FieldSuggestion | null;
  diastolic: FieldSuggestion | null;
  pulse: FieldSuggestion | null;
  discarded: DiscardedItem[];
  alternatives: OcrAlternative[];
  ambiguous: boolean;
  requiresManualConfirmation: true;
  failure: ParseFailure;
  notes: ParseNote[];
}

export function parseMeterOcr(input: {
  text: string;
  intent: 'glucose' | 'bp';
  words?: OcrWordInput[];
}): MeterParseResult {
  const rawText = input.text?.trim()
    ? input.text
    : (input.words ?? []).map((word) => word.text).join(' ');
  const base = emptyResult(input.intent, rawText);
  if (!rawText.trim()) {
    base.failure = 'empty';
    base.notes = ['empty'];
    return base;
  }

  const normalized = normalizeMeterText(rawText, input.intent);
  const stripped = stripIgnored(normalized);
  base.discarded = stripped.discarded;
  if (stripped.discarded.length > 0) base.notes.push('discarded-non-reading');

  if (input.intent === 'bp') fillBp(base, stripped.text, input.words);
  else fillGlucose(base, normalized, stripped.text, input.words);

  base.notes = [...new Set(base.notes)];
  return base;
}

function emptyResult(intent: 'glucose' | 'bp', rawText: string): MeterParseResult {
  return {
    intent,
    rawText,
    glucose: null,
    glucoseUnit: null,
    unitExplicit: false,
    systolic: null,
    diastolic: null,
    pulse: null,
    discarded: [],
    alternatives: [],
    ambiguous: false,
    requiresManualConfirmation: true,
    failure: null,
    notes: [],
  };
}

export function normalizeMeterText(raw: string, intent: 'glucose' | 'bp'): string {
  let text = raw.normalize('NFKC').replace(/\u00a0/g, ' ');
  text = burmeseDigitsToAscii(text);
  text = text
    .split(/(\s+)/)
    .map((token) => fixOcrDigitToken(token))
    .join('');
  if (intent === 'glucose') text = text.replace(/\b(\d{1,2}),(\d)\b/g, '$1.$2');
  return text;
}

function fixOcrDigitToken(token: string): string {
  if (!/^[0-9OoIl|.,:/-]+$/.test(token) || !/[OoIl|]/.test(token)) return token;
  return token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
}

function lineHasYearDate(line: string): boolean {
  if (/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(line)) return true;
  if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(line)) return true;
  const nums = (line.match(/\d+/g) ?? []).map(Number);
  if (nums.length !== 3) return false;
  const yearIndex = nums.findIndex((value) => value >= 1990 && value <= 2099);
  if (yearIndex < 0) return false;
  return nums.every((value, index) => index === yearIndex || (value >= 1 && value <= 31));
}

function stripIgnored(src: string): { text: string; discarded: DiscardedItem[] } {
  const discarded: DiscardedItem[] = [];
  const kept: string[] = [];
  for (const line of src.split(/\n/)) {
    if (line.trim() && lineHasYearDate(line)) {
      discarded.push({ raw: line.trim(), reason: 'date-line' });
      continue;
    }
    kept.push(line);
  }
  let text = kept.join('\n');
  const take = (re: RegExp, reason: DiscardedItem['reason']) => {
    text = text.replace(re, (match) => {
      discarded.push({ raw: match.trim(), reason });
      return ' ';
    });
  };
  take(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, 'date');
  take(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, 'date');
  take(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?\b/gi, 'time');
  take(/\b(?:mem(?:ory)?|slot|no\.?)\s*[:.]?\s*\d{1,4}\b/gi, 'memory');
  take(/\bM\d{2,3}\b/g, 'memory');
  take(/(?:^|\s)#\s*\d{1,4}\b/g, 'memory');
  take(/\b(?:19|20)\d{2}\b/g, 'year');
  text = text.replace(/\b(\d{1,2})[-/](\d{1,2})\b/g, (match, left: string, right: string) => {
    const a = Number(left);
    const b = Number(right);
    if (a <= 31 && b <= 31) {
      discarded.push({ raw: match, reason: 'date' });
      return ' ';
    }
    return match;
  });
  return { text, discarded };
}

function numbersIn(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) values.push(Number(match[0]));
  return values;
}

type LabelName = 'sys' | 'dia' | 'pul';

function labelName(word: string): LabelName | null {
  const value = word.toLowerCase();
  if (value === 'sys' || value === 'systolic') return 'sys';
  if (value === 'dia' || value === 'dias' || value === 'diastolic') return 'dia';
  if (value === 'pul' || value === 'pulse' || value === 'hr' || value === 'bpm') return 'pul';
  return null;
}

function takeLabels(text: string): { text: string; labels: Record<LabelName, number[]> } {
  const labels: Record<LabelName, number[]> = { sys: [], dia: [], pul: [] };
  const pattern =
    /\b(systolic|sys|diastolic|dias|dia|pulse|pul|bpm|hr)\b[ \t:.#-]{0,8}(\d{2,3}(?:\.\d+)?)|(\d{2,3}(?:\.\d+)?)[ \t:.#-]{0,6}\b(systolic|sys|diastolic|dias|dia|pulse|pul|bpm|hr)\b/gi;
  const next = text
    .split('\n')
    .map((line) =>
      line.replace(pattern, (_full, lab1: string, num1: string, num2: string, lab2: string) => {
        const name = labelName(lab1 || lab2);
        const num = Number(num1 || num2);
        if (name && Number.isFinite(num)) labels[name].push(num);
        return ' ';
      }),
    )
    .join('\n');
  return { text: next, labels };
}

function uniqueLabel(values: number[]): number | null | 'conflict' {
  const unique = [...new Set(values.map((value) => Number(value.toFixed(3))))];
  if (unique.length === 0) return null;
  if (unique.length > 1) return 'conflict';
  return unique[0] ?? null;
}

function takeSlash(text: string): {
  text: string;
  pair: { sys: number; dia: number } | null;
  conflict: boolean;
} {
  let pair: { sys: number; dia: number } | null = null;
  let conflict = false;
  const next = text.replace(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/g, (match, left: string, right: string) => {
    const sys = Number(left);
    const dia = Number(right);
    if (!(inSystolicOcr(sys) && inDiastolicOcr(dia) && sys > dia)) return match;
    if (pair && (pair.sys !== sys || pair.dia !== dia)) conflict = true;
    pair = { sys, dia };
    return ' ';
  });
  return { text: next, pair: conflict ? null : pair, conflict };
}

function confidenceFor(value: number, words?: OcrWordInput[]): number | null {
  if (!words?.length) return null;
  const hits = words.filter((word) => {
    const parsed = wordNumber(word.text);
    return parsed != null && Math.abs(parsed - value) < 0.05;
  });
  if (hits.length === 0) return null;
  return Math.max(...hits.map((word) => word.confidence));
}

function heightFor(value: number, words?: OcrWordInput[]): number | null {
  if (!words?.length) return null;
  const heights = words.flatMap((word) => {
    const parsed = wordNumber(word.text);
    if (parsed == null || Math.abs(parsed - value) >= 0.05 || !word.bbox) return [];
    return [word.bbox.y1 - word.bbox.y0];
  });
  if (heights.length === 0) return null;
  return Math.max(...heights);
}

function wordNumber(text: string): number | null {
  const normalized = normalizeMeterText(text, 'glucose').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

type ConfidenceLevel = 'ok' | 'soft' | 'reject';

function confidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence == null) return 'ok';
  if (confidence < 45) return 'reject';
  if (confidence < 70) return 'soft';
  return 'ok';
}

function suggest(
  value: number,
  source: FieldSuggestion['source'],
  words: OcrWordInput[] | undefined,
  forceUncertain: boolean,
): { field: FieldSuggestion | null; alternative: OcrAlternative | null; low: boolean } {
  const confidence = confidenceFor(value, words);
  const level = confidenceLevel(confidence);
  if (level === 'reject') {
    return {
      field: null,
      alternative: { value, confidence },
      low: true,
    };
  }
  return {
    field: {
      value,
      confidence,
      uncertain: forceUncertain || level === 'soft',
      source,
    },
    alternative: null,
    low: false,
  };
}

function fillBp(result: MeterParseResult, text: string, words?: OcrWordInput[]): void {
  const labeled = takeLabels(text);
  const slashed = takeSlash(labeled.text);
  const leftovers = numbersIn(slashed.text);
  for (const value of leftovers) {
    if (!inSystolicOcr(value) && !inDiastolicOcr(value) && !inPulseOcr(value)) {
      result.discarded.push({ raw: String(value), reason: 'out-of-range' });
    }
  }
  const outOfRange = (kind: LabelName, value: number) => {
    if (kind === 'sys') return !inSystolicOcr(value);
    if (kind === 'dia') return !inDiastolicOcr(value);
    return !inPulseOcr(value);
  };
  (['sys', 'dia', 'pul'] as const).forEach((kind) => {
    for (const value of labeled.labels[kind]) {
      if (outOfRange(kind, value)) result.discarded.push({ raw: String(value), reason: 'out-of-range' });
    }
  });

  const sys = uniqueLabel(labeled.labels.sys.filter((value) => inSystolicOcr(value)));
  const dia = uniqueLabel(labeled.labels.dia.filter((value) => inDiastolicOcr(value)));
  const pul = uniqueLabel(labeled.labels.pul.filter((value) => inPulseOcr(value)));
  const labelConflict = sys === 'conflict' || dia === 'conflict' || pul === 'conflict' || slashed.conflict;

  const pushAlternatives = (values: number[]) => {
    for (const value of values) {
      if (!result.alternatives.some((item) => item.value === value)) {
        result.alternatives.push({ value, confidence: confidenceFor(value, words) });
      }
    }
  };

  if (labelConflict) {
    result.ambiguous = true;
    result.failure = 'ambiguous';
    result.notes.push('label-conflict', 'ambiguous');
    pushAlternatives(
      [...labeled.labels.sys, ...labeled.labels.dia, ...labeled.labels.pul, ...leftovers].filter(
        (value) => inSystolicOcr(value) || inDiastolicOcr(value) || inPulseOcr(value),
      ),
    );
    if (slashed.pair) pushAlternatives([slashed.pair.sys, slashed.pair.dia]);
    return;
  }

  if (typeof sys === 'number' && typeof dia === 'number') {
    if (sys <= dia || (slashed.pair && (slashed.pair.sys !== sys || slashed.pair.dia !== dia))) {
      result.ambiguous = true;
      result.failure = 'ambiguous';
      result.notes.push('label-conflict', 'ambiguous');
      pushAlternatives([sys, dia, ...(slashed.pair ? [slashed.pair.sys, slashed.pair.dia] : [])]);
      return;
    }
    applyBpFields(result, sys, dia, typeof pul === 'number' ? pul : null, 'label', false, words, leftovers);
    result.notes.push('labeled-bp');
    return;
  }

  if (slashed.pair) {
    const pulse = typeof pul === 'number' ? pul : singlePulse(leftovers, slashed.pair.sys, slashed.pair.dia);
    applyBpFields(result, slashed.pair.sys, slashed.pair.dia, pulse, 'pair', true, words, leftovers);
    result.notes.push('unlabeled-bp');
    return;
  }

  const usable = leftovers.filter((value) => inSystolicOcr(value) || inDiastolicOcr(value) || inPulseOcr(value));
  if (usable.length === 3) {
    const [a, b, c] = usable as [number, number, number];
    if (inSystolicOcr(a) && inDiastolicOcr(b) && a > b && inPulseOcr(c)) {
      applyBpFields(result, a, b, c, 'layout', true, words, []);
      result.notes.push('unlabeled-bp');
      return;
    }
  }
  if (usable.length === 2) {
    const [a, b] = usable as [number, number];
    if (inSystolicOcr(a) && inDiastolicOcr(b) && a > b) {
      applyBpFields(result, a, b, null, 'layout', true, words, []);
      result.notes.push('unlabeled-bp');
      return;
    }
  }

  pushAlternatives(usable);
  result.ambiguous = usable.length > 0;
  result.failure = usable.length > 0 ? 'ambiguous' : 'no-candidate';
  result.notes.push(result.failure === 'ambiguous' ? 'ambiguous' : 'no-candidate');
}

function singlePulse(values: number[], sys: number, dia: number): number | null {
  const pulses = values.filter((value) => inPulseOcr(value) && value !== sys && value !== dia);
  return pulses.length === 1 ? (pulses[0] ?? null) : null;
}

function applyBpFields(
  result: MeterParseResult,
  sys: number,
  dia: number,
  pulse: number | null,
  source: FieldSuggestion['source'],
  forceUncertain: boolean,
  words: OcrWordInput[] | undefined,
  leftovers: number[],
): void {
  let low = false;
  const sysField = suggest(sys, source, words, forceUncertain);
  const diaField = suggest(dia, source, words, forceUncertain);
  const pulField = pulse == null ? null : suggest(pulse, source, words, forceUncertain);
  if (sysField.low || diaField.low) low = true;
  result.systolic = sysField.field;
  result.diastolic = diaField.field;
  result.pulse = pulField?.field ?? null;
  for (const piece of [sysField, diaField, pulField]) {
    if (piece?.alternative) result.alternatives.push(piece.alternative);
    if (piece?.low) low = true;
  }
  const extras = leftovers.filter(
    (value) =>
      (inSystolicOcr(value) || inDiastolicOcr(value) || inPulseOcr(value)) &&
      value !== sys &&
      value !== dia &&
      value !== pulse,
  );
  if (extras.length > 0 && result.systolic && result.diastolic) {
    result.systolic = { ...result.systolic, uncertain: true };
    result.diastolic = { ...result.diastolic, uncertain: true };
    if (result.pulse) result.pulse = { ...result.pulse, uncertain: true };
    for (const value of extras) result.alternatives.push({ value, confidence: confidenceFor(value, words) });
  }
  if (!result.systolic || !result.diastolic) {
    result.systolic = null;
    result.diastolic = null;
    result.pulse = null;
    result.failure = low ? 'low-confidence' : 'no-candidate';
    result.ambiguous = true;
    result.notes.push(low ? 'low-confidence' : 'ambiguous');
    if (!result.alternatives.some((item) => item.value === sys)) {
      result.alternatives.push({ value: sys, confidence: confidenceFor(sys, words) });
    }
    if (!result.alternatives.some((item) => item.value === dia)) {
      result.alternatives.push({ value: dia, confidence: confidenceFor(dia, words) });
    }
  } else if (low) {
    result.notes.push('low-confidence');
  }
}

function detectUnit(text: string): { unit: GlucoseUnit | null; explicit: boolean; conflict: boolean } {
  const mmol = /mmol\s*\/?\s*l?/i.test(text);
  const mg = /mg\s*\/?\s*dl/i.test(text);
  if (mmol && mg) return { unit: null, explicit: false, conflict: true };
  if (mmol) return { unit: 'mmol/L', explicit: true, conflict: false };
  if (mg) return { unit: 'mg/dL', explicit: true, conflict: false };
  return { unit: null, explicit: false, conflict: false };
}

function fillGlucose(
  result: MeterParseResult,
  original: string,
  stripped: string,
  words?: OcrWordInput[],
): void {
  const unit = detectUnit(original);
  result.glucoseUnit = unit.explicit ? unit.unit : null;
  result.unitExplicit = unit.explicit;
  if (unit.conflict) result.notes.push('unit-conflict');
  else if (unit.explicit) result.notes.push('unit-explicit');
  else result.notes.push('unit-missing');

  const found = numbersIn(stripped);
  const candidates: number[] = [];
  for (const value of found) {
    if (inGlucoseOcrRange(value)) candidates.push(value);
    else result.discarded.push({ raw: String(value), reason: 'out-of-range' });
  }
  const unique = [...new Set(candidates)];
  if (unique.length === 0) {
    result.failure = 'no-candidate';
    result.notes.push('no-candidate');
    return;
  }
  if (unique.length === 1) {
    const only = unique[0] as number;
    const suggested = suggest(only, 'single', words, !unit.explicit);
    if (suggested.field) {
      result.glucose = suggested.field;
      result.notes.push('single');
      if (suggested.low) result.notes.push('low-confidence');
    } else if (suggested.alternative) {
      result.alternatives = [suggested.alternative];
      result.failure = 'low-confidence';
      result.ambiguous = true;
      result.notes.push('low-confidence');
    }
    return;
  }

  const ranked = unique
    .map((value) => ({
      value,
      confidence: confidenceFor(value, words),
      height: heightFor(value, words),
    }))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.confidence ?? 0) - (a.confidence ?? 0));
  const top = ranked[0];
  const second = ranked[1];
  const prominent =
    top != null &&
    second != null &&
    top.height != null &&
    second.height != null &&
    second.height > 0 &&
    top.height >= second.height * 1.4;
  result.alternatives = ranked.map((item) => ({ value: item.value, confidence: item.confidence }));
  if (prominent && top && confidenceLevel(top.confidence) !== 'reject') {
    const suggested = suggest(top.value, 'prominence', words, true);
    result.glucose = suggested.field;
    result.notes.push('prominence');
    if (!unit.explicit) result.glucose = result.glucose ? { ...result.glucose, uncertain: true } : null;
    return;
  }
  result.ambiguous = true;
  result.failure = 'ambiguous';
  result.glucose = null;
  result.notes.push('ambiguous');
}
