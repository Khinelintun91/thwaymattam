import { useEffect, useState } from 'react';
import { parseMeterOcr, type OcrWordInput } from '../domain/ocrParse.ts';
import type { Reading } from '../domain/types.ts';
import { applyParse, blankDraft, clearDraft, draftFromReading, loadDraft, saveDraft, type Draft } from '../components/draft.ts';
import { PhotoPanel } from '../components/PhotoPanel.tsx';
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
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [words, setWords] = useState<OcrWordInput[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const parsed = ocrText == null ? null : parseMeterOcr({ text: ocrText, intent: draft.type, words });

  useEffect(() => {
    if (!editing) saveDraft(draft);
  }, [draft, editing]);

  function switchType(type: 'glucose' | 'bp') {
    setOcrText(null);
    setWords([]);
    setPreviewUrl(null);
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
            သွေးပေါင်ချိန်
          </button>
        </div>
      )}
      {editing ? null : (
        <PhotoPanel
          onRecognized={(result) => {
            setOcrText(result.text);
            setWords(result.words);
            setPreviewUrl(result.previewUrl);
            setDraft((current) => applyParse(current, parseMeterOcr({ text: result.text, intent: current.type, words: result.words })));
          }}
          onCleared={() => setPreviewUrl(null)}
        />
      )}
      <ReadingForm
        draft={draft}
        setDraft={setDraft}
        editing={editing}
        parsed={parsed}
        previewUrl={previewUrl}
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
