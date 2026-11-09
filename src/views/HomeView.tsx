import { useState } from 'react';
import { evaluateReading } from '../domain/safety.ts';
import type { Reading } from '../domain/types.ts';
import { badgeText, noticesFor, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { SafetyList } from '../components/SafetyList.tsx';
import { latestReading } from '../domain/history.ts';
import { ShareBackupButton } from '../components/ShareBackup.tsx';
import { useLog } from '../store/LogProvider.tsx';

const WINDOW_MS = 48 * 60 * 60 * 1000;

export function HomeView({ onAdd }: { onAdd: (type: 'glucose' | 'bp') => void }) {
  const { hydrated, readings } = useLog();
  const [now] = useState(() => Date.now());
  if (!hydrated) return <p role="status">ဖွင့်နေသည်…</p>;
  const glucose = latestReading(readings, 'glucose');
  const bp = latestReading(readings, 'bp');
  const alerts = readings.flatMap((reading) => {
    const age = now - Date.parse(reading.recordedAt);
    if (age < 0 || age > WINDOW_MS) return [];
    const notices = evaluateReading(reading, readings).filter((notice) => notice.severity === 'emergency' || notice.severity === 'urgent');
    return notices.length ? [{ reading, notices }] : [];
  });

  return (
    <div className="stack">
      <p className="disclaimer">
        ဤအက်ပ်သည် ရောဂါရှာဖွေခြင်း၊ ဆေးပမာဏပြောင်းခြင်း မပြုပါ။ နံပါတ်တစ်ခုတည်းကို ပုံမှန်ဟု မသတ်မှတ်ပါ။
      </p>
      <section className="card stack">
        <h2>ဖုန်းတစ်လုံးဆီ ပို့ရန်</h2>
        <p>အခြားဖုန်းသို့ မှတ်တမ်းဖိုင် ပို့ပါ။ လက်ခံသောဖုန်းတွင် ပိုမို စာမျက်နှာမှ ပေါင်းထည့်ပါ။</p>
        <ShareBackupButton />
        <button type="button" className="btn btn-quiet btn-block" onClick={() => { window.location.hash = '#/more'; }}>
          အခြားဖုန်းမှ ယူမည်
        </button>
      </section>
      {alerts.map((alert) => (
        <SafetyList key={alert.reading.id} notices={alert.notices} />
      ))}
      {readings.length === 0 ? (
        <section className="card stack">
          <h2>မှတ်တမ်းမရှိသေးပါ</h2>
          <p>လက်ဖြင့်ထည့်ပါ။ ဒေတာသည် ဤဘရောက်ဇာထဲတွင်သာ ရှိသည်။</p>
        </section>
      ) : (
        <div className="grid-2">
          <LatestCard title="နောက်ဆုံး ဂလူးကို့စ်" reading={glucose} all={readings} />
          <LatestCard title="နောက်ဆုံး သွေးပေါင်" reading={bp} all={readings} />
        </div>
      )}
      <div className="grid-2">
        <button type="button" className="btn btn-primary" onClick={() => onAdd('glucose')}>ဂလူးကို့စ် ထည့်မည်</button>
        <button type="button" className="btn btn-primary" onClick={() => onAdd('bp')}>သွေးပေါင် ထည့်မည်</button>
      </div>
    </div>
  );
}

function LatestCard({ title, reading, all }: { title: string; reading: Reading | null; all: Reading[] }) {
  return (
    <article className="card">
      <h2>{title}</h2>
      {reading ? (
        <>
          <p className="reading-value">{readingValue(reading)}</p>
          <p>{whenLabel(reading)}</p>
          <p>{readingContext(reading)}{badgeText(reading, all) ? ` · ${badgeText(reading, all)}` : ''}</p>
          <SafetyList notices={noticesFor(reading, all)} />
        </>
      ) : (
        <p className="muted">မရှိသေးပါ</p>
      )}
    </article>
  );
}
