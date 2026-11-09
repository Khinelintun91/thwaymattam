import { useState } from 'react';
import { Modal, TrashIcon } from '../components/Modal.tsx';
import { importPreviewSummary, importResultSummary, planImport, readImport, type ImportReadResult } from '../domain/backup.ts';
import { backupPayload } from '../domain/share.ts';
import { toCsv } from '../domain/csv.ts';
import type { Medication, Reading } from '../domain/types.ts';
import { ShareBackupButton } from '../components/ShareBackup.tsx';
import { useLog } from '../store/LogProvider.tsx';

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
    <div className="stack">
      <h2>ပိုမို</h2>
      <section className="card stack" id="share-backup">
        <h3>ဖုန်းတစ်လုံးဆီ ပို့ရန်</h3>
        <p>မှတ်တမ်းတစ်ခုလုံးကို JSON ဖိုင်အဖြစ် ပို့သည်။ ဖုန်းက မျှဝေစာမျက်နှာ ပေးလျှင် Viber သို့မဟုတ် Telegram ကို ရွေးပါ။ မပေးလျှင် ဖိုင်ကို ဒေါင်းလုဒ်လုပ်ပါသည်။ အလိုအလျောက် ချိန်ကိုက်ခြင်း မရှိပါ။</p>
        <ShareBackupButton />
      </section>
      <section className="card stack">
        <h3>ဘက်အပ်</h3>
        <p>JSON သည် ပြန်သွင်းရန်ဖြစ်သည်။ ပုံမှန်အားဖြင့် ပေါင်းထည့်သည်။ တူညီသော မှတ်တမ်းကို ဒုတိယအကြိမ် သွင်းလျှင် ထပ်မတည်ပါ။ CSV သည် ဇယားကြည့်ရန်ဖြစ်ပြီး ဖော်မြူလာအဖြစ် မဖွင့်အောင် ရှေ့တွင် အပေါစထရိုဖီထည့်ထားသည်။</p>
        <div className="row">
          <button type="button" className="btn btn-quiet" onClick={exportJson}>JSON ဒေါင်းလုဒ်</button>
          <button type="button" className="btn btn-quiet" onClick={exportCsv}>CSV ထုတ်မည်</button>
        </div>
        <label className="btn btn-quiet">
          JSON သွင်းမည်
          <input className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void onFile(event.target.files?.[0])} />
        </label>
        {preview?.result.ok ? (
          <div className="stack">
            <p>{preview.fileName}</p>
            <p className="banner info" role="status">{importPreviewSummary(preview.accepted.length, preview.duplicateCount, preview.updates.length)}{preview.result.rejected.length > 0 ? ` ပယ်ထားသော ${preview.result.rejected.length} ခု ပါသည်။` : ''}{preview.medications.length > 0 ? ` ဆေးဝါးစာရင်း ${preview.medications.length} ခု ပါမည်။` : ''}</p>
            {preview.result.rejected.length > 0 ? (
              <ul>
                {preview.result.rejected.slice(0, 8).map((row) => (
                  <li key={row.index}>အတန်း {row.index + 1}: {row.errors.map((issue) => issue.code).join(', ')}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="btn btn-primary" disabled={preview.accepted.length + preview.updates.length === 0} onClick={() => confirm('merge')}>ပေါင်းထည့်မည်</button>
            <label className="field">
              <span>
                <input type="checkbox" checked={replaceArmed} onChange={(event) => setReplaceArmed(event.target.checked)} /> လက်ရှိမှတ်တမ်းအားလုံးကို ဖျက်ပြီး အစားထိုးမည်ကို နားလည်ပါသည်
              </span>
            </label>
            <button type="button" className="btn btn-danger" disabled={!replaceArmed} onClick={() => confirm('replace')}>အစားထိုးမည်</button>
          </div>
        ) : null}
        {message ? <p id="import-summary" className={`banner ${messageTone}`} role="status">{message}</p> : null}
      </section>
      <section className="card stack">
        <h3>ဆရာဝန်အတွက် စာရွက်</h3>
        <button type="button" className="btn btn-primary" onClick={onPrint}>အနှစ်ချုပ် ပြင်ဆင်မည်</button>
      </section>
      <section className="card stack">
        <h3>ဆေးဝါးစာရင်း</h3>
        <p>ဆရာဝန်အတွက် အနှစ်ချုပ်တွင် ပြမည်။ ဖုန်းထဲမှာပဲ သိမ်းသည်။ ဆေးပမာဏကို ဤအက်ပ်က မညွှန်ပါ။</p>
        {log.medications.length === 0 ? (
          <p>ဆေးဝါးစာရင်း မရှိပါ။</p>
        ) : (
          <ul>
            {log.medications.map((medication) => (
              <li key={medication.id} className="spread">
                <span>
                  {medication.name}
                  {medication.dose ? ` — ${medication.dose}` : ''}
                  {medication.notes ? ` (${medication.notes})` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
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
        <button type="button" className="btn btn-primary" disabled={medName.trim() === ''} onClick={addMedication}>ထည့်မည်</button>
        {medMessage ? <p role="status">{medMessage}</p> : null}
      </section>
      {log.demo ? (
        <section className="card stack">
          <h3>data အကုန် ရှင်း</h3>
          <p>နမူနာခန်းမှာ ရှိနေသည်။ ပင်မမှတ်တမ်း data ရှင်းရန် ပင်မမှတ်တမ်းသို့ ပြန်ပါ။</p>
        </section>
      ) : (
        <section className="card stack danger-zone">
          <h3>data အကုန် ရှင်း</h3>
          <p>ပင်မမှတ်တမ်း {log.readings.length} ခု နှင့် ဆေးဝါးစာရင်း {log.medications.length} မျိုး ကို အကုန် ဖျက်မည်။ ဖျက်ပြီးရင် ပြန်မရပါ။ မဖျက်ခင် JSON ဘက်အပ် ထုတ်ထားပါ။</p>
          <button
            type="button"
            className="btn btn-danger"
            disabled={log.readings.length === 0 && log.medications.length === 0}
            onClick={() => setClearOpen(true)}
          >
            data အကုန် ရှင်းမည်
          </button>
          {clearMessage ? <p role="status">{clearMessage}</p> : null}
        </section>
      )}
      {clearOpen ? (
        <Modal title="data အကုန် ရှင်းမည်" titleIcon={<TrashIcon />} onClose={() => setClearOpen(false)}>
          <p>ပင်မမှတ်တမ်း {log.readings.length} ခု နှင့် ဆေးဝါးစာရင်း {log.medications.length} မျိုး ကို အကုန် ဖျက်မည်။ ဖျက်ပြီးရင် ပြန်မရပါ။</p>
          <p>JSON ဘက်အပ် ထုတ်ထားပြီးပြီလား။</p>
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
        <h3>နမူနာ</h3>
        <p>နမူနာသည် သီးခြားသိမ်းဆည်းမှုဖြစ်ပြီး တကယ်လူနာမှတ်တမ်းမဟုတ်ပါ။ ပင်မမှတ်တမ်းကို မဖျက်ပါ။</p>
        <button type="button" className="btn btn-quiet" onClick={() => log.setDemo(!log.demo)}>
          {log.demo ? 'ပင်မမှတ်တမ်းသို့ ပြန်မည်' : 'နမူနာကြည့်မည်'}
        </button>
      </section>
      <section className="card stack">
        <h3>သိုလှောင်မှု</h3>
        <p>မှတ်တမ်း {log.readings.length} ခု{log.byteSize != null ? ` · ခန့်မှန်း ${log.byteSize} ဘိုက်` : ''}။ {log.demo ? 'နမူနာခန်း' : 'ပင်မခန်း'}။</p>
        <p>ဒေတာသည် ဤဘရောက်ဇာထဲတွင် ရှိသည်။ အခြားဖုန်းသို့ JSON ဖိုင်ကို ကိုယ်တိုင်ပို့မှ ရောက်သည်။ အလိုအလျောက် ချိန်ကိုက်ခြင်း၊ အဝေးမှ စောင့်ကြည့်ခြင်း မရှိပါ။ ဘရောက်ဇာဒေတာဖျက်လျှင် မှတ်တမ်းပါ ပျောက်သည်။</p>
        {log.loadError === 'corrupt' && log.rawBackup ? (
          <button type="button" className="btn btn-quiet" onClick={() => download('thwaymattam-raw.txt', log.rawBackup ?? '', 'text/plain')}>ပျက်နေသောစာသား ထုတ်မည်</button>
        ) : null}
      </section>
      <section className="card stack">
        <h3>အော့ဖ်လိုင်း</h3>
        <p>ပထမအကြိမ် ဖွင့်သောအခါ အက်ပ်နှင့် ဖောင့်ကို ဤစက်ထဲသို့ ရယူသည်။ ထို့နောက် မှတ်တမ်းတင်ခြင်းသည် အင်တာနက်မလိုပါ။ နံပါတ်ကို ဆာဗာသို့ မပို့ပါ။</p>
      </section>
      <section className="card stack">
        <h3>ဤအက်ပ်အကြောင်း</h3>
        <p>သွေးမှတ်တမ်းသည် ကိုယ်တိုင်သုံးသော ဂလူးကို့စ်နှင့် သွေးပေါင် မှတ်စုဖြစ်သည်။ အချိန်ကို မြန်မာစံတော်ချိန် Asia/Rangoon (UTC+6:30) ဖြင့် ပြသည်။</p>
        <p>ရောဂါမရှာပါ။ အင်ဆူလင် သို့မဟုတ် ဆေးပမာဏ မညွှန်ပါ။ မသိသော အစာစားချိန်ကို ပုံမှန်ဟု မပြပါ။</p>
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
