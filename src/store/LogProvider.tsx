import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyMerge, mergeMedications } from '../domain/backup.ts';
import { buildDemoStore, isStaleDemoSet } from '../domain/demo.ts';
import { byteLength, interpretStorageEvent, loadStore, readRaw, replaceStore, saveStore, type StorageReason } from '../domain/storage.ts';
import {
  loadSyncConfig,
  saveSyncConfig,
  loadSyncStatuses,
  setReadingSyncStatus,
  postReadingsToWebhook,
  type SyncConfig,
  type SyncRecordStatus,
} from '../domain/sync.ts';
import { DEMO_STORAGE_KEY, PREF_KEY, STORAGE_KEY, type Medication, type Reading, type StoreData } from '../domain/types.ts';
import { createId, emptyStore, issueMessage, validateMedication } from '../domain/validate.ts';

interface LogContextValue {
  hydrated: boolean;
  demo: boolean;
  setDemo: (on: boolean) => void;
  readings: Reading[];
  medications: Medication[];
  loadError: 'unavailable' | 'corrupt' | null;
  saveMessage: string | null;
  clearSaveMessage: () => void;
  rawBackup: string | null;
  byteSize: number | null;
  resetCorrupt: () => void;
  addReading: (reading: Reading) => boolean;
  updateReading: (reading: Reading) => boolean;
  deleteReading: (id: string) => boolean;
  restoreReading: (reading: Reading) => boolean;
  addMedication: (input: { name: string; dose: string; notes: string }) => boolean;
  removeMedication: (id: string) => boolean;
  /** Wipes the main log (readings + medications). Demo room only via MoreView in the main room. */
  clearMainData: () => boolean;
  importReadings: (
    incoming: { accepted: Reading[]; updates: Reading[]; medications?: Medication[] },
    mode: 'merge' | 'replace',
  ) => boolean;
  // Google Sheets Sync
  syncConfig: SyncConfig;
  updateSyncConfig: (config: SyncConfig) => void;
  syncStatuses: Record<string, SyncRecordStatus>;
  syncAllNow: () => Promise<{ ok: boolean; count: number; error?: string }>;
  syncSingleNow: (reading: Reading) => Promise<{ ok: boolean; error?: string }>;
}

/** Rebuild a demo store that predates the generated 3-month rows. Demo room only. */
function reseedStaleDemo(
  storage: Storage,
  key: string,
  loaded: { ok: true; data: StoreData; empty: boolean },
): { ok: true; data: StoreData; empty: boolean } {
  if (loaded.empty || !isStaleDemoSet(loaded.data.readings)) return loaded;
  const seeded = saveStore(storage, key, buildDemoStore(), loaded.data.revision);
  return seeded.ok ? { ok: true, data: seeded.data, empty: false } : loaded;
}

const LogContext = createContext<LogContextValue | null>(null);

function reasonText(reason: StorageReason): string {
  switch (reason) {
    case 'quota':
      return 'သိုလှောင်မှု ပြည့်နေသည်။ JSON ဘက်အပ်ထုတ်ပြီး မှတ်တမ်းအဟောင်းကို ဖျက်ပါ။';
    case 'conflict':
      return 'အခြားတဘ်တွင် ပြောင်းထားသည်။ နောက်ဆုံးဒေတာကို ပြန်ယူပြီးပါပြီ။ ဤတစ်ကြိမ်ကို မရေးပါ။ ထပ်သိမ်းလျှင် ယခုတဘ်မှ ထပ်ရေးမည်။';
    case 'corrupt':
      return 'သိမ်းထားသောဒေတာ ပျက်နေ၍ မရေးပါ။';
    case 'unavailable':
      return 'ဤဘရောက်ဇာတွင် ဒေတာသိမ်း၍မရပါ။ မှတ်တမ်းမကျန်နိုင်ပါ။';
    case 'invalid':
      return 'မှတ်တမ်းမမှန်သောကြောင့် မသိမ်းပါ။';
  }
}

function storageOf(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function LogProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [demo, setDemoFlag] = useState(false);
  const [data, setData] = useState<StoreData>(emptyStore());
  const [loadError, setLoadError] = useState<'unavailable' | 'corrupt' | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [rawBackup, setRawBackup] = useState<string | null>(null);

  // Sync state
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>(() => loadSyncConfig(storageOf()));
  const [syncStatuses, setSyncStatusesState] = useState<Record<string, SyncRecordStatus>>(() => loadSyncStatuses(storageOf()));

  const dataRef = useRef(data);
  const keyRef = useRef(STORAGE_KEY);
  const syncConfigRef = useRef(syncConfig);
  dataRef.current = data;
  keyRef.current = demo ? DEMO_STORAGE_KEY : STORAGE_KEY;
  syncConfigRef.current = syncConfig;

  useEffect(() => {
    const storage = storageOf();
    if (!storage) {
      setLoadError('unavailable');
      setHydrated(true);
      return;
    }
    let useDemo = false;
    try {
      const pref = storage.getItem(PREF_KEY);
      if (pref) {
        const parsed: unknown = JSON.parse(pref);
        useDemo = !!parsed && typeof parsed === 'object' && (parsed as { demo?: boolean }).demo === true;
      }
    } catch {
      useDemo = false;
    }
    const key = useDemo ? DEMO_STORAGE_KEY : STORAGE_KEY;
    const loaded = loadStore(storage, key);
    setDemoFlag(useDemo);
    if (loaded.ok) {
      const fresh = useDemo ? reseedStaleDemo(storage, key, loaded) : loaded;
      setData(fresh.data);
      setLoadError(null);
    } else {
      setLoadError(loaded.reason);
      setRawBackup(readRaw(storage, key));
    }
    setSyncConfigState(loadSyncConfig(storage));
    setSyncStatusesState(loadSyncStatuses(storage));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const onStorage = (event: StorageEvent) => {
      const decision = interpretStorageEvent(event.key, event.newValue, keyRef.current);
      if (decision.type === 'replace') {
        setData(decision.data);
        setLoadError(null);
        setSaveMessage('အခြားတဘ်မှ မှတ်တမ်းကို ယူလိုက်သည်။');
      } else if (decision.type === 'cleared') {
        setData(emptyStore());
        setLoadError(null);
        setSaveMessage('အခြားတဘ်တွင် မှတ်တမ်းကို ရှင်းလိုက်သည်။');
      } else if (decision.type === 'corrupt') {
        setLoadError('corrupt');
        setRawBackup(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrated]);

  // Online listener to flush pending or failed syncs
  useEffect(() => {
    const handleOnline = () => {
      const cfg = syncConfigRef.current;
      if (!cfg.webhookUrl || !cfg.autoSync) return;
      const statuses = loadSyncStatuses(storageOf());
      const currentReadings = dataRef.current.readings;
      const needSync = currentReadings.filter((r) => {
        const s = statuses[r.id]?.status;
        return s === 'pending' || s === 'failed';
      });
      if (needSync.length > 0) {
        postReadingsToWebhook(cfg.webhookUrl, needSync).then((res) => {
          const storage = storageOf();
          needSync.forEach((r) => {
            setReadingSyncStatus(r.id, res.ok ? 'synced' : 'failed', res.error, storage);
          });
          setSyncStatusesState(loadSyncStatuses(storage));
        });
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  function commit(mutate: (current: StoreData) => StoreData | null): boolean {
    const storage = storageOf();
    if (!storage || !hydrated) {
      setSaveMessage(reasonText('unavailable'));
      return false;
    }
    if (loadError === 'corrupt') {
      setSaveMessage(reasonText('corrupt'));
      return false;
    }
    const current = dataRef.current;
    const next = mutate(current);
    if (!next) return false;
    const result = saveStore(storage, keyRef.current, next, current.revision);
    if (result.ok) {
      dataRef.current = result.data;
      setData(result.data);
      setSaveMessage(null);
      return true;
    }
    if (result.reason === 'conflict') {
      const loaded = loadStore(storage, keyRef.current);
      if (loaded.ok) {
        dataRef.current = loaded.data;
        setData(loaded.data);
      }
    }
    setSaveMessage(reasonText(result.reason));
    return false;
  }

  // Trigger sync for a specific reading
  async function triggerSingleSync(reading: Reading): Promise<{ ok: boolean; error?: string }> {
    const cfg = syncConfigRef.current;
    const storage = storageOf();
    if (!cfg.webhookUrl) {
      return { ok: false, error: 'Webhook URL မရှိပါ' };
    }
    setReadingSyncStatus(reading.id, 'pending', undefined, storage);
    setSyncStatusesState(loadSyncStatuses(storage));

    const res = await postReadingsToWebhook(cfg.webhookUrl, [reading]);
    setReadingSyncStatus(reading.id, res.ok ? 'synced' : 'failed', res.error, storage);
    setSyncStatusesState(loadSyncStatuses(storage));
    return res;
  }

  // Sync all readings
  async function syncAllNow(): Promise<{ ok: boolean; count: number; error?: string }> {
    const cfg = syncConfigRef.current;
    const storage = storageOf();
    const currentReadings = dataRef.current.readings;
    if (!cfg.webhookUrl) {
      return { ok: false, count: 0, error: 'Webhook URL မထည့်ရသေးပါ' };
    }
    if (currentReadings.length === 0) {
      return { ok: true, count: 0 };
    }

    currentReadings.forEach((r) => setReadingSyncStatus(r.id, 'pending', undefined, storage));
    setSyncStatusesState(loadSyncStatuses(storage));

    const res = await postReadingsToWebhook(cfg.webhookUrl, currentReadings);
    currentReadings.forEach((r) => {
      setReadingSyncStatus(r.id, res.ok ? 'synced' : 'failed', res.error, storage);
    });
    setSyncStatusesState(loadSyncStatuses(storage));
    return { ok: res.ok, count: currentReadings.length, error: res.error };
  }

  const api = useMemo<LogContextValue>(() => {
    const storage = storageOf();
    const raw = storage && hydrated ? readRaw(storage, demo ? DEMO_STORAGE_KEY : STORAGE_KEY) : rawBackup;
    return {
      hydrated,
      demo,
      readings: data.readings,
      medications: data.medications,
      loadError,
      saveMessage,
      clearSaveMessage: () => setSaveMessage(null),
      rawBackup: raw,
      byteSize: raw == null ? null : byteLength(raw),
      syncConfig,
      syncStatuses,
      updateSyncConfig: (nextConfig) => {
        saveSyncConfig(nextConfig, storageOf());
        setSyncConfigState(nextConfig);
      },
      syncAllNow,
      syncSingleNow: triggerSingleSync,
      setDemo: (on) => {
        const box = storageOf();
        if (!box) {
          setLoadError('unavailable');
          return;
        }
        const key = on ? DEMO_STORAGE_KEY : STORAGE_KEY;
        let loaded = loadStore(box, key);
        if (on && loaded.ok && loaded.empty) {
          const seeded = saveStore(box, key, buildDemoStore(), 0);
          loaded = seeded.ok ? { ok: true, data: seeded.data, empty: false } : loadStore(box, key);
        } else if (on && loaded.ok) {
          loaded = reseedStaleDemo(box, key, loaded);
        }
        if (loaded.ok) {
          setData(loaded.data);
          setLoadError(null);
          setRawBackup(null);
        } else {
          setData(emptyStore());
          setLoadError(loaded.reason);
          setRawBackup(readRaw(box, key));
        }
        setDemoFlag(on);
        try {
          box.setItem(PREF_KEY, JSON.stringify({ demo: on }));
        } catch {
          setSaveMessage('နမူနာရွေးချယ်မှုကို မသိမ်းနိုင်ပါ။ ဤအကြိမ်အတွက်သာ ပြောင်းထားသည်။');
        }
      },
      resetCorrupt: () => {
        const box = storageOf();
        if (!box) return;
        const replaced = replaceStore(box, keyRef.current, emptyStore());
        if (replaced.ok) {
          setData(replaced.data);
          setLoadError(null);
          setRawBackup(null);
          setSaveMessage('ပျက်နေသောဒေတာကို ဖယ်ပြီး အသစ်စတင်ပြီးပါပြီ။');
        } else setSaveMessage(reasonText(replaced.reason));
      },
      addReading: (reading) => {
        const ok = commit((current) => ({ ...current, readings: [...current.readings, reading] }));
        if (ok && syncConfigRef.current.webhookUrl && syncConfigRef.current.autoSync) {
          triggerSingleSync(reading);
        }
        return ok;
      },
      updateReading: (reading) => {
        const ok = commit((current) => {
          if (!current.readings.some((item) => item.id === reading.id)) return null;
          return { ...current, readings: current.readings.map((item) => (item.id === reading.id ? reading : item)) };
        });
        if (ok && syncConfigRef.current.webhookUrl && syncConfigRef.current.autoSync) {
          triggerSingleSync(reading);
        }
        return ok;
      },
      deleteReading: (id) => commit((current) => ({ ...current, readings: current.readings.filter((item) => item.id !== id) })),
      restoreReading: (reading) => {
        const ok = commit((current) => {
          if (current.readings.some((item) => item.id === reading.id)) return current;
          return { ...current, readings: [...current.readings, reading] };
        });
        if (ok && syncConfigRef.current.webhookUrl && syncConfigRef.current.autoSync) {
          triggerSingleSync(reading);
        }
        return ok;
      },
      addMedication: (input) => {
        const stamp = new Date().toISOString();
        const parsed = validateMedication({ ...input, id: createId(), createdAt: stamp, updatedAt: stamp });
        if (!parsed.ok) {
          setSaveMessage(issueMessage(parsed.errors[0]?.code ?? 'invalid'));
          return false;
        }
        return commit((current) => ({
          ...current,
          medications: [...current.medications, parsed.value].sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },
      removeMedication: (id) =>
        commit((current) => ({ ...current, medications: current.medications.filter((item) => item.id !== id) })),
      clearMainData: () => commit(() => emptyStore()),
      importReadings: (incoming, mode) =>
        commit((current) => ({
          ...current,
          readings: mode === 'replace' ? incoming.accepted : applyMerge(current.readings, incoming),
          medications:
            mode === 'replace'
              ? [...(incoming.medications ?? [])].sort((a, b) => a.name.localeCompare(b.name))
              : mergeMedications(current.medications, incoming.medications ?? []),
        })),
    };
  }, [hydrated, demo, data, loadError, saveMessage, rawBackup, syncConfig, syncStatuses]);

  return <LogContext.Provider value={api}>{children}</LogContext.Provider>;
}

export function useLog(): LogContextValue {
  const value = useContext(LogContext);
  if (!value) throw new Error('useLog outside provider');
  return value;
}
