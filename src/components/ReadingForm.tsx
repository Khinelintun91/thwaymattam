import { useMemo, useState, type ReactNode } from 'react';
import { DAYPART_LABEL, DAYPART_RANGE, MEAL_LABEL, SYMPTOM_LABEL } from '../domain/labels.ts';
import { normalizeNumericInput, parseLooseNumber } from '../domain/numbers.ts';
import { badgeFor, evaluateReading } from '../domain/safety.ts';
import { dayPart, wallClockToIso } from '../domain/time.ts';
import { EMERGENCY_SYMPTOMS, MEAL_CONTEXTS, SYMPTOMS, type GlucoseUnit, type MealContext, type Reading, type Symptom } from '../domain/types.ts';
import { convertGlucose, formatGlucose, roundGlucose } from '../domain/units.ts';
import { createId, issueMessage, validateReading, type ValidateIssue } from '../domain/validate.ts';
import { badgeText, noticesFor, readingContext, readingValue } from './format.ts';
import type { Draft } from './draft.ts';
import { SafetyList } from './SafetyList.tsx';

type NumericKey = 'glucoseValue' | 'minutesSinceMealStart' | 'systolic' | 'diastolic' | 'pulse';

export function ReadingForm({
  draft,
  setDraft,
  editing,
  others,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft | ((current: Draft) => Draft)) => void;
  editing: Reading | null;
  others: Reading[];
  onSave: (reading: Reading) => boolean;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<ValidateIssue[]>([]);
  const iso = wallClockToIso(draft.date, draft.time);
  const part = iso ? dayPart(new Date(iso)) : null;

  const preview = useMemo(() => {
    const candidate = toCandidate(draft, editing);
    const validated = validateReading(candidate);
    if (!validated.ok) return null;
    return { reading: validated.value, notices: evaluateReading(validated.value, others) };
  }, [draft, editing, others]);

  function update(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function setNumber(key: NumericKey, value: string) {
    update({ [key]: normalizeNumericInput(value) });
  }

  function chooseUnit(next: GlucoseUnit | '') {
    setDraft((current) => {
      if (next === '') return { ...current, glucoseUnit: '' };
      const amount = parseLooseNumber(current.glucoseValue);
      if (current.glucoseUnit && current.glucoseUnit !== next && amount != null) {
        const converted = roundGlucose(convertGlucose(amount, current.glucoseUnit, next), next);
        return { ...current, glucoseUnit: next, glucoseValue: formatGlucose(converted, next) };
      }
      return { ...current, glucoseUnit: next };
    });
  }

  function chooseMealContext(context: MealContext) {
    update({ mealContext: context, minutesSinceMealStart: context === 'postmeal' ? draft.minutesSinceMealStart : '' });
  }

  function addSymptom(value: string) {
    if (!value) return;
    const symptom = value as Symptom;
    if (!draft.symptoms.includes(symptom)) update({ symptoms: [...draft.symptoms, symptom] });
  }

  function removeSymptom(symptom: Symptom) {
    update({ symptoms: draft.symptoms.filter((item) => item !== symptom) });
  }

  function save() {
    const validated = validateReading(toCandidate(draft, editing));
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors([]);
    onSave(validated.value);
  }

  const remainingSymptoms = SYMPTOMS.filter((symptom) => !draft.symptoms.includes(symptom));
  const previewText = preview ? readingValue(preview.reading) : '';
  const previewUnitIndex = previewText.lastIndexOf(' ');
  const previewValue = previewUnitIndex > 0 ? previewText.slice(0, previewUnitIndex) : previewText;
  const previewUnit = previewUnitIndex > 0 ? previewText.slice(previewUnitIndex + 1) : null;

  return (
    <div className="stack add-layout">
      <div className="stack add-fields">
        <div className="grid-2">
          <label className="field">
            ရက်စွဲ (မြန်မာစံတော်ချိန်)
            <input type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} required />
          </label>
          <label className="field">
            အချိန် (UTC+6:30)
            <input type="time" value={draft.time} onChange={(event) => update({ time: event.target.value })} required />
          </label>
        </div>
        <p>{part ? `${DAYPART_LABEL[part]} (${DAYPART_RANGE[part]})` : 'နေ့ရက်နှင့် အချိန်ကို စစ်ပါ။'} အချိန်အမည်သည် အစာရှောင်ခြင်းကို မဆိုလိုပါ။</p>

        {draft.type === 'glucose' ? (
          <div className="stack">
            <label className="field">
              သွေးဂလူးကို့စ်
              <input
                inputMode="decimal"
                value={draft.glucoseValue}
                aria-invalid={hasError(errors, 'glucoseValue')}
                onChange={(event) => setNumber('glucoseValue', event.target.value)}
              />
            </label>
            <label className="field">
              ဂလူးကို့စ်ယူနစ်
              <select value={draft.glucoseUnit} onChange={(event) => chooseUnit(event.target.value as GlucoseUnit | '')} required>
                <option value="">ယူနစ်ရွေးပါ</option>
                <option value="mg/dL">mg/dL</option>
                <option value="mmol/L">mmol/L</option>
              </select>
            </label>
            {draft.glucoseUnit && parseLooseNumber(draft.glucoseValue) != null ? (
              <p className="hint">
                ပြောင်းလဲပြထားသော တန်ဖိုး (သိမ်းမည့်ယူနစ်မဟုတ်ပါ) ·{' '}
                {formatGlucose(convertGlucose(parseLooseNumber(draft.glucoseValue) ?? 0, draft.glucoseUnit, draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL'), draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL')}{' '}
                {draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}
              </p>
            ) : null}
            <label className="field">
              အစာစားချိန်
              <select value={draft.mealContext} onChange={(event) => chooseMealContext(event.target.value as MealContext)}>
                {MEAL_CONTEXTS.map((context) => (
                  <option key={context} value={context}>
                    {MEAL_LABEL[context]}
                  </option>
                ))}
              </select>
            </label>
            {draft.mealContext === 'postmeal' ? (
              <label className="field">
                <span className="field-head">
                  <span>အစာစတင်စားချိန်မှ မိနစ်</span>
                  <span className="field-hint">မသိလျှင် ချန်လှပ်နိုင်သည်။ နာရီမှ မခန့်မှန်းပါ။</span>
                </span>
                <input
                  inputMode="numeric"
                  value={draft.minutesSinceMealStart}
                  onChange={(event) => setNumber('minutesSinceMealStart', event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="grid-2">
            <NumberField label="အပေါ်သွေးပေါင် SYS" field="systolic" draft={draft} setNumber={setNumber} />
            <NumberField label="အောက်သွေးပေါင် DIA" field="diastolic" draft={draft} setNumber={setNumber} />
            <NumberField label="သွေးခုန်နှုန်း PUL (မထည့်လည်းရ)" field="pulse" draft={draft} setNumber={setNumber} />
          </div>
        )}

        <div className="stack symptoms-card">
          <label className="field">
            လက္ခဏာ
            <select value="" onChange={(event) => addSymptom(event.target.value)} disabled={remainingSymptoms.length === 0}>
              <option value="">{remainingSymptoms.length === 0 ? 'အားလုံး ရွေးပြီးပါပြီ' : 'လက္ခဏာ ရွေးမည်'}</option>
              {remainingSymptoms.map((symptom) => (
                <option key={symptom} value={symptom}>
                  {(EMERGENCY_SYMPTOMS as readonly string[]).includes(symptom) ? 'အရေးပေါ် · ' : ''}
                  {SYMPTOM_LABEL[symptom]}
                </option>
              ))}
            </select>
          </label>
          {draft.symptoms.length > 0 ? (
            <div className="chips" aria-label="ရွေးထားသော လက္ခဏာများ">
              {draft.symptoms.map((symptom) => (
                <span key={symptom} className="chip">
                  {(EMERGENCY_SYMPTOMS as readonly string[]).includes(symptom) ? 'အရေးပေါ် · ' : ''}
                  {SYMPTOM_LABEL[symptom]}
                  <button type="button" aria-label={`${SYMPTOM_LABEL[symptom]} ကို ဖယ်မည်`} onClick={() => removeSymptom(symptom)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="hint">လက္ခဏာ မရွေးရသေးပါ။ တစ်ခုထက်ပို ရွေးနိုင်သည်။</p>
          )}
        </div>
        <label className="field">
          မှတ်ချက်
          <textarea value={draft.notes} maxLength={2000} onChange={(event) => update({ notes: event.target.value })} />
        </label>
        {errors.length > 0 ? (
          <ul className="error" role="alert">
            {errors.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                <WarningIcon />
                {issueMessage(issue.code)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {preview ? (
        <section className="preview-card">
          <p className="preview-value">{previewValue}</p>
          {previewUnit ? <p className="preview-unit">{previewUnit}</p> : null}
          <p className="preview-meta">
            <span className="context-pill">{readingContext(preview.reading)}</span>
            {badgeText(preview.reading, others) ? <span className={`badge ${badgeFor(noticesFor(preview.reading, others))}`}>{badgeText(preview.reading, others)}</span> : null}
          </p>
          <SafetyList notices={preview.notices} />
        </section>
      ) : null}
      <div className="sticky-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          <XIcon />
          မသိမ်းပါ
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          <CheckIcon />
          {editing ? 'ပြင်ဆင်ချက်သိမ်းမည်' : 'သိမ်းမည်'}
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  field,
  draft,
  setNumber,
}: {
  label: string;
  field: NumericKey;
  draft: Draft;
  setNumber: (field: NumericKey, value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input inputMode="decimal" value={draft[field]} onChange={(event) => setNumber(field, event.target.value)} />
    </label>
  );
}

function FormIcon({ children, strokeWidth = 1.8 }: { children: ReactNode; strokeWidth?: number }) {
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

function CheckIcon() {
  return (
    <FormIcon strokeWidth={2.5}>
      <path d="M4 12.5l5 5L20 6.5" />
    </FormIcon>
  );
}

function XIcon() {
  return (
    <FormIcon>
      <path d="M6 6l12 12M18 6L6 18" />
    </FormIcon>
  );
}

function WarningIcon() {
  return (
    <FormIcon>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.2" r="0.7" fill="currentColor" stroke="none" />
    </FormIcon>
  );
}

function hasError(errors: ValidateIssue[], path: string): boolean {
  return errors.some((issue) => issue.path === path);
}

function toCandidate(draft: Draft, editing: Reading | null): Record<string, unknown> {
  const recordedAt = wallClockToIso(draft.date, draft.time);
  const now = new Date().toISOString();
  const shared = {
    id: editing?.id ?? createId(),
    recordedAt,
    symptoms: draft.symptoms,
    notes: draft.notes,
    source: draft.source,
    createdAt: editing?.createdAt ?? now,
    updatedAt: now,
  };
  if (draft.type === 'bp') {
    return {
      ...shared,
      type: 'bp',
      systolic: parseLooseNumber(draft.systolic),
      diastolic: parseLooseNumber(draft.diastolic),
      pulse: draft.pulse === '' ? null : parseLooseNumber(draft.pulse),
    };
  }
  return {
    ...shared,
    type: 'glucose',
    glucoseValue: parseLooseNumber(draft.glucoseValue),
    glucoseUnit: draft.glucoseUnit,
    mealContext: draft.mealContext,
    minutesSinceMealStart: draft.mealContext === 'postmeal' && draft.minutesSinceMealStart !== '' ? parseLooseNumber(draft.minutesSinceMealStart) : null,
  };
}
