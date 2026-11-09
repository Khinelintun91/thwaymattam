import { useEffect, useState } from 'react';
import type { Reading } from '../domain/types.ts';
import { blankDraft, clearDraft, draftFromReading, loadDraft, saveDraft, type Draft } from '../components/draft.ts';
import { ReadingForm } from '../components/ReadingForm.tsx';
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
      <h2>{editing ? 'ပြင်ဆင်မည်' : 'မှတ်တမ်းထည့်မည်'}</h2>
      {editing ? null : (
        <div className="choice-grid" role="radiogroup" aria-label="မှတ်တမ်းအမျိုးအစား">
          <button type="button" className="choice" role="radio" aria-checked={draft.type === 'glucose'} onClick={() => switchType('glucose')}>
            သွေးဂလူးကို့စ်
          </button>
          <button type="button" className="choice" role="radio" aria-checked={draft.type === 'bp'} onClick={() => switchType('bp')}>
            သွေးပေါင်
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
