import { describe, expect, it } from 'vitest';
import { buildDemoStore } from './demo.ts';
import { interpretStorageEvent, loadStore, readRaw, replaceStore, saveStore, type StorageLike } from './storage.ts';
import { DEMO_STORAGE_KEY, STORAGE_KEY, type StoreData } from './types.ts';
import { emptyStore, validateReading, validateStore } from './validate.ts';

const NOW = new Date('2026-11-09T04:00:00Z');

function memory(quota?: number): { storage: StorageLike; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    storage: {
      getItem: (key) => (map.has(key) ? (map.get(key) ?? null) : null),
      setItem: (key, value) => {
        if (quota != null && value.length > quota) {
          const error = new Error('quota');
          error.name = 'QuotaExceededError';
          throw error;
        }
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    },
  };
}

function reading(id: string, value: number) {
  const parsed = validateReading(
    {
      id,
      type: 'glucose',
      recordedAt: '2026-11-09T07:30:00+06:30',
      glucoseValue: value,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    { now: NOW },
  );
  if (!parsed.ok) throw new Error(parsed.errors.map((issue) => issue.code).join(','));
  return parsed.value;
}

describe('versioned storage', () => {
  it('reloads create, update, and delete without dropping fields', () => {
    const { storage } = memory();
    const created = reading('reading01', 101);
    let saved = saveStore(storage, STORAGE_KEY, { ...emptyStore(NOW), readings: [created] }, 0, NOW);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    let loaded = loadStore(storage, STORAGE_KEY, { now: NOW });
    expect(loaded.ok && loaded.data.readings).toEqual([created]);
    expect(loaded.ok && loaded.data.revision).toBe(1);

    const updated = { ...created, glucoseValue: 110, updatedAt: NOW.toISOString() };
    saved = saveStore(storage, STORAGE_KEY, { ...saved.data, readings: [updated] }, saved.data.revision, NOW);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    loaded = loadStore(storage, STORAGE_KEY, { now: NOW });
    const reloaded = loaded.ok ? loaded.data.readings[0] : undefined;
    expect(reloaded?.type === 'glucose' ? reloaded.glucoseValue : undefined).toBe(110);

    saved = saveStore(storage, STORAGE_KEY, { ...saved.data, readings: [] }, saved.data.revision, NOW);
    expect(saved.ok).toBe(true);
    loaded = loadStore(storage, STORAGE_KEY, { now: NOW });
    expect(loaded.ok && loaded.data.readings).toEqual([]);
    expect(JSON.stringify(loaded.ok && loaded.data)).not.toMatch(/data:image|photo|blob:/);
  });

  it('does not clobber corrupt or conflicting payloads', () => {
    const { storage, map } = memory();
    map.set(STORAGE_KEY, '{not json');
    expect(loadStore(storage, STORAGE_KEY).ok).toBe(false);
    const blocked = saveStore(storage, STORAGE_KEY, emptyStore(NOW), 0, NOW);
    expect(blocked).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(map.get(STORAGE_KEY)).toBe('{not json');

    map.set(STORAGE_KEY, JSON.stringify({ version: 2, revision: 3, updatedAt: NOW.toISOString(), readings: [] }));
    expect(saveStore(storage, STORAGE_KEY, emptyStore(NOW), 3, NOW)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(map.get(STORAGE_KEY)).toContain('"version":2');

    const good = reading('reading02', 99);
    const bad = { ...good, glucoseValue: 0 };
    map.set(
      STORAGE_KEY,
      JSON.stringify({ version: 1, revision: 4, updatedAt: NOW.toISOString(), readings: [good, bad] }),
    );
    const before = map.get(STORAGE_KEY);
    expect(loadStore(storage, STORAGE_KEY, { now: NOW }).ok).toBe(false);
    expect(saveStore(storage, STORAGE_KEY, emptyStore(NOW), 4, NOW)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(map.get(STORAGE_KEY)).toBe(before);
  });

  it('reports quota, unavailable storage, and cross-tab revision conflicts', () => {
    const tiny = memory(30);
    expect(saveStore(tiny.storage, STORAGE_KEY, emptyStore(NOW), 0, NOW)).toMatchObject({ ok: false, reason: 'quota' });
    expect(tiny.map.size).toBe(0);

    const denied: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
    };
    const deniedLoad = loadStore(denied);
    expect(deniedLoad.ok).toBe(false);
    if (!deniedLoad.ok) expect(deniedLoad.reason).toBe('unavailable');

    const { storage, map } = memory();
    const first = saveStore(storage, STORAGE_KEY, { ...emptyStore(NOW), readings: [reading('reading03', 88)] }, 0, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const snapshot = map.get(STORAGE_KEY);
    const other = JSON.parse(snapshot ?? '{}') as StoreData;
    other.revision = 5;
    map.set(STORAGE_KEY, JSON.stringify(other));
    const conflict = saveStore(storage, STORAGE_KEY, first.data, first.data.revision, NOW);
    expect(conflict).toMatchObject({ ok: false, reason: 'conflict' });
    expect(map.get(STORAGE_KEY)).toContain('"revision":5');
    expect(interpretStorageEvent(STORAGE_KEY, map.get(STORAGE_KEY) ?? null, STORAGE_KEY).type).toBe('replace');
    expect(interpretStorageEvent('other', '{}', STORAGE_KEY).type).toBe('ignore');
    expect(interpretStorageEvent(STORAGE_KEY, null, STORAGE_KEY).type).toBe('cleared');
    expect(interpretStorageEvent(STORAGE_KEY, '{', STORAGE_KEY).type).toBe('corrupt');
  });

  it('keeps demo rows on their own key and can reset only after an explicit replace', () => {
    const { storage, map } = memory();
    map.set(STORAGE_KEY, '{kept');
    const demo = buildDemoStore(NOW);
    const validated = validateStore(demo, { now: NOW, maxFutureMs: 48 * 60 * 60 * 1000 });
    expect(validated.ok).toBe(true);
    const saved = saveStore(storage, DEMO_STORAGE_KEY, demo, 0, NOW);
    expect(saved.ok).toBe(true);
    expect(map.get(STORAGE_KEY)).toBe('{kept');
    expect(readRaw(storage, DEMO_STORAGE_KEY)).toContain('demo-glu-today');
    const replaced = replaceStore(storage, STORAGE_KEY, emptyStore(NOW), NOW);
    expect(replaced.ok).toBe(true);
    expect(loadStore(storage, STORAGE_KEY, { now: NOW }).ok).toBe(true);
  });
});
