import { useMemo, useState } from 'react';
import { badgeText, dayHeading, noticesFor, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { badgeFor } from '../domain/safety.ts';
import { Modal } from '../components/Modal.tsx';
import { EMPTY_FILTER, filterReadings, groupByDay, type HistoryFilter } from '../domain/history.ts';
import { MEAL_LABEL } from '../domain/labels.ts';
import { MEAL_CONTEXTS, type Reading } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

export function HistoryView({ onEdit, onDeleted }: { onEdit: (reading: Reading) => void; onDeleted: (reading: Reading) => void }) {
  const { readings, deleteReading } = useLog();
  const [filter, setFilter] = useState<HistoryFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<Reading | null>(null);
  const filtered = useMemo(() => filterReadings(readings, filter), [readings, filter]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="stack">
      <h2>မှတ်တမ်း</h2>
      <details>
        <summary>စစ်ထုတ်မှု · {filtered.length} ခု</summary>
        <div className="stack">
          <label className="field">အမျိုးအစား
            <select value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value as HistoryFilter['type'] })}>
              <option value="all">အားလုံး</option>
              <option value="glucose">ဂလူးကို့စ်</option>
              <option value="bp">သွေးပေါင်</option>
            </select>
          </label>
          <label className="field">အစာစားချိန်
            <select value={filter.context} onChange={(event) => setFilter({ ...filter, context: event.target.value as HistoryFilter['context'] })}>
              <option value="all">အားလုံး</option>
              {MEAL_CONTEXTS.map((context) => <option key={context} value={context}>{MEAL_LABEL[context]}</option>)}
            </select>
          </label>
          <label className="field">ဂလူးကို့စ်ယူနစ်
            <select value={filter.unit} onChange={(event) => setFilter({ ...filter, unit: event.target.value as HistoryFilter['unit'] })}>
              <option value="all">အားလုံး</option>
              <option value="mg/dL">mg/dL</option>
              <option value="mmol/L">mmol/L</option>
            </select>
          </label>
          <div className="grid-2">
            <label className="field">မှ
              <input type="date" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} />
            </label>
            <label className="field">ထိ
              <input type="date" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} />
            </label>
          </div>
          <button type="button" className="btn btn-quiet" onClick={() => setFilter(EMPTY_FILTER)}>စစ်ထုတ်မှုရှင်းမည်</button>
        </div>
      </details>
      {groups.length === 0 ? <p className="card">ဤစစ်ထုတ်မှုနှင့် ကိုက်သော မှတ်တမ်းမရှိပါ။</p> : null}
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="day-head">{dayHeading(group.date)}</h3>
          <div className="stack">
            {group.items.map((reading) => (
              <article key={reading.id} className="card">
                <div className="spread">
                  <div>
                    <strong>{readingValue(reading)}</strong>
                    <p className="muted">{whenLabel(reading)} · {readingContext(reading)}</p>
                    {badgeText(reading, readings) ? <span className={`badge ${badgeFor(noticesFor(reading, readings))}`}>{badgeText(reading, readings)}</span> : null}
                  </div>
                </div>
                {reading.notes ? <p>{reading.notes}</p> : null}
                <div className="row">
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => onEdit(reading)}>ပြင်မည်</button>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => setPending(reading)}>ဖျက်မည်</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {pending ? (
        <Modal title="မှတ်တမ်းဖျက်မည်" onClose={() => setPending(null)}>
          <p>{readingValue(pending)} ကို ဖျက်မည်။ ဖျက်ပြီးနောက် ခဏတာ ပြန်ယူနိုင်သည်။</p>
          <div className="row">
            <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>မဖျက်ပါ</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const target = pending;
                if (deleteReading(target.id)) onDeleted(target);
                setPending(null);
              }}
            >
              ဖျက်မည်
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
