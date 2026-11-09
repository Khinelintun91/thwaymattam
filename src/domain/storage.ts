import { STORAGE_KEY } from './types.ts';
import type { StoreData } from './types.ts';
import { emptyStore, validateStore } from './validate.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageReason = 'unavailable' | 'corrupt' | 'quota' | 'conflict' | 'invalid';

export type LoadResult =
  | { ok: true; data: StoreData; empty: boolean }
  | { ok: false; reason: 'unavailable' | 'corrupt' };

export type SaveResult = { ok: true; data: StoreData } | { ok: false; reason: StorageReason };

export function isQuotaError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'QuotaExceededError';
}

export function loadStore(storage: StorageLike, key = STORAGE_KEY, options?: { now?: Date; maxFutureMs?: number }): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (raw == null || raw === '') return { ok: true, data: emptyStore(options?.now), empty: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = validateStore(parsed, { now: options?.now, maxFutureMs: options?.maxFutureMs ?? 48 * 60 * 60 * 1000 });
    if (!validated.ok) return { ok: false, reason: 'corrupt' };
    return { ok: true, data: validated.value, empty: false };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

/**
 * Writes only when the current payload is valid and its revision matches.
 * Corrupt or conflicting storage is left untouched.
 */
export function saveStore(
  storage: StorageLike,
  key: string,
  next: StoreData,
  expectedRevision: number,
  now = new Date(),
): SaveResult {
  let currentRaw: string | null;
  try {
    currentRaw = storage.getItem(key);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (currentRaw != null && currentRaw !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(currentRaw);
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    const current = validateStore(parsed, { now, maxFutureMs: 48 * 60 * 60 * 1000 });
    if (!current.ok) return { ok: false, reason: 'corrupt' };
    if (current.value.revision !== expectedRevision) return { ok: false, reason: 'conflict' };
  } else if (expectedRevision !== 0) {
    return { ok: false, reason: 'conflict' };
  }

  const validated = validateStore(
    { ...next, version: 1, revision: expectedRevision, updatedAt: now.toISOString() },
    { now, maxFutureMs: 48 * 60 * 60 * 1000 },
  );
  if (!validated.ok) return { ok: false, reason: 'invalid' };
  const toWrite: StoreData = {
    ...validated.value,
    revision: expectedRevision + 1,
    updatedAt: now.toISOString(),
  };
  try {
    storage.setItem(key, JSON.stringify(toWrite));
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, data: toWrite };
}

/** Explicit reset. This is the only writer that replaces corrupt bytes. */
export function replaceStore(storage: StorageLike, key: string, next: StoreData, now = new Date()): SaveResult {
  const validated = validateStore(
    { ...next, version: 1, revision: 0, updatedAt: now.toISOString() },
    { now, maxFutureMs: 48 * 60 * 60 * 1000 },
  );
  if (!validated.ok) return { ok: false, reason: 'invalid' };
  const toWrite: StoreData = { ...validated.value, revision: 1, updatedAt: now.toISOString() };
  try {
    storage.setItem(key, JSON.stringify(toWrite));
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, data: toWrite };
}

export function readRaw(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export type StorageEventDecision =
  | { type: 'ignore' }
  | { type: 'replace'; data: StoreData }
  | { type: 'cleared' }
  | { type: 'corrupt' };

export function interpretStorageEvent(eventKey: string | null, newValue: string | null, activeKey: string): StorageEventDecision {
  if (eventKey !== activeKey) return { type: 'ignore' };
  if (newValue == null || newValue === '') return { type: 'cleared' };
  try {
    const parsed: unknown = JSON.parse(newValue);
    const validated = validateStore(parsed, { maxFutureMs: 48 * 60 * 60 * 1000 });
    if (!validated.ok) return { type: 'corrupt' };
    return { type: 'replace', data: validated.value };
  } catch {
    return { type: 'corrupt' };
  }
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
