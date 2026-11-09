import { useMemo, useState } from 'react';
import { badgeText, noticesFor, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { filterReadings } from '../domain/history.ts';
import { MONTHS_MY, SYMPTOM_LABEL } from '../domain/labels.ts';
import { badgeFor } from '../domain/safety.ts';
import {
  availableMonths,
  BP_TARGET,
  FASTING_TARGET,
  monthRange,
  POSTMEAL_TARGET_MAX,
  previousMonth,
  summarizeReadings,
  type MonthSummary,
} from '../domain/summary.ts';
import { dateKey, formatLongDate, formatTime12 } from '../domain/time.ts';
import { OFFSET_LABEL, TIMEZONE, type Medication } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

export function PrintView() {
  const { readings, medications, demo } = useLog();
  const [name, setName] = useState('');
  const [printedAt] = useState(() => new Date());
  const [from, setFrom] = useState(() => monthRange(new Date().getFullYear(), new Date().getMonth() + 1).from);
  const [to, setTo] = useState(() => dateKey(new Date()));
  const months = useMemo(() => availableMonths(readings, MONTHS_MY), [readings]);
  const monthKey = useMemo(() => {
    const match = months.find((month) => {
      const range = monthRange(month.year, month.month);
      return range.from === from && range.to === to;
    });
    return match?.key ?? '';
  }, [months, from, to]);
  const summary = useMemo(() => summarizeReadings(readings, from, to), [readings, from, to]);
  const previous = useMemo(() => {
    const current = months.find((month) => month.key === monthKey);
    if (!current) return null;
    const prev = previousMonth(current.year, current.month);
    const range = monthRange(prev.year, prev.month);
    const prevSummary = summarizeReadings(readings, range.from, range.to);
    if (prevSummary.glucoseCount + prevSummary.bpCount === 0) return null;
    return { label: `${MONTHS_MY[prev.month - 1] ?? ''} ${prev.year}`, summary: prevSummary };
  }, [months, monthKey, readings]);
  const rows = useMemo(
    () => filterReadings(readings, { type: 'all', context: 'all', unit: 'all', from, to }).sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)),
    [readings, from, to],
  );

  function pickMonth(key: string) {
    const month = months.find((item) => item.key === key);
    if (!month) return;
    const range = monthRange(month.year, month.month);
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <div className="stack">
      <div className="no-print card stack">
        <h2>ဆရာဝန်အတွက် အနှစ်ချုပ်</h2>
        <label className="field">အမည် (ပရင့်တွင်သာ၊ မသိမ်းပါ)
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </label>
        <label className="field">လ ရွေးမည်
          <select value={monthKey} onChange={(event) => pickMonth(event.target.value)}>
            <option value="">စိတ်ကြိုက် ရက်စွဲ</option>
            {months.map((month) => (
              <option key={month.key} value={month.key}>{month.label}</option>
            ))}
          </select>
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
        <p>အချိန်ဇုန်: {TIMEZONE} ({OFFSET_LABEL}) · ထုတ်သည့်အချိန် {formatLongDate(printedAt)} {formatTime12(printedAt)}</p>
        <p>Not a diagnosis. Not for dose adjustment.</p>
        <p>ဤစာရွက်သည် ကိုယ်တိုင်မှတ်ထားသော ကိန်းများသာဖြစ်သည်။ ရောဂါရှာဖွေချက် သို့မဟုတ် ဆေးညွှန်းမဟုတ်ပါ။</p>
        <MonthlySummary summary={summary} previous={previous} medications={medications} />
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
              {rows.map((reading) => {
                const severity = badgeFor(noticesFor(reading, readings));
                const flag = severity === 'emergency' || severity === 'urgent' ? 'flag-emergency' : severity === 'warning' ? 'flag' : '';
                return (
                  <tr key={reading.id}>
                    <td>{whenLabel(reading)}</td>
                    <td className={flag}>{readingValue(reading)}</td>
                    <td>{readingContext(reading)}</td>
                    <td>{badgeText(reading, readings) ?? ''}</td>
                    <td>{reading.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p>ဤကာလတွင် မှတ်တမ်းမရှိပါ။</p> : null}
      </article>
    </div>
  );
}

function MonthlySummary({
  summary,
  previous,
  medications,
}: {
  summary: MonthSummary;
  previous: { label: string; summary: MonthSummary } | null;
  medications: Medication[];
}) {
  const empty = summary.glucoseCount + summary.bpCount === 0;
  return (
    <section className="card stack summary-box" aria-label="လစဉ် အနှစ်ချုပ်">
      <h3>လစဉ် အနှစ်ချုပ်</h3>
      {empty ? (
        <p>ဤကာလတွင် မှတ်တမ်းမရှိပါ။</p>
      ) : (
        <>
          <p>
            မှတ်တမ်းတင်ခဲ့သော ရက် {summary.daysLogged} ရက် · မှတ်တမ်း {summary.glucoseCount + summary.bpCount} ခု
            (ဂလူးကို့စ် {summary.glucoseCount} ခု၊ သွေးပေါင် {summary.bpCount} ခု)
          </p>
          <h3>သွေးဂလူးကို့စ် (mg/dL)</h3>
          <p>
            {summary.fasting.avg != null
              ? `အစာရှောင် ပျမ်းမျှ ${summary.fasting.avg} (target ${FASTING_TARGET.min}–${FASTING_TARGET.max}) · အနိမ့်ဆုံး ${summary.fasting.min} · အမြင့်ဆုံး ${summary.fasting.max} · target ကျော် ${summary.fasting.aboveTarget} ကြိမ်`
              : 'အစာရှောင် မှတ်တမ်း မရှိပါ'}
          </p>
          <p>
            {summary.postmeal.avg != null
              ? `အစာစားပြီး ပျမ်းမျှ ${summary.postmeal.avg} (target ${POSTMEAL_TARGET_MAX} အောက်) · အနိမ့်ဆုံး ${summary.postmeal.min} · အမြင့်ဆုံး ${summary.postmeal.max} · target ကျော် ${summary.postmeal.aboveTarget} ကြိမ်`
              : 'အစာစားပြီး မှတ်တမ်း မရှိပါ'}
          </p>
          <p>နိမ့်လွန်းသော တန်ဖိုး (70 အောက်) {summary.lowCount} ကြိမ်</p>
          <h3>သွေးပေါင် (mmHg)</h3>
          <p>
            {summary.bp.avgSys != null && summary.bp.avgDia != null
              ? `ပျမ်းမျှ ${summary.bp.avgSys}/${summary.bp.avgDia} (target ${BP_TARGET.sys}/${BP_TARGET.dia} အောက်) · အမြင့်ဆုံး အပေါ် ${summary.bp.maxSys} · target ကျော် ${summary.bp.aboveTarget} ကြိမ်`
              : 'သွေးပေါင် မှတ်တမ်း မရှိပါ'}
          </p>
          <p>
            အရေးပေါ်လက္ခဏာ {summary.emergencySymptomCount} ကြိမ်
            {summary.emergencySymptoms.length > 0
              ? ` (${summary.emergencySymptoms.map((item) => `${SYMPTOM_LABEL[item.code]} ${item.count} ကြိမ်`).join('၊ ')})`
              : ' — မရှိပါ'}
          </p>
          {previous ? (
            <p>
              ပြီးခဲ့တဲ့ {previous.label} နဲ့ နှိုင်းယှဉ်ချက်:{' '}
              {previous.summary.fasting.avg != null && summary.fasting.avg != null
                ? `အစာရှောင် ပျမ်းမျှ ${previous.summary.fasting.avg} → ${summary.fasting.avg}`
                : 'အစာရှောင် ပျမ်းမျှ နှိုင်းယှဉ်၍မရပါ'}
              {previous.summary.bp.avgSys != null && previous.summary.bp.avgDia != null && summary.bp.avgSys != null && summary.bp.avgDia != null
                ? ` · သွေးပေါင် ${previous.summary.bp.avgSys}/${previous.summary.bp.avgDia} → ${summary.bp.avgSys}/${summary.bp.avgDia}`
                : ''}
            </p>
          ) : null}
        </>
      )}
      <h3>ဆေးဝါးစာရင်း</h3>
      {medications.length === 0 ? (
        <p>ဆေးဝါးစာရင်း မရှိပါ။</p>
      ) : (
        <ul>
          {medications.map((medication) => (
            <li key={medication.id}>
              {medication.name}
              {medication.dose ? ` — ${medication.dose}` : ''}
              {medication.notes ? ` (${medication.notes})` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
