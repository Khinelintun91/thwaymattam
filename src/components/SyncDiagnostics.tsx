import { useState, useEffect } from 'react';
import { Modal } from './Modal.tsx';
import { useLog } from '../store/LogProvider.tsx';
import { formatSyncTimestamp, testWebhookConnection } from '../domain/sync.ts';
import { whenLabel, readingValue, readingContext } from './format.ts';

export function SyncDiagnosticsModal({ onClose }: { onClose: () => void }) {
  const { readings, syncConfig, syncStatuses, syncStats, retryPendingNow, syncAllNow, syncSingleNow } = useLog();
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleRetry() {
    if (!syncConfig.webhookUrl) {
      setFeedback('Webhook URL မထည့်ရသေးပါ');
      return;
    }
    setBusy(true);
    setFeedback('ဒေတာများ ပို့နေသည်…');
    const res = await retryPendingNow();
    setBusy(false);
    if (res.ok) {
      setFeedback(res.count === 0 ? '✔ ပို့ရန်ကျန်သော မှတ်တမ်း မရှိပါ' : `✔ မှတ်တမ်း ${res.count} ခု အောင်မြင်စွာ ပို့ပြီးပါပြီ!`);
    } else {
      setFeedback(`❌ ပို့၍မရပါ: ${res.error ?? 'အင်တာနက်စစ်ပါ'}`);
    }
  }

  async function handleSyncAll() {
    if (!syncConfig.webhookUrl) {
      setFeedback('Webhook URL မထည့်ရသေးပါ');
      return;
    }
    setBusy(true);
    setFeedback('ဒေတာအားလုံး ပို့နေသည်…');
    const res = await syncAllNow();
    setBusy(false);
    if (res.ok) {
      setFeedback(`✔ မှတ်တမ်းအားလုံး (${res.count} ခု) Google Sheet သို့ ပို့ပြီးပါပြီ!`);
    } else {
      setFeedback(`❌ ပို့၍မရပါ: ${res.error ?? 'အင်တာနက်စစ်ပါ'}`);
    }
  }

  async function handleTest() {
    if (!syncConfig.webhookUrl) {
      setTestResult('Webhook URL မရှိသေးပါ');
      return;
    }
    setTestBusy(true);
    setTestResult('စမ်းသပ်နေသည်…');
    const res = await testWebhookConnection(syncConfig.webhookUrl);
    setTestBusy(false);
    if (res.ok) {
      setTestResult('✔ Google Sheets ချိတ်ဆက်မှု အောင်မြင်ပါသည် (Ping OK)');
    } else {
      setTestResult(`❌ ချိတ်ဆက်၍မရပါ: ${res.error}`);
    }
  }

  const unsyncedReadings = readings.filter((r) => syncStatuses[r.id]?.status !== 'synced');

  return (
    <Modal title="Google Sheets Sync စစ်ဆေးမှု" titleIcon={<DiagPulseIcon />} onClose={onClose}>
      <div className="stack" style={{ gap: '12px' }}>
        {/* Status Indicators Grid */}
        <div className="diag-grid">
          <div className="diag-tile">
            <span className="diag-tile-label">နောက်ဆုံး အောင်မြင်ချိန်</span>
            <strong className="diag-tile-val">{formatSyncTimestamp(syncStats.lastSuccessTime)}</strong>
          </div>
          <div className="diag-tile">
            <span className="diag-tile-label">Pending (စောင့်ဆိုင်းဆဲ)</span>
            <strong className={`diag-tile-val ${syncStats.pendingCount > 0 ? 'text-warning' : 'text-success'}`}>
              {syncStats.pendingCount} ခု
            </strong>
          </div>
          <div className="diag-tile">
            <span className="diag-tile-label">မအောင်မြင်သေးသော ဒေတာ</span>
            <strong className={`diag-tile-val ${syncStats.failedCount > 0 ? 'text-danger' : ''}`}>
              {syncStats.failedCount} ခု
            </strong>
          </div>
          <div className="diag-tile">
            <span className="diag-tile-label">အောင်မြင်ပြီးသော ဒေတာ</span>
            <strong className="diag-tile-val text-success">
              {syncStats.syncedCount} / {syncStats.totalReadings} ခု
            </strong>
          </div>
          <div className="diag-tile">
            <span className="diag-tile-label">အင်တာနက် အခြေအနေ</span>
            <strong className={`diag-tile-val ${isOnline ? 'text-success' : 'text-danger'}`}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </strong>
          </div>
          <div className="diag-tile">
            <span className="diag-tile-label">Auto-Sync ခလုတ်</span>
            <strong className="diag-tile-val">
              {syncConfig.autoSync ? 'ဖွင့်ထားသည် (On)' : 'ပိတ်ထားသည် (Off)'}
            </strong>
          </div>
        </div>

        {/* Webhook Configuration status */}
        <div className="diag-section">
          <span className="diag-section-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
            Google Apps Script Webhook:
          </span>
          <p className="diag-url-box">
            {syncConfig.webhookUrl ? syncConfig.webhookUrl : 'Webhook URL မထည့်ရသေးပါ'}
          </p>
          <div className="row" style={{ marginTop: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              disabled={testBusy || !syncConfig.webhookUrl}
              onClick={handleTest}
            >
              {testBusy ? 'စမ်းသပ်နေသည်…' : 'ချိတ်ဆက်မှု စမ်းသပ်မည် (Ping)'}
            </button>
            {testResult ? <span style={{ fontSize: '12px', fontWeight: 600 }}>{testResult}</span> : null}
          </div>
        </div>

        {/* Action Controls */}
        <div className="stack" style={{ gap: '8px' }}>
          <div className="btn-grid-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !syncConfig.webhookUrl || unsyncedReadings.length === 0}
              onClick={handleRetry}
            >
              {busy ? 'ပို့နေသည်…' : `🔄 မရောက်သေးဒေတာ (${unsyncedReadings.length} ခု) ပြန်ပို့မည်`}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy || !syncConfig.webhookUrl || readings.length === 0}
              onClick={handleSyncAll}
            >
              ဒေတာအားလုံး ပြန်ပို့မည် ({readings.length})
            </button>
          </div>
          {feedback ? <p className="banner info" role="status">{feedback}</p> : null}
        </div>

        {/* List of pending / failed records if any */}
        <div className="diag-section" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: '13px' }}>
            ပို့ရန်ကျန်သော / မအောင်မြင်သော မှတ်တမ်းများ ({unsyncedReadings.length})
          </h4>
          {unsyncedReadings.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              ✔ မှတ်တမ်းအားလုံး Google Sheet ဆီ ရောက်ရှိပြီးဖြစ်ပါသည်။
            </p>
          ) : (
            <ul className="diag-unsynced-list">
              {unsyncedReadings.map((r) => {
                const st = syncStatuses[r.id];
                return (
                  <li key={r.id} className="diag-unsynced-item">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ alignItems: 'center', gap: '6px' }}>
                        <span className={`sync-chip ${st?.status === 'failed' ? 'sync-failed' : 'sync-pending'}`}>
                          {st?.status === 'failed' ? '⚠ မအောင်မြင်' : '⏳ Pending'}
                        </span>
                        <strong style={{ fontSize: '13px' }}>{readingValue(r)}</strong>
                        <span className="muted" style={{ fontSize: '12px' }}>{readingContext(r)}</span>
                      </div>
                      <span className="muted" style={{ fontSize: '11px' }}>{whenLabel(r)}</span>
                      {st?.error ? (
                        <p style={{ margin: '2px 0 0', color: '#b91c1c', fontSize: '11px' }}>အမှား: {st.error}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn btn-quiet btn-tiny"
                      disabled={busy}
                      onClick={() => syncSingleNow(r)}
                    >
                      ပြန်ပို့
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button type="button" className="btn btn-quiet btn-block" onClick={onClose}>
          ပိတ်မည်
        </button>
      </div>
    </Modal>
  );
}

function DiagPulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: '20px', height: '20px' }}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
