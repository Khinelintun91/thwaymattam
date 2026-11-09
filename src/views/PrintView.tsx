import { useMemo, useState } from 'react';
import { badgeText, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { filterReadings } from '../domain/history.ts';
import { DAYPART_LABEL } from '../domain/labels.ts';
import { dateKey, dayPart, formatLongDate, formatWallTime, shiftDateKey } from '../domain/time.ts';
import { OFFSET_LABEL, TIMEZONE } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

export function PrintView() {
  const { readings, demo } = useLog();
  const [name, setName] = useState('');
  const [printedAt] = useState(() => new Date());
  const [from, setFrom] = useState(() => shiftDateKey(dateKey(new Date()), -29) ?? '');
  const [to, setTo] = useState(() => dateKey(new Date()));
  const rows = useMemo(
    () => filterReadings(readings, { type: 'all', context: 'all', unit: 'all', from, to }).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)),
    [readings, from, to],
  );

  return (
    <div className="stack">
      <div className="no-print card stack">
        <h2>ဆရာဝန်အတွက် အနှစ်ချုပ်</h2>
        <label className="field">အမည် (ပရင့်တွင်သာ၊ မသိမ်းပါ)
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </label>
        <div className="grid-2">
          <label className="field">မှ<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">ထိ<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>ပရင့်ထုတ်မည်</button>
      </div>
      <article className="card stack">
        <h2>သွေးမှတ်တမ်း — ဆရာဝန်အတွက် အနှစ်ချုပ်</h2>
        {demo ? <p>နမူနာဒေတာ။ တကယ်လူနာမှတ်တမ်းမဟုတ်ပါ။</p> : null}
        <p>အမည်: {name || '________________'}</p>
        <p>အချိန်ဇုန်: {TIMEZONE} ({OFFSET_LABEL}) · ထုတ်သည့်အချိန် {formatLongDate(printedAt)} {formatWallTime(printedAt)} {DAYPART_LABEL[dayPart(printedAt)]}</p>
        <p>Not a diagnosis. Not for dose adjustment.</p>
        <p>ဤစာရွက်သည် ကိုယ်တိုင်မှတ်ထားသော ကိန်းများသာဖြစ်သည်။ ရောဂါရှာဖွေချက် သို့မဟုတ် ဆေးညွှန်းမဟုတ်ပါ။</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>အချိန်</th>
                <th>တန်ဖိုး</th>
                <th>အခြေအနေ</th>
                <th>သတိ</th>
                <th>မှတ်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((reading) => (
                <tr key={reading.id}>
                  <td>{whenLabel(reading)}</td>
                  <td>{readingValue(reading)}</td>
                  <td>{readingContext(reading)}</td>
                  <td>{badgeText(reading, readings) ?? ''}</td>
                  <td>{reading.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p>ဤကာလတွင် မှတ်တမ်းမရှိပါ။</p> : null}
      </article>
    </div>
  );
}
