import { useMemo, useState, type ReactNode } from 'react';
import { badgeFor, evaluateReading } from '../domain/safety.ts';
import type { Reading } from '../domain/types.ts';
import { badgeText, noticesFor, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { SafetyList } from '../components/SafetyList.tsx';
import { latestReading } from '../domain/history.ts';
import { weekSummary } from '../domain/summary.ts';
import { useLog } from '../store/LogProvider.tsx';

const WINDOW_MS = 48 * 60 * 60 * 1000;

export function HomeView({ onAdd }: { onAdd: (type: 'glucose' | 'bp') => void }) {
  const { hydrated, readings } = useLog();
  const [now] = useState(() => Date.now());
  const week = useMemo(() => weekSummary(readings, new Date(now)), [readings, now]);
  const recent = useMemo(
    () => [...readings].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)).slice(0, 5),
    [readings],
  );
  if (!hydrated) {
    return (
      <div className="card loading-card" role="status">
        <div className="skeleton-bar" aria-hidden="true" />
        <div className="skeleton-bar skeleton-bar-short" aria-hidden="true" />
        <p className="muted">ဖွင့်နေသည်…</p>
      </div>
    );
  }
  const glucose = latestReading(readings, 'glucose');
  const bp = latestReading(readings, 'bp');
  const alerts = readings.flatMap((reading) => {
    const age = now - Date.parse(reading.recordedAt);
    if (age < 0 || age > WINDOW_MS) return [];
    const notices = evaluateReading(reading, readings).filter((notice) => notice.severity === 'emergency' || notice.severity === 'urgent');
    return notices.length ? [{ reading, notices }] : [];
  });

  return (
    <div className="stack home">
      <p className="disclaimer-panel">
        <InfoIcon />
        ဤအက်ပ်သည် ရောဂါရှာဖွေခြင်း၊ ဆေးပမာဏပြောင်းခြင်း မပြုပါ။ နံပါတ်တစ်ခုတည်းကို ပုံမှန်ဟု မသတ်မှတ်ပါ။
      </p>
      {alerts.map((alert) => (
        <SafetyList key={alert.reading.id} notices={alert.notices} />
      ))}
      {readings.length === 0 ? (
        <section className="card empty-state">
          <span className="empty-icon" aria-hidden="true">
            <DropletIcon />
          </span>
          <h2>မှတ်တမ်းမရှိသေးပါ</h2>
          <p>လက်ဖြင့်ထည့်ပါ။ ဒေတာသည် ဤဘရောက်ဇာထဲတွင်သာ ရှိသည်။</p>
        </section>
      ) : (
        <>
          <section className="card summary-card" aria-label="ဒီအပတ် အနှစ်ချုပ်">
            <div className="summary-col">
              <strong className="summary-number">{week.count}</strong>
              <span className="muted">ဒီအပတ် မှတ်တမ်း</span>
            </div>
            <div className="summary-col">
              <strong className="summary-number summary-percent">
                {week.inRangePercent == null ? '—' : (
                  <>
                    {week.inRangePercent}
                    <span className="pct-sign">%</span>
                  </>
                )}
              </strong>
              <span className="muted">ပစ်မှတ်အတွင်း</span>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${week.inRangePercent ?? 0}%` }} />
              </div>
            </div>
          </section>
          <div className="latest-grid">
            <LatestCard kind="glucose" title="နောက်ဆုံး ဂလူးကို့စ်" reading={glucose} all={readings} />
            <LatestCard kind="bp" title="နောက်ဆုံး သွေးပေါင်" reading={bp} all={readings} />
          </div>
          <section className="card stack recent-card">
            <h3>မကြာသေးသော မှတ်တမ်းများ</h3>
            <ul className="recent-list">
              {recent.map((reading) => (
                <li key={reading.id} className="recent-row">
                  <div className="recent-row-left">
                    <span className="recent-time">{whenLabel(reading)}</span>
                    <span className="context-pill">{readingContext(reading)}</span>
                  </div>
                  <div className="recent-row-right">
                    <strong className="recent-value">{readingValue(reading)}</strong>
                    {badgeText(reading, readings) ? <span className={`badge ${badgeFor(noticesFor(reading, readings))}`}>{badgeText(reading, readings)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-quiet btn-block btn-view-all" onClick={() => { window.location.hash = '#/history'; }}>
              မှတ်တမ်း အားလုံး ကြည့်မည်
              <ChevronIcon />
            </button>
          </section>
        </>
      )}
      <div className="quick-add">
        <button type="button" className="btn btn-primary btn-add" onClick={() => onAdd('glucose')}>
          <DropletPlusIcon />
          ဂလူးကို့စ် ထည့်မည်
        </button>
        <button type="button" className="btn btn-primary btn-add" onClick={() => onAdd('bp')}>
          <HeartIcon />
          သွေးပေါင် ထည့်မည်
        </button>
      </div>
    </div>
  );
}

function LatestCard({ kind, title, reading, all }: { kind: 'glucose' | 'bp'; title: string; reading: Reading | null; all: Reading[] }) {
  return (
    <article className="card latest-card">
      <div className="latest-head">
        <h2 className="latest-title">{title}</h2>
        <span className="icon-well" aria-hidden="true">
          {kind === 'glucose' ? <DropletIcon /> : <HeartIcon />}
        </span>
      </div>
      {reading ? (
        <>
          <p className="reading-value">{readingValue(reading)}</p>
          <p className="latest-meta">
            {whenLabel(reading)} · {readingContext(reading)}
            {badgeText(reading, all) ? <span className={`badge ${badgeFor(noticesFor(reading, all))}`}>{badgeText(reading, all)}</span> : null}
          </p>
          <SafetyList notices={noticesFor(reading, all)} />
        </>
      ) : (
        <p className="muted latest-empty">မရှိသေးပါ</p>
      )}
    </article>
  );
}

function HomeIcon({ children }: { children: ReactNode }) {
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

function DropletIcon() {
  return (
    <HomeIcon>
      <path d="M12 3c3.2 4.2 5.5 7.4 5.5 10.2a5.5 5.5 0 1 1-11 0C6.5 10.4 8.8 7.2 12 3z" />
    </HomeIcon>
  );
}

function DropletPlusIcon() {
  return (
    <HomeIcon>
      <path d="M12 3c3.2 4.2 5.5 7.4 5.5 10.2a5.5 5.5 0 1 1-11 0C6.5 10.4 8.8 7.2 12 3z" />
      <path d="M12 11.5v4M10 13.5h4" />
    </HomeIcon>
  );
}

function HeartIcon() {
  return (
    <HomeIcon>
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.9 4 2.3C12.9 5.9 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z" />
    </HomeIcon>
  );
}

function InfoIcon() {
  return (
    <HomeIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
    </HomeIcon>
  );
}

function ChevronIcon() {
  return (
    <HomeIcon>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </HomeIcon>
  );
}
