import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  computeSyncStats,
  formatReadingForSheet,
  formatSyncTimestamp,
  loadSyncConfig,
  saveSyncConfig,
  loadSyncStatuses,
  setReadingSyncStatus,
  loadSyncMeta,
  recordSyncResult,
  postReadingsToWebhook,
  testWebhookConnection,
  DEFAULT_WEBHOOK_URL,
} from './sync.ts';
import type { GlucoseReading, BpReading, Reading } from './types.ts';
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
    expect(loadSyncConfig(storage).webhookUrl).toBe(DEFAULT_WEBHOOK_URL);
    saveSyncConfig({ webhookUrl: 'https://script.google.com/macros/s/xyz/exec', autoSync: true }, storage);
    expect(loadSyncConfig(storage).webhookUrl).toBe('https://script.google.com/macros/s/xyz/exec');
  });

  it('falls back to the pre-filled default when the saved URL is empty', () => {
    const storage = memoryStorage();
    saveSyncConfig({ webhookUrl: '', autoSync: true }, storage);
    expect(loadSyncConfig(storage).webhookUrl).toBe(DEFAULT_WEBHOOK_URL);
    saveSyncConfig({ webhookUrl: '   ', autoSync: true }, storage);
    expect(loadSyncConfig(storage).webhookUrl).toBe(DEFAULT_WEBHOOK_URL);
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

  it('saves, loads, and records sync metadata', () => {
    const storage = memoryStorage();
    const initial = loadSyncMeta(storage);
    expect(initial.lastSuccessTime).toBeNull();

    recordSyncResult({ ok: true, count: 5 }, storage);
    const updated = loadSyncMeta(storage);
    expect(updated.lastStatus).toBe('success');
    expect(updated.lastSyncedCount).toBe(5);
    expect(updated.lastSuccessTime).toBeTruthy();

    recordSyncResult({ ok: false, error: 'Offline' }, storage);
    const failed = loadSyncMeta(storage);
    expect(failed.lastStatus).toBe('failed');
    expect(failed.lastError).toBe('Offline');
    // lastSuccessTime should be preserved
    expect(failed.lastSuccessTime).toBe(updated.lastSuccessTime);
  });

  it('computes sync statistics accurately', () => {
    const readings: Reading[] = [
      { id: '1', type: 'glucose', recordedAt: '2026-11-09T08:00:00.000Z' } as Reading,
      { id: '2', type: 'bp', recordedAt: '2026-11-09T10:00:00.000Z' } as Reading,
      { id: '3', type: 'glucose', recordedAt: '2026-11-09T12:00:00.000Z' } as Reading,
    ];
    const statuses = {
      '1': { status: 'synced' as const, syncedAt: '2026-11-09T08:05:00.000Z' },
      '2': { status: 'failed' as const, error: 'Timeout' },
      // '3' has no status yet -> pending
    };
    const meta = {
      lastSuccessTime: '2026-11-09T08:05:00.000Z',
      lastAttemptTime: '2026-11-09T10:05:00.000Z',
      lastStatus: 'failed' as const,
      lastError: 'Timeout',
    };

    const stats = computeSyncStats(readings, statuses, meta);
    expect(stats.totalReadings).toBe(3);
    expect(stats.syncedCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.pendingCount).toBe(1);
    expect(stats.lastSuccessTime).toBe('2026-11-09T08:05:00.000Z');
    expect(stats.lastError).toBe('Timeout');
  });

  it('formats sync timestamps in Burmese', () => {
    expect(formatSyncTimestamp(null)).toBe('မရှိသေးပါ');
    expect(formatSyncTimestamp('')).toBe('မရှိသေးပါ');
    const formatted = formatSyncTimestamp('2026-11-09T08:30:00.000Z');
    expect(formatted).toContain('နိုဝင်ဘာ');
  });

  describe('webhook fetch (no-cors)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const sampleReading: GlucoseReading = {
      id: 'gl-test-1',
      type: 'glucose',
      recordedAt: '2026-11-09T08:00:00.000Z',
      glucoseValue: 110,
      glucoseUnit: 'mg/dL',
      mealContext: 'fasting',
      minutesSinceMealStart: null,
      symptoms: [],
      notes: '',
      source: 'manual',
      createdAt: '2026-11-09T08:00:00.000Z',
      updatedAt: '2026-11-09T08:00:00.000Z',
    };

    it('posts readings with mode no-cors and treats a resolved fetch as success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({} as Response);
      vi.stubGlobal('fetch', fetchMock);
      const res = await postReadingsToWebhook('https://script.google.com/macros/s/xyz/exec', [sampleReading]);
      expect(res.ok).toBe(true);
      expect(res.count).toBe(1);
      expect(fetchMock).toHaveBeenCalledOnce();
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(init?.mode).toBe('no-cors');
      expect(init?.method).toBe('POST');
    });

    it('reports failure when the readings post rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
      const res = await postReadingsToWebhook('https://script.google.com/macros/s/xyz/exec', [sampleReading]);
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Failed to fetch');
    });

    it('returns ok for an empty readings list without fetching', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const res = await postReadingsToWebhook('https://script.google.com/macros/s/xyz/exec', []);
      expect(res.ok).toBe(true);
      expect(res.count).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('tests the connection with mode no-cors and treats a resolved fetch as success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({} as Response);
      vi.stubGlobal('fetch', fetchMock);
      const res = await testWebhookConnection('https://script.google.com/macros/s/xyz/exec');
      expect(res.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
      expect(init?.mode).toBe('no-cors');
      expect(init?.method).toBe('POST');
    });

    it('reports failure when the connection test rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
      const res = await testWebhookConnection('https://script.google.com/macros/s/xyz/exec');
      expect(res.ok).toBe(false);
      expect(res.error).toBe('Failed to fetch');
    });

    it('rejects a non-http webhook URL without fetching', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect((await postReadingsToWebhook('', [sampleReading])).ok).toBe(false);
      expect((await testWebhookConnection('ftp://example.com/x')).ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
