import type { SafetyNotice, SafetySeverity } from '../domain/safety.ts';

const ICON: Record<SafetySeverity, string> = {
  emergency: '!',
  urgent: '!',
  warning: '!',
  info: 'i',
};

export function SafetyList({ notices }: { notices: SafetyNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="stack">
      {notices.map((notice) => (
        <article key={notice.code} className={`banner ${notice.severity}`}>
          <span className="banner-icon" aria-hidden="true">
            {ICON[notice.severity]}
          </span>
          <div className="banner-body">
            <h3>{notice.title}</h3>
            <p>{notice.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
