import type { GlucoseUnit } from './types.ts';

/** Clinical conversion factor mg/dL per mmol/L. */
export const MMOL_TO_MGDL = 18.0182;

export function mgdlToMmol(mgdl: number): number {
  return mgdl / MMOL_TO_MGDL;
}

export function mmolToMgdl(mmol: number): number {
  return mmol * MMOL_TO_MGDL;
}

export function convertGlucose(value: number, from: GlucoseUnit, to: GlucoseUnit): number {
  if (from === to) return value;
  return to === 'mmol/L' ? mgdlToMmol(value) : mmolToMgdl(value);
}

export function roundGlucose(value: number, unit: GlucoseUnit): number {
  if (unit === 'mmol/L') return Math.round(value * 10) / 10;
  return Math.round(value);
}

export function formatGlucose(value: number, unit: GlucoseUnit): string {
  if (unit === 'mmol/L') return (Math.round(value * 10) / 10).toFixed(1);
  return String(Math.round(value));
}

export function isGlucoseLow(value: number, unit: GlucoseUnit): boolean {
  if (unit === 'mg/dL') return value < 70;
  return value < 3.9;
}

export function isGlucoseVeryHigh(value: number, unit: GlucoseUnit): boolean {
  if (unit === 'mg/dL') return value >= 300;
  return value >= 16.7;
}

export function isBpCrisis(systolic: number, diastolic: number): boolean {
  return systolic > 180 || diastolic > 120;
}

export function inGlucoseOcrRange(value: number): boolean {
  return (value >= 0.5 && value <= 40) || (value >= 15 && value <= 900);
}

export function inSystolicOcr(value: number): boolean {
  return value >= 70 && value <= 250;
}

export function inDiastolicOcr(value: number): boolean {
  return value >= 40 && value <= 150;
}

export function inPulseOcr(value: number): boolean {
  return value >= 30 && value <= 220;
}
