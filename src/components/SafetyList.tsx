import type { SafetyNotice } from '../domain/safety.ts';

export function SafetyList({ notices }: { notices: SafetyNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="stack">
      {notices.map((notice) => (
        <article key={notice.code} className={`banner ${notice.severity}`}>
          <h3>{notice.title}</h3>
          <p>{notice.body}</p>
        </article>
      ))}
    </div>
  );
}
