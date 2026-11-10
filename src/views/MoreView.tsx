import { useState } from 'react';
import { Modal, TrashIcon } from '../components/Modal.tsx';
import { importPreviewSummary, importResultSummary, planImport, readImport, type ImportReadResult } from '../domain/backup.ts';
import { backupPayload } from '../domain/share.ts';
import type { Medication, Reading } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';
import { SYNC_WEBHOOK_SCRIPT_TEMPLATE, testWebhookConnection, formatSyncTimestamp } from '../domain/sync.ts';
import { SyncDiagnosticsModal } from '../components/SyncDiagnostics.tsx';

const MAX_IMPORT_BYTES = 1_500_000;

export function MoreView({ onPrint }: { onPrint: () => void }) {
  const log = useLog();
  const [preview, setPreview] = useState<{
    fileName: string;
    result: ImportReadResult;
    accepted: Reading[];
    updates: Reading[];
    duplicateCount: number;
    replacement: Reading[];
    medications: Medication[];
  } | null>(null);
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'info' | 'warning'>('info');

  const [clearOpen, setClearOpen] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);



  // Sync state
  const [webhookUrl, setWebhookUrl] = useState(log.syncConfig.webhookUrl);
  const [autoSync, setAutoSync] = useState(log.syncConfig.autoSync);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);

  // Medication quick state
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medMessage, setMedMessage] = useState<string | null>(null);

  async function handleSaveSync() {
    log.updateSyncConfig({ webhookUrl: webhookUrl.trim(), autoSync });
    setSyncStatusMsg('✔ Sync ဆက်တင် သိမ်းဆည်းပြီးပါပြီ။');
    setTimeout(() => setSyncStatusMsg(null), 4000);
  }

  async function handleTestWebhook() {
    if (!webhookUrl.trim()) {
      setSyncStatusMsg('Webhook URL ထည့်ပါ');
      return;
    }
    setSyncBusy(true);
    setSyncStatusMsg('စမ်းသပ်နေသည်…');
    const res = await testWebhookConnection(webhookUrl.trim());
    setSyncBusy(false);
    if (res.ok) {
      setSyncStatusMsg('✔ Google Sheet သို့ ချိတ်ဆက်မှု အောင်မြင်ပါသည် (Ping OK)');
    } else {
      setSyncStatusMsg(`❌ ချိတ်ဆက်၍မရပါ: ${res.error ?? 'အမှားရှိသည်'}`);
    }
  }

  async function handleRetryPending() {
    if (!webhookUrl.trim()) {
      setSyncStatusMsg('Webhook URL ထည့်ပါ');
      return;
    }
    setSyncBusy(true);
    setSyncStatusMsg('ပို့ရန်ကျန်ဒေတာများ ပို့နေသည်…');
    const res = await log.retryPendingNow();
    setSyncBusy(false);
    if (res.ok) {
      setSyncStatusMsg(res.count === 0 ? '✔ ပို့ရန်ကျန်သော မှတ်တမ်းမရှိပါ' : `✔ မှတ်တမ်း ${res.count} ခု Google Sheet သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ!`);
    } else {
      setSyncStatusMsg(`❌ မအောင်မြင်ပါ: ${res.error ?? 'အင်တာနက်စစ်ပါ'}`);
    }
  }

  async function handleSyncAllNow() {
    if (!webhookUrl.trim()) {
      setSyncStatusMsg('Webhook URL ထည့်ပါ');
      return;
    }
    setSyncBusy(true);
    setSyncStatusMsg('ဒေတာအားလုံး ပို့နေသည်…');
    const res = await log.syncAllNow();
    setSyncBusy(false);
    if (res.ok) {
      setSyncStatusMsg(`✔ မှတ်တမ်းအားလုံး (${res.count} ခု) Google Sheet သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ!`);
    } else {
      setSyncStatusMsg(`❌ ပို့၍မရပါ: ${res.error ?? 'အင်တာနက် သို့မဟုတ် Webhook စစ်ပါ'}`);
    }
  }

  function copyScriptCode() {
    navigator.clipboard?.writeText(SYNC_WEBHOOK_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  }

  function sendEmailReport() {
    const emailTo = 'khinelintun91@gmail.com';
    const subject = encodeURIComponent('အဖေ့သွေးမှတ်တမ်း အနှစ်ချုပ်');
    const recentReadings = log.readings.slice(-10).map((r) => {
      const time = new Date(r.recordedAt).toLocaleString('my-MM', { timeZone: 'Asia/Yangon' });
      const val = r.type === 'glucose' ? `${r.glucoseValue} ${r.glucoseUnit}` : `${r.systolic}/${r.diastolic} mmHg (HR: ${r.pulse || '-'})`;
      return `- ${time}: ${val} (${r.notes || 'မှတ်ချက်မရှိ'})`;
    }).join('\n');
    const body = encodeURIComponent(`အဖေ့ကျန်းမာရေး မှတ်တမ်း နောက်ဆုံးရလဒ်များ:\n\n${recentReadings}\n\nစုစုပေါင်း မှတ်တမ်း: ${log.readings.length} ခု`);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  }

  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const payload = backupPayload(log.readings, log.medications);
    download(payload.name, payload.json, 'application/json');
  }

  async function onFile(file: File | undefined) {
    setReplaceArmed(false);
    setMessage(null);
    setMessageTone('warning');
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setPreview(null);
      setMessage('ဖိုင်ကြီးလွန်းသည်။ JSON ဘက်အပ်ကိုသာ လက်ခံသည်။');
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setPreview(null);
      setMessage('JSON မဖတ်နိုင်ပါ။');
      return;
    }
    const result = readImport(json);
    if (!result.ok) {
      setPreview(null);
      setMessage(importError(result.code));
      return;
    }
    const plan = planImport(log.readings, result.readings);
    const replacement = planImport([], result.readings).accepted;
    setPreview({
      fileName: file.name,
      result,
      accepted: plan.accepted,
      updates: plan.updates,
      duplicateCount: plan.duplicates.length,
      replacement,
      medications: result.medications,
    });
  }

  function confirm(mode: 'merge' | 'replace') {
    if (!preview) return;
    const ok = log.importReadings(
      mode === 'replace'
        ? { accepted: preview.replacement, updates: [], medications: preview.medications }
        : { accepted: preview.accepted, updates: preview.updates, medications: preview.medications },
      mode,
    );
    if (ok) {
      setMessageTone('info');
      setMessage(
        mode === 'merge'
          ? importResultSummary(preview.accepted.length, preview.duplicateCount, preview.updates.length)
          : `လက်ရှိမှတ်တမ်းအစား ${preview.replacement.length} ခု ထည့်ပြီးပါပြီ။`,
      );
      setPreview(null);
      setReplaceArmed(false);
    }
  }

  function addMedication() {
    if (medName.trim() === '') return;
    if (log.addMedication({ name: medName, dose: medDose, notes: '' })) {
      setMedName('');
      setMedDose('');
      setMedMessage('ထည့်ပြီးပါပြီ။');
      setTimeout(() => setMedMessage(null), 3000);
    }
  }

  const isConfigured = Boolean(webhookUrl.trim());

  return (
    <div className="stack more-view">
      <h2 className="view-title">ပိုမို</h2>

      {/* 1. Google Sheets Auto-Sync (Cloud Backup) */}
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><CloudIcon /></span>
          <div>
            <h3 style={{ margin: 0 }}>Google Sheets Auto-Sync</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
              ဖုန်းထဲက ဒေတာများကို Google Sheet သို့ အလိုအလျောက် ပို့ပေးပါသည်
            </p>
          </div>
        </div>

        {/* Sync Summary Dashboard Box */}
        <div className="sync-diag-box">
          <div className="diag-stat-row">
            <div className="diag-stat-tile">
              <span className="diag-stat-label">Pending (ပို့ရန်ကျန်)</span>
              <strong className={`diag-stat-value ${log.syncStats.pendingCount > 0 ? 'text-warning' : 'text-success'}`}>
                {log.syncStats.pendingCount > 0 ? `⏳ ${log.syncStats.pendingCount} ခု` : '✔ မရှိပါ'}
              </strong>
            </div>
            <div className="diag-stat-tile">
              <span className="diag-stat-label">နောက်ဆုံး အောင်မြင်ချိန်</span>
              <strong className="diag-stat-value">
                {formatSyncTimestamp(log.syncStats.lastSuccessTime)}
              </strong>
            </div>
          </div>

          <div className="diag-mini-breakdown">
            <span>စုစုပေါင်း: <strong>{log.syncStats.totalReadings}</strong> ခု</span>
            <span>•</span>
            <span className="text-success">ရောက်ရှိပြီး: <strong>{log.syncStats.syncedCount}</strong></span>
            {log.syncStats.failedCount > 0 ? (
              <>
                <span>•</span>
                <span className="text-danger">မအောင်မြင်: <strong>{log.syncStats.failedCount}</strong></span>
              </>
            ) : null}
          </div>

          {syncStatusMsg ? (
            <p className="banner info" role="status" style={{ margin: 0 }}>{syncStatusMsg}</p>
          ) : null}

          {/* Primary Action Button */}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={syncBusy || !isConfigured || (log.syncStats.pendingCount === 0 && log.syncStats.failedCount === 0)}
            onClick={handleRetryPending}
          >
            {syncBusy ? 'ပို့နေသည်…' : '🔄 ပို့ရန်ကျန်ဒေတာ ပြန်ပို့မည် (Retry)'}
          </button>

          {/* Secondary Quick Buttons */}
          <div className="btn-grid-2">
            <button
              type="button"
              className="btn btn-quiet"
              disabled={syncBusy || !isConfigured || log.readings.length === 0}
              onClick={handleSyncAllNow}
            >
              ဒေတာအားလုံး ပြန်ပို့မည် ({log.readings.length})
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setShowDiagModal(true)}
            >
              စစ်ဆေးမှု အပြည့်အစုံ
            </button>
          </div>
        </div>

        {/* Webhook Configuration - Crisp visible inputs */}
        <label className="field">
          <span className="field-title-sm">Google Apps Script Webhook URL</span>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </label>

        {/* Auto-Sync Toggle Row */}
        <label className="sync-toggle-row">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
          <span>တိုင်းတာမှုအသစ် ထည့်ပြီးတိုင်း Google Sheet သို့ အလိုအလျောက် ပို့မည် (Auto-Sync)</span>
        </label>

        <div className="btn-grid-2">
          <button type="button" className="btn btn-primary" onClick={handleSaveSync}>
            ဆက်တင်သိမ်းမည်
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={syncBusy || !isConfigured}
            onClick={handleTestWebhook}
          >
            {syncBusy ? 'စစ်ဆေးနေ…' : 'ချိတ်ဆက်မှု စမ်းသပ်မည်'}
          </button>
        </div>

        {/* Collapsible Apps Script Help */}
        <button
          type="button"
          className="btn btn-quiet btn-small"
          onClick={() => setShowScriptHelp(!showScriptHelp)}
        >
          {showScriptHelp ? '▲ Google Sheet သတ်မှတ်ပုံ ပိတ်မည်' : '▼ Google Sheet Webhook ပြုလုပ်နည်း (၃ မိနစ်)'}
        </button>

        {showScriptHelp ? (
          <div className="stack help-box" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
            <h4 style={{ margin: '4px 0', fontSize: '14px' }}>Google Sheets တွင် Webhook ပြုလုပ်နည်း အဆင့်ဆင့်</h4>
            <ol className="help-steps" style={{ paddingLeft: '18px', lineHeight: '1.6', fontSize: '13px', margin: '4px 0' }}>
              <li>မိမိ Google Drive တွင် Google Sheet အသစ်တစ်ခု ဖွင့်ပါ။</li>
              <li>အပေါ် Menu မှ <strong>Extensions &gt; Apps Script</strong> ကို နှိပ်ပါ။</li>
              <li>ရှိနေသော ကုဒ်များကို ဖျက်ပြီး အောက်ပါ ကုဒ်ကို ကူးထည့်ပါ:</li>
            </ol>
            <div style={{ position: 'relative' }}>
              <pre className="script-code-block" style={{ background: '#e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '160px' }}>
                {SYNC_WEBHOOK_SCRIPT_TEMPLATE}
              </pre>
              <button
                type="button"
                className="btn btn-small btn-primary"
                style={{ marginTop: '8px', width: '100%' }}
                onClick={copyScriptCode}
              >
                {copiedScript ? '✔ ကူးယူပြီးပါပြီ' : '📋 ကုဒ်အားလုံး ကူးယူမည်'}
              </button>
            </div>
            <ol start={4} className="help-steps" style={{ paddingLeft: '18px', lineHeight: '1.6', fontSize: '13px', margin: '4px 0' }}>
              <li>ညာဘက်အပေါ်ရှိ <strong>Deploy &gt; New deployment</strong> ကို နှိပ်ပါ။</li>
              <li>Select type ဘေးရှိ ဂီယာပုံစံမှ <strong>Web app</strong> ကို ရွေးပါ။</li>
              <li><strong>Who has access: Anyone</strong> (အရေးကြီးသည်) ဟု ရွေးပြီး <strong>Deploy</strong> နှိပ်ပါ။</li>
              <li>ရရှိလာသော Web app URL ကို ကူးယူပြီး အထက်ပါ ကွက်လပ်တွင် ထည့်ပါ။</li>
            </ol>
          </div>
        ) : null}
      </section>

      {/* 2. Google Drive / Phone JSON Backup & Restore */}
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><DownloadIcon /></span>
          <div>
            <h3 style={{ margin: 0 }}>ဖိုင်ဘက်အပ် (Google Drive / ဖုန်းထဲ သိမ်းရန်)</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
              မှတ်တမ်းအားလုံးကို JSON ဖိုင်အဖြစ် Google Drive သို့မဟုတ် ဖုန်းထဲ သိမ်းဆည်းနိုင်ပြီး အချိန်မရွေး ပြန်သွင်းနိုင်ပါသည်
            </p>
          </div>
        </div>

        <div className="btn-grid-2">
          <button type="button" className="btn btn-quiet" onClick={exportJson}>
            <DownloadIcon />
            JSON ဘက်အပ် ဒေါင်းလုဒ်
          </button>
          <label className="btn btn-quiet upload-tile-btn">
            <UploadIcon />
            <span>ဘက်အပ် ပြန်သွင်းမည်</span>
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
        </div>

        {preview?.result.ok ? (
          <div className="stack" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px' }}>
            <p className="file-pill" style={{ margin: 0 }}><DocIcon />{preview.fileName}</p>
            <p className="banner info" role="status" style={{ margin: 0 }}>
              {importPreviewSummary(preview.accepted.length, preview.duplicateCount, preview.updates.length)}
              {preview.result.rejected.length > 0 ? ` ပယ်ထားသော ${preview.result.rejected.length} ခု ပါသည်။` : ''}
              {preview.medications.length > 0 ? ` ဆေးဝါးစာရင်း ${preview.medications.length} ခု ပါမည်။` : ''}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={preview.accepted.length + preview.updates.length === 0}
              onClick={() => confirm('merge')}
            >
              ပေါင်းထည့်မည် (Merge)
            </button>
            <label className="replace-row" style={{ marginTop: '4px' }}>
              <input type="checkbox" checked={replaceArmed} onChange={(event) => setReplaceArmed(event.target.checked)} />
              <span>လက်ရှိမှတ်တမ်းအားလုံးကို ဖျက်ပြီး အစားထိုးမည်ကို နားလည်ပါသည်</span>
            </label>
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={!replaceArmed}
              onClick={() => confirm('replace')}
            >
              အစားထိုးမည် (Replace All)
            </button>
          </div>
        ) : null}
        {message ? <p id="import-summary" className={`banner ${messageTone}`} role="status">{message}</p> : null}
      </section>

      {/* 3. Doctor's Summary Report & Gmail Report */}
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><DocIcon /></span>
          <div>
            <h3 style={{ margin: 0 }}>အစီရင်ခံစာများ</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
              ဆရာဝန်ပြသရန် စာရွက်နှင့် Gmail သို့ အနှစ်ချုပ် ပေးပို့ခြင်း
            </p>
          </div>
        </div>
        <div className="btn-grid-2">
          <button type="button" className="btn btn-primary" onClick={onPrint}>
            ဆရာဝန်အတွက် စာရွက်<ArrowRightIcon />
          </button>
          <button type="button" className="btn btn-quiet" onClick={sendEmailReport}>
            ✉ Gmail သို့ ပို့မည်
          </button>
        </div>
      </section>

      {/* 4. Medications List (Compact) */}
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><PillIcon /></span>
          <div>
            <h3 style={{ margin: 0 }}>ဆေးဝါးစာရင်း</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>
              ဆရာဝန်အတွက် စာရွက်တွင် ပြသမည့် သောက်ဆေးများ
            </p>
          </div>
        </div>

        {log.medications.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '13px' }}>ဆေးဝါးစာရင်း မရှိသေးပါ။</p>
        ) : (
          <ul className="med-list">
            {log.medications.map((medication) => (
              <li key={medication.id} className="med-row">
                <span className="med-icon" aria-hidden="true"><PillIcon /></span>
                <span className="med-text">
                  <span className="med-name">{medication.name}</span>
                  {medication.dose ? <span className="med-detail"> — {medication.dose}</span> : ''}
                  {medication.notes ? <span className="med-detail"> ({medication.notes})</span> : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-small btn-quiet-danger"
                  aria-label={`${medication.name} ကို ဖယ်မည်`}
                  onClick={() => log.removeMedication(medication.id)}
                >
                  ဖယ်မည်
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid-2-fields">
          <label className="field" style={{ margin: 0 }}>
            <span className="field-title-sm">ဆေးအမည်</span>
            <input value={medName} onChange={(event) => setMedName(event.target.value)} autoComplete="off" placeholder="Metformin" />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-title-sm">ပမာဏ / သောက်ပုံ</span>
            <input value={medDose} onChange={(event) => setMedDose(event.target.value)} autoComplete="off" placeholder="500 mg · မနက် ၁ လုံး" />
          </label>
        </div>
        <button type="button" className="btn btn-quiet" disabled={medName.trim() === ''} onClick={addMedication}>
          <PlusIcon />ဆေးထည့်မည်
        </button>
        {medMessage ? <p className="status-pill" role="status">{medMessage}</p> : null}
      </section>

      {/* 5. Clear Data (Danger Zone) */}
      <section className="card stack danger-zone">
        <div className="more-head">
          <span className="icon-well icon-well-lg icon-well-danger" aria-hidden="true"><TrashIcon /></span>
          <div>
            <h3 style={{ margin: 0 }}>Data အကုန်ရှင်း</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '13px' }}>ဖုန်းထဲရှိ မှတ်တမ်းအားလုံးကို ဖျက်ခြင်း</p>
          </div>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => { setClearMessage(null); setClearOpen(true); }}>
          <TrashIcon />မှတ်တမ်းအားလုံး ဖျက်မည်
        </button>
      </section>

      {/* Clear Modal */}
      {clearOpen ? (
        <Modal title="မှတ်တမ်းအားလုံး ဖျက်မည်လား" onClose={() => setClearOpen(false)}>
          <div className="stack">
            <p>ဖုန်းထဲရှိ သွေးမှတ်တမ်းများနှင့် ဆေးဝါးစာရင်း အားလုံး ပျက်သွားပါမည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။</p>
            {clearMessage ? <p className="banner warning">{clearMessage}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setClearOpen(false)}>
                မဖျက်ပါ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const ok = log.clearMainData();
                  if (ok) setClearOpen(false);
                  else setClearMessage('ဖျက်၍မရပါ');
                }}
              >
                သေချာသည် ဖျက်မည်
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Sync Diagnostics Modal */}
      {showDiagModal ? (
        <SyncDiagnosticsModal onClose={() => setShowDiagModal(false)} />
      ) : null}
    </div>
  );
}

function importError(code: string): string {
  switch (code) {
    case 'empty':
      return 'မှတ်တမ်း မပါပါ။';
    case 'invalid':
      return 'ဖိုင်ဖော်မတ် မမှန်ပါ။';
    default:
      return 'ဖိုင်ဖတ်၍ မရပါ။';
  }
}

function MoreIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function CloudIcon() {
  return (
    <MoreIcon>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
    </MoreIcon>
  );
}

function DownloadIcon() {
  return (
    <MoreIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </MoreIcon>
  );
}

function UploadIcon() {
  return (
    <MoreIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </MoreIcon>
  );
}

function DocIcon() {
  return (
    <MoreIcon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </MoreIcon>
  );
}

function PillIcon() {
  return (
    <MoreIcon>
      <line x1="10.5" y1="13.5" x2="13.5" y2="10.5" />
      <path d="m8.5 8.5 7 7a4.95 4.95 0 0 0 7-7l-7-7a4.95 4.95 0 0 0-7 7Z" />
    </MoreIcon>
  );
}

function PlusIcon() {
  return (
    <MoreIcon>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </MoreIcon>
  );
}

function ArrowRightIcon() {
  return (
    <MoreIcon>
      <polyline points="9 18 15 12 9 6" />
    </MoreIcon>
  );
}
