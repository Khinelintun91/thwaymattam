import { useMemo, useState, type ReactNode } from 'react';
import { badgeText, dayHeading, displayNotes, noticesFor, readingContext, readingValue } from '../components/format.ts';
import { formatTime12 } from '../domain/time.ts';
import { badgeFor } from '../domain/safety.ts';
import { Modal, TrashIcon } from '../components/Modal.tsx';
import { EMPTY_FILTER, filterReadings, groupByDay, groupByDayPart, type HistoryFilter } from '../domain/history.ts';
import { DAYPART_LABEL, MEAL_LABEL } from '../domain/labels.ts';
import { MEAL_CONTEXTS, type Reading } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

function HistoryIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function FilterIcon() {
  return (
    <HistoryIcon>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <path d="M14 2v4" />
      <path d="M8 10v4" />
      <path d="M16 18v4" />
    </HistoryIcon>
  );
}

function ChevronIcon() {
  return (
    <HistoryIcon>
      <path d="M6 9l6 6 6-6" />
    </HistoryIcon>
  );
}

function ResetIcon() {
  return (
    <HistoryIcon>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </HistoryIcon>
  );
}

function SearchIcon() {
  return (
    <HistoryIcon>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </HistoryIcon>
  );
}

function PencilIcon() {
  return (
    <HistoryIcon>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </HistoryIcon>
  );
}

export function HistoryView({ onEdit, onDeleted }: { onEdit: (reading: Reading) => void; onDeleted: (reading: Reading) => void }) {
  const { readings, deleteReading } = useLog();
  const [filter, setFilter] = useState<HistoryFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<Reading | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => filterReadings(readings, filter), [readings, filter]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  function toggleDay(date: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <div className="stack history-view">
      <h2>မှတ်တမ်း</h2>
      <details className="filter-panel">
        <summary>
          <FilterIcon />
          <span className="filter-summary-text">စစ်ထုတ်မှု · {filtered.length} ခု</span>
          <span className="filter-chevron" aria-hidden="true">
            <ChevronIcon />
          </span>
        </summary>
        <div className="card filter-card">
          <div className="filter-grid">
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
          </div>
          <button type="button" className="btn btn-quiet btn-block" onClick={() => setFilter(EMPTY_FILTER)}>
            <ResetIcon />
            စစ်ထုတ်မှုရှင်းမည်
          </button>
        </div>
      </details>
      {groups.length === 0 ? (
        <div className="card empty-filter">
          <span className="empty-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <p>ဤစစ်ထုတ်မှုနှင့် ကိုက်သော မှတ်တမ်းမရှိပါ။</p>
        </div>
      ) : null}
      {groups.map((group) => {
        const parts = groupByDayPart(group.items);
        const isCollapsed = collapsed.has(group.date);
        return (
          <article key={group.date} className="card day-card">
            <button type="button" className="day-head-btn" aria-expanded={!isCollapsed} onClick={() => toggleDay(group.date)}>
              <span className="day-head-title">{dayHeading(group.date)}</span>
              <span className="day-head-meta">
                <span className="count-pill">{group.items.length} ခု</span>
                <span className="day-head-chevron">{isCollapsed ? '▸' : '▾'}</span>
              </span>
            </button>
            {isCollapsed ? null : parts.map((part) => (
              <section key={part.part}>
                <h4 className="part-head">{DAYPART_LABEL[part.part]}</h4>
                <ul className="reading-rows">
                  {part.items.map((reading) => {
                    const notes = displayNotes(reading);
                    return (
                      <li key={reading.id} className="reading-row">
                        <div className="reading-row-time-col">
                          <span className="reading-row-time">{formatTime12(new Date(reading.recordedAt))}</span>
                          <span className="context-pill">{readingContext(reading)}</span>
                        </div>
                        <div className="reading-row-value-col">
                          <strong className="reading-row-value">{readingValue(reading)}</strong>
                          {badgeText(reading, readings) ? <span className={`badge ${badgeFor(noticesFor(reading, readings))}`}>{badgeText(reading, readings)}</span> : null}
                        </div>
                        {notes ? <p className="muted reading-row-note">{notes}</p> : null}
                        <div className="row-actions">
                          <button type="button" className="btn btn-quiet btn-tiny" onClick={() => onEdit(reading)}>
                            <PencilIcon />
                            ပြင်မည်
                          </button>
                          <button type="button" className="btn btn-quiet-danger btn-tiny" onClick={() => setPending(reading)}>
                            <TrashIcon />
                            ဖျက်မည်
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </article>
        );
      })}
      {pending ? (
        <Modal title="မှတ်တမ်းဖျက်မည်" heroIcon={<TrashIcon />} onClose={() => setPending(null)}>
          <p className="modal-body-text">{readingValue(pending)} ကို ဖျက်မည်။ ဖျက်ပြီးနောက် ခဏတာ ပြန်ယူနိုင်သည်။</p>
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
              <TrashIcon />
              ဖျက်မည်
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
