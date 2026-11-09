import { useMemo, useState, type ReactNode } from 'react';
import { badgeFor, evaluateReading } from '../domain/safety.ts';
import type { Reading } from '../domain/types.ts';
import { badgeText, noticesFor, readingContext, readingValue, whenLabel } from '../components/format.ts';
import { SafetyList } from '../components/SafetyList.tsx';
import { Modal } from '../components/Modal.tsx';
import { latestReading } from '../domain/history.ts';
import { weekSummary } from '../domain/summary.ts';
import { useLog } from '../store/LogProvider.tsx';

const WINDOW_MS = 48 * 60 * 60 * 1000;

export function HomeView({ onAdd }: { onAdd: (type: 'glucose' | 'bp') => void }) {
  const { hydrated, readings, syncConfig, syncStatuses, syncSingleNow } = useLog();
  const [now] = useState(() => Date.now());
  const [showInfo, setShowInfo] = useState(false);
  const week = useMemo(() => weekSummary(readings, new Date(now)), [readings, now]);
  const recent = useMemo(
    () => [...readings].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)).slice(0, 3),
    [readings],
  );

  const pendingSyncCount = useMemo(() => {
    if (!syncConfig.webhookUrl) return 0;
    return readings.filter((r) => syncStatuses[r.id]?.status === 'pending').length;
  }, [readings, syncConfig.webhookUrl, syncStatuses]);

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
    <div className="stack home-compact">
      {/* Compact Header Row with Info trigger */}
      <div className="home-subhead">
        <span className="home-subhead-title">ကျန်းမာရေး အနှစ်ချုပ်</span>
        <button
          type="button"
          className="info-pill-btn"
          onClick={() => setShowInfo(true)}
          aria-label="အချက်အလက်နှင့် သတိပေးချက်"
        >
          <InfoIcon />
          <span>သတိပြုရန်</span>
        </button>
      </div>

      {alerts.map((alert) => (
        <SafetyList key={alert.reading.id} notices={alert.notices} />
      ))}

      {readings.length === 0 ? (
        <>
          <section className="card empty-state">
            <span className="empty-icon" aria-hidden="true">
              <DropletIcon />
            </span>
            <h2>မှတ်တမ်းမရှိသေးပါ</h2>
            <p>အောက်ပါ ခလုတ်များမှတစ်ဆင့် ပထမဆုံးအကြိမ် မှတ်တမ်းတင်နိုင်ပါသည်။</p>
          </section>
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
        </>
      ) : (
        <>
          {/* Compact Glance Bar */}
          <section className="compact-glance-bar" aria-label="ဒီအပတ် အနှစ်ချုပ်">
            <div className="glance-item">
              <span className="glance-label">ဒီအပတ်</span>
              <strong className="glance-val">{week.count} ကြိမ်</strong>
            </div>
            <div className="glance-divider" />
            <div className="glance-item">
              <span className="glance-label">ပုံမှန်ပစ်မှတ်</span>
              <strong className="glance-val glance-accent">
                {week.inRangePercent == null ? '—' : `${week.inRangePercent}%`}
              </strong>
            </div>
            {syncConfig.webhookUrl ? (
              <>
                <div className="glance-divider" />
                <div className="glance-item">
                  <span className="glance-label">Cloud Sync</span>
                  <strong className="glance-val glance-sync">
                    {pendingSyncCount > 0 ? `⏳ ${pendingSyncCount} ခု` : '✔ အဆင်ပြေ'}
                  </strong>
                </div>
              </>
            ) : null}
          </section>

          {/* Side-by-Side Latest Vitals Cards */}
          <div className="latest-grid">
            <LatestCard
              kind="glucose"
              title="သွေးချို (နောက်ဆုံး)"
              reading={glucose}
              all={readings}
              onQuickAdd={() => onAdd('glucose')}
            />
            <LatestCard
              kind="bp"
              title="သွေးပေါင် (နောက်ဆုံး)"
              reading={bp}
              all={readings}
              onQuickAdd={() => onAdd('bp')}
            />
          </div>

          {/* Compact Recent Records Card (up to 3 items) */}
          <section className="card stack recent-card">
            <div className="recent-head">
              <h3>လတ်တလော မှတ်တမ်းများ</h3>
              <button
                type="button"
                className="btn-link-all"
                onClick={() => { window.location.hash = '#/history'; }}
              >
                အားလုံး ({readings.length})
                <ChevronIcon />
              </button>
            </div>
            <ul className="recent-list">
              {recent.map((reading) => {
                const syncStatus = syncConfig.webhookUrl ? syncStatuses[reading.id]?.status : null;
                return (
                  <li key={reading.id} className="recent-row">
                    <div className="recent-row-left">
                      <span className="recent-time">{whenLabel(reading)}</span>
                      <span className="context-pill">{readingContext(reading)}</span>
                    </div>
                    <div className="recent-row-right">
                      <strong className="recent-value">{readingValue(reading)}</strong>
                      {badgeText(reading, readings) ? (
                        <span className={`badge ${badgeFor(noticesFor(reading, readings))}`}>
                          {badgeText(reading, readings)}
                        </span>
                      ) : null}
                      {syncStatus === 'synced' ? (
                        <span className="sync-chip sync-synced" title="Google Sheet သို့ ရောက်ရှိပြီး">✔</span>
                      ) : syncStatus === 'pending' ? (
                        <span className="sync-chip sync-pending" title="Sync လုပ်ရန် စောင့်ဆိုင်းနေသည်">⏳</span>
                      ) : syncStatus === 'failed' ? (
                        <button
                          type="button"
                          className="sync-chip sync-failed"
                          title="ပြန်ပို့ရန် နှိပ်ပါ"
                          onClick={() => syncSingleNow(reading)}
                        >
                          ⚠ ပြန်ပို့
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* Info / Disclaimer Modal */}
      {showInfo ? (
        <Modal
          title="ဆေးဘက်ဆိုင်ရာ သတိပြုရန်"
          titleIcon={<InfoIcon />}
          onClose={() => setShowInfo(false)}
        >
          <div className="stack">
            <p className="modal-body-text">
              ဤအက်ပ်သည် ရောဂါရှာဖွေခြင်း၊ ဆေးပမာဏပြောင်းခြင်း မပြုပါ။
              နံပါတ်တစ်ခုတည်းဖြင့် ပုံမှန်ဟု မဆုံးဖြတ်ပါ။
            </p>
            <p className="modal-body-text">
              နှလုံးခုန်နှုန်း၊ သွေးဖိအားနှင့် သွေးတွင်းသကြားဓာတ် တိုင်းတာချက်များသည်
              ကိုယ်တိုင်စောင့်ကြည့်မှတ်တမ်းတင်ရန်အတွက်သာ ဖြစ်ပြီး ဆရာဝန်၏ ညွှန်ကြားချက်ကို
              အစားမထိုးပါ။ သံသယရှိပါက ဆရာဝန်နှင့် အမြန်ဆုံး တိုင်ပင်ပါ။
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowInfo(false)}
            >
              နားလည်ပါသည်
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function LatestCard({
  kind,
  title,
  reading,
  all,
  onQuickAdd,
}: {
  kind: 'glucose' | 'bp';
  title: string;
  reading: Reading | null;
  all: Reading[];
  onQuickAdd: () => void;
}) {
  return (
    <article className="card latest-card latest-card-compact">
      <div className="latest-head">
        <span className="icon-well icon-well-sm" aria-hidden="true">
          {kind === 'glucose' ? <DropletIcon /> : <HeartIcon />}
        </span>
        <h2 className="latest-title">{title}</h2>
      </div>
      {reading ? (
        <div className="latest-content">
          <p className="reading-value">{readingValue(reading)}</p>
          <div className="latest-meta">
            <span>{whenLabel(reading)}</span>
            {badgeText(reading, all) ? (
              <span className={`badge ${badgeFor(noticesFor(reading, all))}`}>
                {badgeText(reading, all)}
              </span>
            ) : null}
          </div>
          <SafetyList notices={noticesFor(reading, all)} />
        </div>
      ) : (
        <div className="latest-empty-box">
          <p className="muted latest-empty">မှတ်တမ်းမရှိပါ</p>
          <button type="button" className="btn btn-quiet btn-tiny" onClick={onQuickAdd}>
            + တိုင်းမည်
          </button>
        </div>
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
      <path d="M9 18l6-6-6-6" />
    </HomeIcon>
  );
}
