import { describe, expect, it } from 'vitest';
import {
  formatReadingForSheet,
  loadSyncConfig,
  saveSyncConfig,
  loadSyncStatuses,
  setReadingSyncStatus,
} from './sync.ts';
import type { GlucoseReading, BpReading } from './types.ts';
import type { StorageLike } from './storage.ts';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, val),
    removeItem: (key) => map.delete(key),
  };
}

describe('Google Sheets Sync helper', () => {
  it('formats glucose reading for spreadsheet row correctly', () => {
    const reading: GlucoseReading = {
      id: 'gl-1',
      type: 'glucose',
      recordedAt: '2026-11-09T08:00:00.000Z',
      glucoseValue: 110,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
      symptoms: [],
      notes: 'Feeling good',
      source: 'manual',
      createdAt: '2026-11-09T08:00:00.000Z',
      updatedAt: '2026-11-09T08:00:00.000Z',
    };

    const row = formatReadingForSheet(reading);
    expect(row.id).toBe('gl-1');
    expect(row.typeLabel).toBe('သွေးချို');
    expect(row.value).toBe('110 mg/dL');
    expect(row.notes).toBe('Feeling good');
  });

  it('formats BP reading for spreadsheet row correctly', () => {
    const reading: BpReading = {
      id: 'bp-1',
      type: 'bp',
      recordedAt: '2026-11-09T14:30:00.000Z',
      systolic: 125,
      diastolic: 82,
      pulse: 70,
      symptoms: ['dizziness'],
      notes: '',
      source: 'manual',
      createdAt: '2026-11-09T14:30:00.000Z',
      updatedAt: '2026-11-09T14:30:00.000Z',
    };

    const row = formatReadingForSheet(reading);
    expect(row.id).toBe('bp-1');
    expect(row.typeLabel).toBe('သွေးပေါင်');
    expect(row.value).toBe('125/82 mmHg');
    expect(row.detail).toBe('နှလုံးခုန်နှုန်း: 70 bpm');
    expect(row.symptoms).toBe('ခေါင်းမူး');
  });

  it('saves and loads sync config', () => {
    const storage = memoryStorage();
    expect(loadSyncConfig(storage).webhookUrl).toBe('');
    saveSyncConfig({ webhookUrl: 'https://script.google.com/macros/s/xyz/exec', autoSync: true }, storage);
    expect(loadSyncConfig(storage).webhookUrl).toBe('https://script.google.com/macros/s/xyz/exec');
  });

  it('updates and persists sync status per reading ID', () => {
    const storage = memoryStorage();
    setReadingSyncStatus('r-1', 'pending', undefined, storage);
    expect(loadSyncStatuses(storage)['r-1']?.status).toBe('pending');

    setReadingSyncStatus('r-1', 'synced', undefined, storage);
    expect(loadSyncStatuses(storage)['r-1']?.status).toBe('synced');
    expect(loadSyncStatuses(storage)['r-1']?.syncedAt).toBeDefined();

    setReadingSyncStatus('r-2', 'failed', 'Network down', storage);
    expect(loadSyncStatuses(storage)['r-2']?.status).toBe('failed');
    expect(loadSyncStatuses(storage)['r-2']?.error).toBe('Network down');
  });
});
