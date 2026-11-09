import { useState } from 'react';
import { backupPayload, shareBackupFile, type ShareOutcome } from '../domain/share.ts';
import type { Reading } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function outcomeText(outcome: ShareOutcome, name: string): string {
  if (outcome === 'shared') return 'မျှဝေစာမျက်နှာ ဖွင့်ပြီးပါပြီ။ Viber သို့မဟုတ် Telegram ကို ရွေးပါ။';
  if (outcome === 'cancelled') return 'မပို့တော့ပါ။ မှတ်တမ်းကို မပြောင်းပါ။';
  return `${name} ကို ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ။ ထိုဖိုင်ကို Viber သို့မဟုတ် Telegram ဖြင့် ပို့ပါ။`;
}

export function ShareBackupButton({ readings }: { readings?: Reading[] }) {
  const log = useLog();
  const source = readings ?? log.readings;
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    const payload = backupPayload(source, log.medications);
    const file = new File([payload.json], payload.name, { type: 'application/json' });
    const outcome = await shareBackupFile(file, {
      target: typeof navigator === 'undefined' ? undefined : navigator,
      download: downloadFile,
    });
    setMessage(outcomeText(outcome, payload.name));
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-primary btn-block btn-share" onClick={() => void share()}>
        <ShareIcon />
        ဖုန်းတစ်လုံးဆီ ပို့ရန်
      </button>
      {message ? <p className="banner info banner-compact" role="status">{message}</p> : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
