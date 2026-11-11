import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Reading } from '../domain/types.ts';
import { blankDraft, clearDraft, draftFromReading, loadDraft, saveDraft, type Draft } from '../components/draft.ts';
import { ReadingForm } from '../components/ReadingForm.tsx';
import { useSlidingPill } from '../components/useSlidingPill.ts';
import { useLog } from '../store/LogProvider.tsx';

export function AddView({
  preset,
  editing,
  onDone,
}: {
  preset: 'glucose' | 'bp' | null;
  editing: Reading | null;
  onDone: () => void;
}) {
  const log = useLog();
  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) return draftFromReading(editing);
    if (preset) return blankDraft(preset);
    return loadDraft() ?? blankDraft('glucose');
  });
  const typeRef = useRef<HTMLDivElement>(null);
  useSlidingPill(typeRef, draft.type);

  useEffect(() => {
    if (!editing) saveDraft(draft);
  }, [draft, editing]);

  function switchType(type: 'glucose' | 'bp') {
    setDraft((current) => ({
      ...blankDraft(type),
      date: current.date,
      time: current.time,
      symptoms: current.symptoms,
      notes: current.notes,
    }));
  }

  return (
    <div className="stack">
      <div className="add-header">
        <button
          type="button"
          className="btn-back-header"
          onClick={onDone}
          aria-label="နောက်သို့ ပြန်သွားမည်"
          title="နောက်သို့"
        >
          <BackChevronIcon />
        </button>
        <h2 className="add-title">
          <span className="icon-well icon-well-sm" aria-hidden="true">
            {draft.type === 'glucose' ? <DropletIcon /> : <HeartIcon />}
          </span>
          {editing ? 'ပြင်ဆင်မည်' : 'မှတ်တမ်းထည့်မည်'}
        </h2>
      </div>
      {editing ? null : (
        <div className="choice-grid" ref={typeRef} role="radiogroup" aria-label="မှတ်တမ်းအမျိုးအစား">
          <button type="button" className="choice" role="radio" aria-checked={draft.type === 'glucose'} onClick={() => switchType('glucose')}>
            <DropletIcon />
            <span className="choice-label">သွေးဂလူးကို့စ်</span>
          </button>
          <button type="button" className="choice" role="radio" aria-checked={draft.type === 'bp'} onClick={() => switchType('bp')}>
            <HeartIcon />
            <span className="choice-label">သွေးပေါင်</span>
          </button>
        </div>
      )}
      <ReadingForm
        draft={draft}
        setDraft={setDraft}
        editing={editing}
        others={log.readings}
        onCancel={onDone}
        onSave={(reading) => {
          const ok = editing ? log.updateReading(reading) : log.addReading(reading);
          if (ok) {
            clearDraft();
            onDone();
          }
          return ok;
        }}
      />
    </div>
  );
}

function AddIcon({ children, strokeWidth = 1.8 }: { children: ReactNode; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function BackChevronIcon() {
  return (
    <AddIcon strokeWidth={2.4}>
      <path d="M15 18l-6-6 6-6" />
    </AddIcon>
  );
}

function DropletIcon() {
  return (
    <AddIcon>
      <path d="M12 3c3.2 4.2 5.5 7.4 5.5 10.2a5.5 5.5 0 1 1-11 0C6.5 10.4 8.8 7.2 12 3z" />
    </AddIcon>
  );
}

function HeartIcon() {
  return (
    <AddIcon>
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.9 4 2.3C12.9 5.9 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z" />
    </AddIcon>
  );
}
