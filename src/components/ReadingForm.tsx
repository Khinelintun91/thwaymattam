import { useMemo, useState } from 'react';
import { DAYPART_LABEL, DAYPART_RANGE, MEAL_LABEL, SYMPTOM_LABEL } from '../domain/labels.ts';
import type { MeterParseResult, ParseFailure } from '../domain/ocrParse.ts';
import { asciiDigitsToBurmese } from '../domain/numerals.ts';
import { parseLooseNumber, normalizeNumericInput } from '../domain/numerals.ts';
import { evaluateReading } from '../domain/safety.ts';
import { dayPart, wallClockToIso } from '../domain/time.ts';
import { EMERGENCY_SYMPTOMS, MEAL_CONTEXTS, SYMPTOMS, type GlucoseUnit, type Reading, type Symptom } from '../domain/types.ts';
import { convertGlucose, formatGlucose, roundGlucose } from '../domain/units.ts';
import { createId, issueMessage, validateReading, type ValidateIssue } from '../domain/validate.ts';
import type { Draft } from './draft.ts';
import { SafetyList } from './SafetyList.tsx';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;
type NumericKey = 'glucoseValue' | 'minutesSinceMealStart' | 'systolic' | 'diastolic' | 'pulse';

export function ReadingForm({
  draft,
  setDraft,
  editing,
  parsed,
  previewUrl,
  others,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft | ((current: Draft) => Draft)) => void;
  editing: Reading | null;
  parsed: MeterParseResult | null;
  previewUrl: string | null;
  others: Reading[];
  onSave: (reading: Reading) => boolean;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<ValidateIssue[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<NumericKey>(draft.type === 'glucose' ? 'glucoseValue' : 'systolic');
  const iso = wallClockToIso(draft.date, draft.time);
  const part = iso ? dayPart(new Date(iso)) : null;

  const preview = useMemo(() => {
    const candidate = toCandidate(draft, editing);
    const validated = validateReading(candidate);
    if (!validated.ok) return null;
    return evaluateReading(validated.value, others);
  }, [draft, editing, others]);

  function update(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function setNumber(key: NumericKey, value: string) {
    setTouched((current) => ({ ...current, [key]: true }));
    update({ [key]: normalizeNumericInput(value) });
  }

  function chooseUnit(next: GlucoseUnit) {
    setTouched((current) => ({ ...current, glucoseUnit: true }));
    setDraft((current) => {
      const amount = parseLooseNumber(current.glucoseValue);
      if (current.glucoseUnit && current.glucoseUnit !== next && amount != null) {
        const converted = roundGlucose(convertGlucose(amount, current.glucoseUnit, next), next);
        return { ...current, glucoseUnit: next, glucoseValue: formatGlucose(converted, next) };
      }
      return { ...current, glucoseUnit: next };
    });
  }

  function pressDigit(digit: (typeof DIGITS)[number]) {
    const key = active;
    setDraft((current) => {
      const existing = current[key];
      const next = digit === '⌫' ? existing.slice(0, -1) : normalizeNumericInput(existing + digit);
      return { ...current, [key]: next };
    });
    setTouched((current) => ({ ...current, [key]: true }));
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

  const glucoseUncertain = !!parsed?.glucose?.uncertain && !touched.glucoseValue;
  const unitUncertain = !!parsed && parsed.intent === 'glucose' && !parsed.unitExplicit && !touched.glucoseUnit;
  const failure = failureText(parsed?.failure ?? null);

  return (
    <div className="stack">
      {previewUrl ? (
        <figure className="card">
          <figcaption>စစ်ဆေးနေသော မူရင်းဓာတ်ပုံ</figcaption>
          <img src={previewUrl} alt="OCR အတွက် ရွေးထားသော မူရင်းဓာတ်ပုံ" />
        </figure>
      ) : null}
      {failure ? <p className="banner warning" role="status">{failure}</p> : null}
      {parsed && !failure ? <p className="hint">ဖတ်ထားသော တန်ဖိုးကို စစ်ပါ။ သိမ်းမည်ကို နှိပ်မှသာ မှတ်တမ်းတင်သည်။</p> : null}
      {parsed && parsed.alternatives.length > 0 ? (
        <div className="row" aria-label="အခြားကိန်းများ">
          {parsed.alternatives.map((item) => (
            <button
              key={`${item.value}-${item.confidence ?? 'x'}`}
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => {
                if (draft.type === 'glucose') setNumber('glucoseValue', String(item.value));
                else {
                  setDraft((current) => {
                    const value = String(item.value);
                    if (!current.systolic) return { ...current, systolic: value };
                    if (!current.diastolic) return { ...current, diastolic: value };
                    return { ...current, pulse: value };
                  });
                }
              }}
            >
              {item.value}
            </button>
          ))}
        </div>
      ) : null}
      {parsed && parsed.discarded.length > 0 ? (
        <details>
          <summary>မယူထားသော ကိန်းများ</summary>
          <ul>
            {parsed.discarded.map((item, index) => (
              <li key={`${item.raw}-${index}`}>{item.raw} · {discardLabel(item.reason)}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {parsed?.rawText ? (
        <details>
          <summary>OCR စာသားအတိုင်း</summary>
          <pre>{parsed.rawText}</pre>
        </details>
      ) : null}

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
          <label className={`field${glucoseUncertain ? ' uncertain' : ''}`}>
            သွေးဂလူးကို့စ် {glucoseUncertain ? '· မသေချာ' : ''}
            <input
              inputMode="decimal"
              value={draft.glucoseValue}
              aria-invalid={hasError(errors, 'glucoseValue')}
              onFocus={() => setActive('glucoseValue')}
              onChange={(event) => setNumber('glucoseValue', event.target.value)}
            />
            <span className="hint">မြန်မာဂဏန်းနှင့် အာရဗီဂဏန်း နှစ်မျိုးလုံးရိုက်နိုင်သည်။ {draft.glucoseValue ? asciiDigitsToBurmese(draft.glucoseValue) : ''}</span>
          </label>
          <div role="radiogroup" aria-label="ဂလူးကို့စ်ယူနစ်" className={`choice-grid${unitUncertain ? ' uncertain' : ''}`}>
            {(['mg/dL', 'mmol/L'] as const).map((unit) => (
              <button key={unit} type="button" className="choice" role="radio" aria-checked={draft.glucoseUnit === unit} onClick={() => chooseUnit(unit)}>
                {unit}
              </button>
            ))}
          </div>
          {draft.glucoseUnit && parseLooseNumber(draft.glucoseValue) != null ? (
            <p className="hint">
              ပြောင်းလဲပြထားသော တန်ဖိုး (သိမ်းမည့်ယူနစ်မဟုတ်ပါ) ·{' '}
              {formatGlucose(convertGlucose(parseLooseNumber(draft.glucoseValue) ?? 0, draft.glucoseUnit, draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL'), draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL')}{' '}
              {draft.glucoseUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}
            </p>
          ) : null}
          <div role="radiogroup" aria-label="အစာစားချိန်" className="choice-grid">
            {MEAL_CONTEXTS.map((context) => (
              <button
                key={context}
                type="button"
                className="choice"
                role="radio"
                aria-checked={draft.mealContext === context}
                onClick={() => update({ mealContext: context, minutesSinceMealStart: context === 'postmeal' ? draft.minutesSinceMealStart : '' })}
              >
                {MEAL_LABEL[context]}
              </button>
            ))}
          </div>
          {draft.mealContext === 'postmeal' ? (
            <label className="field">
              အစာစတင်စားချိန်မှ မိနစ်
              <input
                inputMode="numeric"
                value={draft.minutesSinceMealStart}
                onFocus={() => setActive('minutesSinceMealStart')}
                onChange={(event) => setNumber('minutesSinceMealStart', event.target.value)}
              />
              <span className="hint">မသိလျှင် ချန်လှပ်နိုင်သည်။ နာရီမှ မခန့်မှန်းပါ။</span>
            </label>
          ) : null}
        </div>
      ) : (
        <div className="grid-2">
          <NumberField label="အပေါ်သွေးပေါင် SYS" field="systolic" uncertain={!!parsed?.systolic?.uncertain && !touched.systolic} draft={draft} setActive={setActive} setNumber={setNumber} />
          <NumberField label="အောက်သွေးပေါင် DIA" field="diastolic" uncertain={!!parsed?.diastolic?.uncertain && !touched.diastolic} draft={draft} setActive={setActive} setNumber={setNumber} />
          <NumberField label="သွေးခုန်နှုန်း PUL (မထည့်လည်းရ)" field="pulse" uncertain={!!parsed?.pulse?.uncertain && !touched.pulse} draft={draft} setActive={setActive} setNumber={setNumber} />
        </div>
      )}

      <div className="pad" aria-label="ဂဏန်းခလုတ်">
        {DIGITS.map((digit) => (
          <button key={digit} type="button" onClick={() => pressDigit(digit)}>
            {digit === '⌫' ? 'ဖျက်' : digit}
            {digit !== '⌫' && digit !== '.' ? <small>{asciiDigitsToBurmese(digit)}</small> : null}
          </button>
        ))}
      </div>

      <fieldset className="stack">
        <legend>လက္ခဏာ</legend>
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => {
            const checked = draft.symptoms.includes(symptom);
            const emergency = (EMERGENCY_SYMPTOMS as readonly string[]).includes(symptom);
            return (
              <button
                key={symptom}
                type="button"
                className={`symptom${emergency ? ' emergency' : ''}`}
                aria-pressed={checked}
                onClick={() => update({ symptoms: toggleSymptom(draft.symptoms, symptom) })}
              >
                {emergency ? 'အရေးပေါ် · ' : ''}{SYMPTOM_LABEL[symptom]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="field">
        မှတ်ချက်
        <textarea value={draft.notes} maxLength={2000} onChange={(event) => update({ notes: event.target.value })} />
      </label>
      {errors.length > 0 ? (
        <ul className="error" role="alert">
          {errors.map((issue, index) => (
            <li key={`${issue.path}-${index}`}>{issueMessage(issue.code)}</li>
          ))}
        </ul>
      ) : null}
      <SafetyList notices={preview ?? []} />
      <div className="sticky-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>မသိမ်းပါ</button>
        <button type="button" className="btn btn-primary" onClick={save}>{editing ? 'ပြင်ဆင်ချက်သိမ်းမည်' : 'သိမ်းမည်'}</button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  field,
  uncertain,
  draft,
  setActive,
  setNumber,
}: {
  label: string;
  field: NumericKey;
  uncertain: boolean;
  draft: Draft;
  setActive: (field: NumericKey) => void;
  setNumber: (field: NumericKey, value: string) => void;
}) {
  return (
    <label className={`field${uncertain ? ' uncertain' : ''}`}>
      {label} {uncertain ? '· မသေချာ' : ''}
      <input inputMode="decimal" value={draft[field]} onFocus={() => setActive(field)} onChange={(event) => setNumber(field, event.target.value)} />
    </label>
  );
}

function toggleSymptom(current: Symptom[], symptom: Symptom): Symptom[] {
  return current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom];
}

function hasError(errors: ValidateIssue[], path: string): boolean {
  return errors.some((issue) => issue.path === path);
}

function failureText(failure: ParseFailure): string | null {
  switch (failure) {
    case 'empty':
      return 'ပုံထဲတွင် စာမတွေ့ပါ။ လက်ဖြင့်ထည့်ပါ။ အလိုအလျောက် မသိမ်းပါ။';
    case 'no-candidate':
      return 'ဖတ်ရှုမှုမှ သွေးတန်ဖိုးကို မခွဲနိုင်ပါ။ ရက်စွဲနှင့် မှတ်ဉာဏ်နံပါတ်ကို ဖယ်ထားသည်။ လက်ဖြင့်စစ်ပါ။';
    case 'ambiguous':
      return 'ကိန်းတစ်ခုထက်ပိုနေ၍ မရွေးရသေးပါ။ ကိုယ်တိုင်ရွေးပါ။ အလိုအလျောက် မသိမ်းပါ။';
    case 'low-confidence':
      return 'ဖတ်ရှုမှု မသေချာပါ။ တန်ဖိုးကို အလိုအလျောက် မဖြည့်ပါ။';
    default:
      return null;
  }
}

function discardLabel(reason: string): string {
  switch (reason) {
    case 'date':
    case 'date-line':
      return 'ရက်စွဲ';
    case 'time':
      return 'နာရီ';
    case 'memory':
      return 'မှတ်ဉာဏ်နံပါတ်';
    case 'year':
      return 'ခုနှစ်';
    default:
      return 'အပိုင်းအခြားပြင်ပ';
  }
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
