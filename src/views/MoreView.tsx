import { useState } from 'react';
import { Modal, TrashIcon, InfoIcon } from '../components/Modal.tsx';
import { importPreviewSummary, importResultSummary, planImport, readImport, type ImportReadResult } from '../domain/backup.ts';
import { backupPayload } from '../domain/share.ts';
import { toCsv } from '../domain/csv.ts';
import type { Medication, Reading } from '../domain/types.ts';
import { ShareBackupButton } from '../components/ShareBackup.tsx';
import { useLog } from '../store/LogProvider.tsx';
import { SYNC_WEBHOOK_SCRIPT_TEMPLATE, testWebhookConnection } from '../domain/sync.ts';

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
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medMessage, setMedMessage] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(log.syncConfig.webhookUrl);
  const [autoSync, setAutoSync] = useState(log.syncConfig.autoSync);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);


  async function handleSaveSync() {
    log.updateSyncConfig({ webhookUrl: webhookUrl.trim(), autoSync });
    setSyncStatusMsg('Sync ဆက်တင် သိမ်းဆည်းပြီးပါပြီ။');
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
      setSyncStatusMsg('✔ Google Sheet သို့ ချိတ်ဆက်မှု အောင်မြင်ပါသည်!');
    } else {
      setSyncStatusMsg(`❌ ချိတ်ဆက်၍မရပါ: ${res.error ?? 'Unknown error'}`);
    }
  }

  async function handleSyncAllNow() {
    if (!webhookUrl.trim()) {
      setSyncStatusMsg('Webhook URL ထည့်ပါ');
      return;
    }
    setSyncBusy(true);
    setSyncStatusMsg('ဒေတာများ ပို့နေသည်…');
    const res = await log.syncAllNow();
    setSyncBusy(false);
    if (res.ok) {
      setSyncStatusMsg(`✔ မှတ်တမ်း ${res.count} ခု Google Sheet သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ!`);
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

  function addMedication() {
    if (medName.trim() === '') return;
    if (log.addMedication({ name: medName, dose: medDose, notes: '' })) {
      setMedName('');
      setMedDose('');
      setMedMessage('ထည့်ပြီးပါပြီ။');
    }
  }

  function exportCsv() {
    download(`thwaymattam-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(log.readings), 'text/csv;charset=utf-8');
  }

  async function onFile(file: File | undefined) {
    setReplaceArmed(false);
    setMessage(null);
    setMessageTone('warning');
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setPreview(null);
      setMessage('ဖိုင်ကြီးလွန်းသည်။ ဓာတ်ပုံမပါသော JSON ဘက်အပ်ကိုသာ လက်ခံသည်။');
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

  return (
    <div className="stack more-view">
      <h2>ပိုမို</h2>
      <section className="card stack" id="share-backup">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><ShareIcon /></span>
          <h3>ဖုန်းတစ်လုံးဆီ ပို့ရန်</h3>
        </div>
        <p className="more-explainer">မှတ်တမ်းတစ်ခုလုံးကို JSON ဖိုင်အဖြစ် ပို့သည်။ ဖုန်းက မျှဝေစာမျက်နှာ ပေးလျှင် Viber သို့မဟုတ် Telegram ကို ရွေးပါ။ မပေးလျှင် ဖိုင်ကို ဒေါင်းလုဒ်လုပ်ပါသည်။ အလိုအလျောက် ချိန်ကိုက်ခြင်း မရှိပါ။</p>
        <ShareBackupButton />
      </section>
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><CloudIcon /></span>
          <h3>ဘက်အပ်</h3>
        </div>
        <p className="more-explainer">JSON သည် ပြန်သွင်းရန်ဖြစ်သည်။ ပုံမှန်အားဖြင့် ပေါင်းထည့်သည်။ တူညီသော မှတ်တမ်းကို ဒုတိယအကြိမ် သွင်းလျှင် ထပ်မတည်ပါ။ CSV သည် ဇယားကြည့်ရန်ဖြစ်ပြီး ဖော်မြူလာအဖြစ် မဖွင့်အောင် ရှေ့တွင် အပေါစထရိုဖီထည့်ထားသည်။</p>
        <div className="row">
          <button type="button" className="btn btn-quiet" onClick={exportJson}><DownloadIcon />JSON ဒေါင်းလုဒ်</button>
          <button type="button" className="btn btn-quiet" onClick={exportCsv}><DownloadIcon />CSV ထုတ်မည်</button>
        </div>
        <label className="upload-tile">
          <UploadIcon />
          <span>JSON သွင်းမည်</span>
          <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void onFile(event.target.files?.[0])} />
        </label>
        {preview?.result.ok ? (
          <div className="stack">
            <p className="file-pill"><DocIcon />{preview.fileName}</p>
            <p className="banner info" role="status">{importPreviewSummary(preview.accepted.length, preview.duplicateCount, preview.updates.length)}{preview.result.rejected.length > 0 ? ` ပယ်ထားသော ${preview.result.rejected.length} ခု ပါသည်။` : ''}{preview.medications.length > 0 ? ` ဆေးဝါးစာရင်း ${preview.medications.length} ခု ပါမည်။` : ''}</p>
            {preview.result.rejected.length > 0 ? (
              <ul className="rejected-list">
                {preview.result.rejected.slice(0, 8).map((row) => (
                  <li key={row.index}>အတန်း {row.index + 1}: {row.errors.map((issue) => issue.code).join(', ')}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="btn btn-primary" disabled={preview.accepted.length + preview.updates.length === 0} onClick={() => confirm('merge')}>ပေါင်းထည့်မည်</button>
            <label className="replace-row">
              <input type="checkbox" checked={replaceArmed} onChange={(event) => setReplaceArmed(event.target.checked)} />
              <span>လက်ရှိမှတ်တမ်းအားလုံးကို ဖျက်ပြီး အစားထိုးမည်ကို နားလည်ပါသည်</span>
            </label>
            <button type="button" className="btn btn-danger" disabled={!replaceArmed} onClick={() => confirm('replace')}>အစားထိုးမည်</button>
          </div>
        ) : null}
        {message ? <p id="import-summary" className={`banner ${messageTone}`} role="status">{message}</p> : null}
      </section>
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><DocIcon /></span>
          <h3>ဆရာဝန်အတွက် စာရွက်</h3>
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={onPrint}>အနှစ်ချုပ် ပြင်ဆင်မည်<ArrowRightIcon /></button>
      </section>
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><PillIcon /></span>
          <h3>ဆေးဝါးစာရင်း</h3>
        </div>
        <p className="more-explainer">ဆရာဝန်အတွက် အနှစ်ချုပ်တွင် ပြမည်။ ဖုန်းထဲမှာပဲ သိမ်းသည်။ ဆေးပမာဏကို ဤအက်ပ်က မညွှန်ပါ။</p>
        {log.medications.length === 0 ? (
          <p className="med-empty">ဆေးဝါးစာရင်း မရှိပါ။</p>
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
        <label className="field">ဆေးအမည်
          <input value={medName} onChange={(event) => setMedName(event.target.value)} autoComplete="off" placeholder="ဥပမာ Metformin" />
        </label>
        <label className="field">ပမာဏ / သောက်ပုံ (မထည့်လည်းရ)
          <input value={medDose} onChange={(event) => setMedDose(event.target.value)} autoComplete="off" placeholder="ဥပမာ 500 mg · မနက် ၁ လုံး" />
        </label>
        <button type="button" className="btn btn-primary" disabled={medName.trim() === ''} onClick={addMedication}><PlusIcon />ထည့်မည်</button>
        {medMessage ? <p className="status-pill" role="status">{medMessage}</p> : null}
      </section>
      {log.demo ? (
        <section className="card stack">
          <div className="more-head">
            <span className="icon-well icon-well-lg icon-well-danger" aria-hidden="true"><TrashIcon /></span>
            <h3>data အကုန် ရှင်း</h3>
          </div>
          <p className="banner info">နမူနာခန်းမှာ ရှိနေသည်။ ပင်မမှတ်တမ်း data ရှင်းရန် ပင်မမှတ်တမ်းသို့ ပြန်ပါ။</p>
        </section>
      ) : (
        <section className="card stack danger-zone">
          <div className="more-head">
            <span className="icon-well icon-well-lg icon-well-danger" aria-hidden="true"><TrashIcon /></span>
            <h3>data အကုန် ရှင်း</h3>
          </div>
          <p className="danger-count">ပင်မမှတ်တမ်း {log.readings.length} ခု နှင့် ဆေးဝါးစာရင်း {log.medications.length} မျိုး ကို အကုန် ဖျက်မည်။ ဖျက်ပြီးရင် ပြန်မရပါ။ မဖျက်ခင် JSON ဘက်အပ် ထုတ်ထားပါ။</p>
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={log.readings.length === 0 && log.medications.length === 0}
            onClick={() => setClearOpen(true)}
          >
            data အကုန် ရှင်းမည်
          </button>
          {clearMessage ? <p className="status-pill" role="status">{clearMessage}</p> : null}
        </section>
      )}
      {clearOpen ? (
        <Modal title="data အကုန် ရှင်းမည်" heroIcon={<WarningIcon />} onClose={() => setClearOpen(false)}>
          <p>ပင်မမှတ်တမ်း {log.readings.length} ခု နှင့် ဆေးဝါးစာရင်း {log.medications.length} မျိုး ကို အကုန် ဖျက်မည်။ ဖျက်ပြီးရင် ပြန်မရပါ။</p>
          <p className="modal-question">JSON ဘက်အပ် ထုတ်ထားပြီးပြီလား။</p>
          <div className="row">
            <button type="button" className="btn btn-quiet" onClick={() => setClearOpen(false)}>မဖျက်ပါ</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (log.clearMainData()) {
                  setClearMessage('ရှင်းပြီးပါပြီ။');
                  setClearOpen(false);
                }
              }}
            >
              အားလုံး ဖျက်မည်
            </button>
          </div>
        </Modal>
      ) : null}
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><SparkleIcon /></span>
          <h3>နမူနာ</h3>
        </div>
        <p className="more-explainer">နမူနာသည် သီးခြားသိမ်းဆည်းမှုဖြစ်ပြီး တကယ်လူနာမှတ်တမ်းမဟုတ်ပါ။ ပင်မမှတ်တမ်းကို မဖျက်ပါ။</p>
        <button type="button" className={`btn ${log.demo ? 'btn-primary' : 'btn-quiet'}`} onClick={() => log.setDemo(!log.demo)}>
          {log.demo ? 'ပင်မမှတ်တမ်းသို့ ပြန်မည်' : 'နမူနာကြည့်မည်'}
        </button>
      </section>
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><DatabaseIcon /></span>
          <h3>သိုလှောင်မှု</h3>
        </div>
        <div className="stat-row">
          <div className="stat-tile">
            <span className="stat-value">{log.readings.length} ခု</span>
            <span className="stat-label">မှတ်တမ်း</span>
          </div>
          {log.byteSize != null ? (
            <div className="stat-tile">
              <span className="stat-value">{log.byteSize} ဘိုက်</span>
              <span className="stat-label">ခန့်မှန်း</span>
            </div>
          ) : null}
          <div className="stat-tile">
            <span className="stat-value">{log.demo ? 'နမူနာခန်း' : 'ပင်မခန်း'}</span>
          </div>
        </div>
        <p className="more-explainer">ဒေတာသည် ဤဘရောက်ဇာထဲတွင် ရှိသည်။ အခြားဖုန်းသို့ JSON ဖိုင်ကို ကိုယ်တိုင်ပို့မှ ရောက်သည်။ အလိုအလျောက် ချိန်ကိုက်ခြင်း၊ အဝေးမှ စောင့်ကြည့်ခြင်း မရှိပါ။ ဘရောက်ဇာဒေတာဖျက်လျှင် မှတ်တမ်းပါ ပျောက်သည်။</p>
        {log.loadError === 'corrupt' && log.rawBackup ? (
          <button type="button" className="btn btn-quiet" onClick={() => download('thwaymattam-raw.txt', log.rawBackup ?? '', 'text/plain')}><DownloadIcon />ပျက်နေသောစာသား ထုတ်မည်</button>
        ) : null}
      </section>
      
      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><CloudIcon /></span>
          <h3>Google Sheets Auto-Sync (Cloud သိမ်းဆည်းခြင်း)</h3>
        </div>
        <p className="more-explainer">
          အင်တာနက်ရရှိချိန်တိုင်း ဖုန်းမှ ဒေတာများကို မိမိ၏ Private Google Sheet သို့ အလိုအလျောက် ပို့ပေးပါသည်။
          ဖုန်းပျက်ခြင်း၊ Browser Cache ရှင်းမိခြင်းများ ဖြစ်ပေါ်ပါက Google Sheet ထဲတွင် မှတ်တမ်းများ အပြည့်အစုံ ကျန်ရှိနေမည်ဖြစ်ပါသည်။
        </p>

        <label className="field">
          Google Apps Script Webhook URL
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
        </label>

        <label className="replace-row">
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
          <span>တိုင်းတာမှုအသစ် ထည့်ပြီးတိုင်း Google Sheet သို့ အလိုအလျောက် ပို့မည် (Auto-Sync)</span>
        </label>

        <div className="row">
          <button type="button" className="btn btn-primary" onClick={handleSaveSync}>
            ဆက်တင်သိမ်းမည်
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={syncBusy || !webhookUrl.trim()}
            onClick={handleTestWebhook}
          >
            {syncBusy ? 'စစ်ဆေးနေ…' : 'ချိတ်ဆက်မှု စမ်းသပ်မည်'}
          </button>
        </div>

        <button
          type="button"
          className="btn btn-quiet btn-block"
          disabled={syncBusy || !webhookUrl.trim() || log.readings.length === 0}
          onClick={handleSyncAllNow}
        >
          ☁ ဒေတာအားလုံး ({log.readings.length} ခု) ကို Google Sheet သို့ အခုပို့မည်
        </button>

        {syncStatusMsg ? (
          <p className="banner info" role="status">{syncStatusMsg}</p>
        ) : null}

        <button
          type="button"
          className="btn btn-quiet btn-small"
          onClick={() => setShowScriptHelp(!showScriptHelp)}
        >
          {showScriptHelp ? '▲ Google Sheet သတ်မှတ်ပုံ ပိတ်မည်' : '▼ Google Sheet သတ်မှတ်ပုံ ညွှန်ကြားချက် ကြည့်မည်'}
        </button>

        {showScriptHelp ? (
          <div className="stack help-box">
            <h4 style={{ margin: '8px 0 4px', fontSize: '15px' }}>Google Sheets တွင် Webhook ပြုလုပ်နည်း (၃ မိနစ်)</h4>
            <ol className="help-steps" style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '13px' }}>
              <li>မိမိ Google Drive တွင် Google Sheet အသစ်တစ်ခု ဖွင့်ပါ။</li>
              <li>အပေါ် Menu မှ <strong>Extensions &gt; Apps Script</strong> ကို နှိပ်ပါ။</li>
              <li>ရှိနေသော ကုဒ်များကို ဖျက်ပြီး အောက်ပါ ကုဒ်ကို ကူးထည့်ပါ:</li>
            </ol>
            <div style={{ position: 'relative' }}>
              <pre className="script-code-block" style={{ background: '#f1f5f9', padding: '12px', borderRadius: '12px', fontSize: '12px', overflowX: 'auto', maxHeight: '180px' }}>
                {SYNC_WEBHOOK_SCRIPT_TEMPLATE}
              </pre>
              <button
                type="button"
                className="btn btn-small btn-primary"
                style={{ marginTop: '8px' }}
                onClick={copyScriptCode}
              >
                {copiedScript ? '✔ ကူးယူပြီးပါပြီ' : '📋 ကုဒ်အားလုံး ကူးမည်'}
              </button>
            </div>
            <ol start={4} className="help-steps" style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '13px' }}>
              <li>ညာဘက်အပေါ်ရှိ <strong>Deploy &gt; New deployment</strong> ကို နှိပ်ပါ။</li>
              <li>Select type ဘေးရှိ ဂီယာပုံစံမှ <strong>Web app</strong> ကို ရွေးပါ။</li>
              <li><strong>Who has access: Anyone</strong> (အရေးကြီးသည်) ဟု ရွေးပြီး <strong>Deploy</strong> နှိပ်ပါ။</li>
              <li>ရရှိလာသော Web app URL ကို ကူးယူပြီး အထက်ပါ ကွက်လပ်တွင် ထည့်ပါ။</li>
            </ol>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><ShareIcon /></span>
          <h3>Gmail သို့ အစီရင်ခံစာ ပို့ရန်</h3>
        </div>
        <p className="more-explainer">
          အဖေ့သွေးမှတ်တမ်း နောက်ဆုံးအခြေအနေကို <strong>khinelintun91@gmail.com</strong> သို့ အီးမေးလ် ပေးပို့နိုင်ပါသည်။
        </p>
        <button type="button" className="btn btn-primary" onClick={sendEmailReport}>
          ✉ Gmail ဖြင့် မှတ်တမ်းအနှစ်ချုပ် ပို့မည်
        </button>
      </section>

      <section className="card stack">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><WifiOffIcon /></span>
          <h3>အော့ဖ်လိုင်း</h3>
        </div>
        <p className="more-explainer">ပထမအကြိမ် ဖွင့်သောအခါ အက်ပ်နှင့် ဖောင့်ကို ဤစက်ထဲသို့ ရယူသည်။ ထို့နောက် မှတ်တမ်းတင်ခြင်းသည် အင်တာနက်မလိုပါ။ နံပါတ်ကို ဆာဗာသို့ မပို့ပါ။</p>
      </section>
      <section className="card stack more-last">
        <div className="more-head">
          <span className="icon-well icon-well-lg" aria-hidden="true"><InfoIcon /></span>
          <h3>ဤအက်ပ်အကြောင်း</h3>
        </div>
        <p className="more-explainer">သွေးမှတ်တမ်းသည် ကိုယ်တိုင်သုံးသော ဂလူးကို့စ်နှင့် သွေးပေါင် မှတ်စုဖြစ်သည်။ အချိန်ကို မြန်မာစံတော်ချိန် Asia/Rangoon (UTC+6:30) ဖြင့် ပြသည်။</p>
        <p className="more-explainer">ရောဂါမရှာပါ။ အင်ဆူလင် သို့မဟုတ် ဆေးပမာဏ မညွှန်ပါ။ မသိသော အစာစားချိန်ကို ပုံမှန်ဟု မပြပါ။</p>
      </section>
    </div>
  );
}

function importError(code: string): string {
  switch (code) {
    case 'wrong-app':
      return 'ဤအက်ပ်၏ ဘက်အပ်ဖိုင်မဟုတ်ပါ။';
    case 'unsupported-version':
      return 'ဖိုင်ဗားရှင်းကို မဖတ်နိုင်ပါ။';
    case 'too-many':
      return 'မှတ်တမ်းအရေအတွက် များလွန်းသည်။';
    default:
      return 'ဖိုင်ပုံစံ မမှန်ပါ။';
  }
}

function MoreIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ShareIcon() {
  return (
    <MoreIcon>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </MoreIcon>
  );
}

function CloudIcon() {
  return (
    <MoreIcon>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </MoreIcon>
  );
}

function DownloadIcon() {
  return (
    <MoreIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </MoreIcon>
  );
}

function UploadIcon() {
  return (
    <MoreIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </MoreIcon>
  );
}

function DocIcon() {
  return (
    <MoreIcon>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </MoreIcon>
  );
}

function PillIcon() {
  return (
    <MoreIcon>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </MoreIcon>
  );
}

function SparkleIcon() {
  return (
    <MoreIcon>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </MoreIcon>
  );
}

function DatabaseIcon() {
  return (
    <MoreIcon>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </MoreIcon>
  );
}

function WifiOffIcon() {
  return (
    <MoreIcon>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <path d="M12 20h.01" />
      <path d="m2 2 20 20" />
    </MoreIcon>
  );
}

function WarningIcon() {
  return (
    <MoreIcon>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </MoreIcon>
  );
}

function ArrowRightIcon() {
  return (
    <MoreIcon>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </MoreIcon>
  );
}

function PlusIcon() {
  return (
    <MoreIcon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </MoreIcon>
  );
}
