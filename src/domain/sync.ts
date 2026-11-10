import type { Reading } from './types.ts';
import { formatLongDate, formatTime12 } from './time.ts';
import { MEAL_LABEL, SYMPTOM_LABEL } from './labels.ts';
import type { StorageLike } from './storage.ts';

export const SYNC_CONFIG_KEY = 'thwaymattam.sync.config.v1';
export const SYNC_STATUS_KEY = 'thwaymattam.sync.status.v1';
export const SYNC_META_KEY = 'thwaymattam.sync.meta.v1';

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface SyncRecordStatus {
  status: SyncStatus;
  syncedAt?: string;
  lastAttempt?: string;
  error?: string;
}

export interface SyncConfig {
  webhookUrl: string;
  autoSync: boolean;
}

export interface SyncMeta {
  lastSuccessTime?: string | null;
  lastAttemptTime?: string | null;
  lastStatus?: 'success' | 'failed' | null;
  lastError?: string | null;
  lastSyncedCount?: number;
}

export interface SyncStats {
  totalReadings: number;
  syncedCount: number;
  pendingCount: number;
  failedCount: number;
  lastSuccessTime: string | null;
  lastAttemptTime: string | null;
  lastError: string | null;
}

/**
 * Default webhook for Emma's own Google Sheet ("သွေးမှတ်တမ်း").
 * Pre-filled so she never has to paste the long URL by hand; the
 * setting can still be changed or cleared from the More page.
 */
export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyRHDkJvvt3UkOOfH_KoUwAHcFzvRss6aple_moJyn50QpTm35hotcIAoVgSbWc5sfLHA/exec';

const DEFAULT_CONFIG: SyncConfig = {
  webhookUrl: DEFAULT_WEBHOOK_URL,
  autoSync: true,
};

const DEFAULT_META: SyncMeta = {
  lastSuccessTime: null,
  lastAttemptTime: null,
  lastStatus: null,
  lastError: null,
  lastSyncedCount: 0,
};

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSyncConfig(storage: StorageLike | null = defaultStorage()): SyncConfig {
  if (!storage) return DEFAULT_CONFIG;
  try {
    const raw = storage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    const savedUrl = typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl.trim() : '';
    return {
      // Fall back to the pre-filled default when nothing was saved yet,
      // so the phone shows the webhook URL without pasting it by hand.
      webhookUrl: savedUrl || DEFAULT_CONFIG.webhookUrl,
      autoSync: typeof parsed.autoSync === 'boolean' ? parsed.autoSync : true,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveSyncConfig(config: SyncConfig, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* ignore storage quota */
  }
}

export function loadSyncStatuses(storage: StorageLike | null = defaultStorage()): Record<string, SyncRecordStatus> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(SYNC_STATUS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SyncRecordStatus>;
  } catch {
    return {};
  }
}

export function saveSyncStatuses(statuses: Record<string, SyncRecordStatus>, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SYNC_STATUS_KEY, JSON.stringify(statuses));
  } catch {
    /* ignore storage quota */
  }
}

export function setReadingSyncStatus(
  id: string,
  status: SyncStatus,
  error?: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  const current = loadSyncStatuses(storage);
  current[id] = {
    status,
    lastAttempt: new Date().toISOString(),
    ...(status === 'synced' ? { syncedAt: new Date().toISOString() } : {}),
    ...(error ? { error } : {}),
  };
  saveSyncStatuses(current, storage);
}

export function loadSyncMeta(storage: StorageLike | null = defaultStorage()): SyncMeta {
  if (!storage) return DEFAULT_META;
  try {
    const raw = storage.getItem(SYNC_META_KEY);
    if (!raw) return DEFAULT_META;
    return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_META;
  }
}

export function saveSyncMeta(meta: SyncMeta, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore storage quota */
  }
}

export function recordSyncResult(
  result: { ok: boolean; count?: number; error?: string },
  storage: StorageLike | null = defaultStorage(),
): SyncMeta {
  const current = loadSyncMeta(storage);
  const now = new Date().toISOString();
  const next: SyncMeta = {
    ...current,
    lastAttemptTime: now,
    lastStatus: result.ok ? 'success' : 'failed',
    lastError: result.ok ? null : (result.error ?? 'Unknown error'),
    ...(result.ok ? { lastSuccessTime: now, lastSyncedCount: result.count ?? 0 } : {}),
  };
  saveSyncMeta(next, storage);
  return next;
}

export function computeSyncStats(
  readings: Reading[],
  statuses: Record<string, SyncRecordStatus>,
  meta: SyncMeta,
): SyncStats {
  let synced = 0;
  let pending = 0;
  let failed = 0;

  for (const r of readings) {
    const st = statuses[r.id]?.status;
    if (st === 'synced') {
      synced++;
    } else if (st === 'failed') {
      failed++;
    } else {
      pending++;
    }
  }

  // Fallback for lastSuccessTime if not in meta: find the most recent syncedAt from statuses
  let lastSuccessTime = meta.lastSuccessTime ?? null;
  if (!lastSuccessTime) {
    for (const r of readings) {
      const sAt = statuses[r.id]?.syncedAt;
      if (sAt && (!lastSuccessTime || sAt > lastSuccessTime)) {
        lastSuccessTime = sAt;
      }
    }
  }

  return {
    totalReadings: readings.length,
    syncedCount: synced,
    pendingCount: pending,
    failedCount: failed,
    lastSuccessTime,
    lastAttemptTime: meta.lastAttemptTime ?? null,
    lastError: meta.lastError ?? null,
  };
}

export function formatSyncTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'မရှိသေးပါ';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'မရှိသေးပါ';
    return `${formatLongDate(d)}၊ ${formatTime12(d)}`;
  } catch {
    return 'မရှိသေးပါ';
  }
}

export function formatReadingForSheet(reading: Reading) {
  const dateObj = new Date(reading.recordedAt);
  const dateStr = reading.recordedAt.slice(0, 10);
  const timeStr = formatTime12(dateObj);

  let typeLabel = '';
  let valueStr = '';
  let detail = '';

  if (reading.type === 'glucose') {
    typeLabel = 'သွေးချို';
    valueStr = `${reading.glucoseValue} ${reading.glucoseUnit}`;
    detail = MEAL_LABEL[reading.mealContext] ?? reading.mealContext;
    if (reading.minutesSinceMealStart != null) {
      detail += ` (${reading.minutesSinceMealStart} မိနစ်နောက်)`;
    }
  } else {
    typeLabel = 'သွေးပေါင်';
    valueStr = `${reading.systolic}/${reading.diastolic} mmHg`;
    if (reading.pulse != null) {
      detail = `နှလုံးခုန်နှုန်း: ${reading.pulse} bpm`;
    }
  }

  const symptomsStr = reading.symptoms.map((s) => SYMPTOM_LABEL[s] ?? s).join(', ');

  return {
    id: reading.id,
    type: reading.type,
    typeLabel,
    recordedAt: reading.recordedAt,
    date: dateStr,
    time: timeStr,
    value: valueStr,
    detail,
    symptoms: symptomsStr,
    notes: reading.notes ?? '',
    source: reading.source,
  };
}

/**
 * Send an array of readings to Google Sheets Apps Script Webhook.
 *
 * Google Apps Script web apps do not send CORS headers, so a normal
 * fetch() from the GitHub Pages app is blocked by the browser and the
 * request never reaches the script. mode: 'no-cors' lets the request
 * through; the response is opaque and cannot be read, so a resolved
 * fetch means the data was sent. The Content-Type stays text/plain
 * (a CORS-safelisted simple header) so no preflight is triggered.
 */
export async function postReadingsToWebhook(
  webhookUrl: string,
  readings: Reading[],
): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'Webhook URL မမှန်ကန်ပါ' };
  }
  if (readings.length === 0) {
    return { ok: true, count: 0 };
  }

  const payload = {
    action: 'sync_readings',
    app: 'thwaymattam',
    timestamp: new Date().toISOString(),
    items: readings.map(formatReadingForSheet),
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    return { ok: true, count: readings.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message || 'ကွန်ရက်ချိတ်ဆက်မှု မရပါ' };
  }
}

/**
 * Test connectivity to the webhook endpoint.
 *
 * Same no-cors reason as postReadingsToWebhook: the Apps Script
 * endpoint does not send CORS headers, so the response is opaque.
 * A resolved fetch means the endpoint was reached.
 */
export async function testWebhookConnection(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'URL မမှန်ကန်ပါ (http/https ဖြင့် စရပါမည်)' };
  }
  try {
    const payload = { action: 'ping', timestamp: new Date().toISOString() };
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message || 'ကွန်ရက်ချိတ်ဆက်မှု မရပါ' };
  }
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// === Google Apps Script for Thway Mattam (သွေးမှတ်တမ်း) ===
// 1. Google Sheets အသစ်တစ်ခုဖွင့်ပါ
// 2. Extensions > Apps Script ကိုနှိပ်ပါ
// 3. ဒီ code ကို အကုန်အစားထိုးကူးထည့်ပြီး Save လုပ်ပါ
// 4. Deploy > New deployment > Select type: Web app
// 5. Who has access: Anyone ကိုရွေးချယ်ပြီး Deploy နှိပ်ပါ
// 6. ရလာတဲ့ Web app URL ကို သွေးမှတ်တမ်း App ဆက်တင်ထဲ ကူးထည့်ပါ

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    setupHeaders(sheet);

    var data = JSON.parse(e.postData.contents);
    if (data.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'pong' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var items = data.items || [];
    var existingData = sheet.getDataRange().getValues();
    var idRowMap = {};
    for (var r = 1; r < existingData.length; r++) {
      if (existingData[r][0]) {
        idRowMap[existingData[r][0]] = r + 1;
      }
    }

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var rowData = [
        item.id,
        item.date,
        item.time,
        item.typeLabel,
        item.value,
        item.detail,
        item.symptoms,
        item.notes,
        new Date().toISOString()
      ];

      if (idRowMap[item.id]) {
        sheet.getRange(idRowMap[item.id], 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', count: items.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = [
      'Record ID', 'ရက်စွဲ', 'အချိန်', 'အမျိုးအစား',
      'တန်ဖိုး', 'အခြေအနေ/အသေးစိတ်', 'လက္ခဏာများ', 'မှတ်ချက်', 'Sync အချိန်'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E8EDFF');
  }
}
`;

export const SYNC_WEBHOOK_SCRIPT_TEMPLATE = GOOGLE_APPS_SCRIPT_TEMPLATE;
