import { useMemo, useState, type ReactNode } from 'react';
import { DAYPART_LABEL, DAYPART_RANGE, MEAL_LABEL, SYMPTOM_LABEL } from '../domain/labels.ts';
import { normalizeNumericInput, parseLooseNumber } from '../domain/numbers.ts';
import { badgeFor, evaluateReading } from '../domain/safety.ts';
import { dayPart, formatTime12, wallClockToIso } from '../domain/time.ts';
import { EMERGENCY_SYMPTOMS, GLUCOSE_UNITS, MEAL_CONTEXTS, SYMPTOMS, type GlucoseUnit, type MealContext, type Reading, type Symptom } from '../domain/types.ts';
import { convertGlucose, formatGlucose, roundGlucose } from '../domain/units.ts';
import { createId, issueMessage, validateReading, type ValidateIssue } from '../domain/validate.ts';
import { badgeText, noticesFor, readingContext, readingValue } from './format.ts';
import type { Draft } from './draft.ts';
import { SafetyList } from './SafetyList.tsx';

type NumericKey = 'glucoseValue' | 'minutesSinceMealStart' | 'systolic' | 'diastolic' | 'pulse';

const MEAL_ICONS: Record<MealContext, string> = {
  fasting: '🌅',
  premeal: '🍽',
  postmeal: '🥣',
  random: '⏱',
  unknown: '❓',
};

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

  function chooseUnit(next: GlucoseUnit) {
    setDraft((current) => {
      const currentUnit = current.glucoseUnit || 'mg/dL';
      const amount = parseLooseNumber(current.glucoseValue);
      if (currentUnit !== next && amount != null) {
        const converted = roundGlucose(convertGlucose(amount, currentUnit, next), next);
        return { ...current, glucoseUnit: next, glucoseValue: formatGlucose(converted, next) };
      }
      return { ...current, glucoseUnit: next };
    });
  }

  function chooseMealContext(context: MealContext) {
    update({ mealContext: context, minutesSinceMealStart: context === 'postmeal' ? draft.minutesSinceMealStart : '' });
  }

  function toggleSymptom(symptom: Symptom) {
    if (draft.symptoms.includes(symptom)) {
      update({ symptoms: draft.symptoms.filter((item) => item !== symptom) });
    } else {
      update({ symptoms: [...draft.symptoms, symptom] });
    }
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

  const previewText = preview ? readingValue(preview.reading) : '';
  const previewUnitIndex = previewText.lastIndexOf(' ');
  const previewValue = previewUnitIndex > 0 ? previewText.slice(0, previewUnitIndex) : previewText;
  const previewUnit = previewUnitIndex > 0 ? previewText.slice(previewUnitIndex + 1) : null;
  const activeUnit = draft.glucoseUnit || 'mg/dL';

  return (
    <div className="stack add-layout">
      <div className="stack add-fields">
        {/* Date & Time Row - Compact */}
        <div className="card-soft stack" style={{ gap: '10px', padding: '14px 16px' }}>
          <div className="grid-2">
            <label className="field">
              <span className="field-title-sm">ရက်စွဲ (မြန်မာစံတော်ချိန်)</span>
              <span className="field-icon-wrap">
                <CalendarIcon />
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => update({ date: event.target.value })}
                  required
                />
              </span>
            </label>
            <label className="field">
              <span className="field-title-sm">အချိန် (UTC+6:30)</span>
              <span className="field-icon-wrap">
                <ClockIcon />
                <input
                  type="time"
                  value={draft.time}
                  onChange={(event) => update({ time: event.target.value })}
                  required
                />
              </span>
            </label>
          </div>
          <div className="daypart-meta-row">
            <span className={part ? 'daypart-pill' : 'daypart-pill daypart-pill-amber'}>
              {part ? `${DAYPART_LABEL[part]} (${DAYPART_RANGE[part]})` : 'အချိန်စစ်ပါ'}
            </span>
            {iso ? <span className="time-readout-pill">{formatTime12(new Date(iso))}</span> : null}
          </div>
        </div>

        {/* Glucose or BP Input Section */}
        {draft.type === 'glucose' ? (
          <div className="stack">
            {/* Hero Glucose Input Card */}
            <div className={`hero-input-card ${hasError(errors, 'glucoseValue') ? 'has-error' : ''}`}>
              <div className="hero-card-head">
                <span className="hero-input-label">သွေးဂလူးကို့စ် ပမာဏ</span>
                {/* Unit Switcher Pills */}
                <div className="unit-switch-group" role="radiogroup" aria-label="ဂလူးကို့စ်ယူနစ်">
                  {GLUCOSE_UNITS.map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      role="radio"
                      aria-checked={activeUnit === unit}
                      className={`unit-switch-btn ${activeUnit === unit ? 'active' : ''}`}
                      onClick={() => chooseUnit(unit)}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hero-field-input-box">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  placeholder={activeUnit === 'mmol/L' ? 'ဥပမာ - 6.1' : 'ဥပမာ - 110'}
                  value={draft.glucoseValue}
                  aria-invalid={hasError(errors, 'glucoseValue')}
                  className="hero-large-input"
                  onChange={(event) => setNumber('glucoseValue', event.target.value)}
                  autoFocus={!editing}
                />
                <span className="hero-unit-tag">{activeUnit}</span>
              </div>

              <p className="hero-input-tip">
                💡 ဖုန်း Numeric Keypad သို့မဟုတ် မြန်မာဂဏန်းဖြင့် ရိုက်ထည့်နိုင်ပါသည်
              </p>

              {activeUnit && parseLooseNumber(draft.glucoseValue) != null ? (
                <div className="conversion-banner">
                  တူညီသောတန်ဖိုး: <strong>
                    {formatGlucose(
                      convertGlucose(
                        parseLooseNumber(draft.glucoseValue) ?? 0,
                        activeUnit,
                        activeUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL',
                      ),
                      activeUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL',
                    )}
                  </strong> {activeUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}
                </div>
              ) : null}
            </div>

            {/* Meal Context Quick Pills */}
            <div className="card-soft stack" style={{ gap: '10px', padding: '14px 16px' }}>
              <span className="field-title">အစာစားချိန် (တစ်ခုရွေးပါ)</span>
              <div className="pills-grid" role="radiogroup" aria-label="အစာစားချိန်">
                {MEAL_CONTEXTS.map((context) => {
                  const isSelected = draft.mealContext === context;
                  return (
                    <button
                      key={context}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`pill-choice ${isSelected ? 'active' : ''}`}
                      onClick={() => chooseMealContext(context)}
                    >
                      <span className="pill-emoji">{MEAL_ICONS[context]}</span>
                      <span>{MEAL_LABEL[context]}</span>
                    </button>
                  );
                })}
              </div>

              {draft.mealContext === 'postmeal' ? (
                <div className="field field-fade-in" style={{ marginTop: '4px' }}>
                  <span className="field-head">
                    <span className="field-title-sm">အစာစတင်စားချိန်မှ မိနစ် (မသိလျှင် ချန်လှပ်နိုင်)</span>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="ဥပမာ - 120"
                    value={draft.minutesSinceMealStart}
                    onChange={(event) => setNumber('minutesSinceMealStart', event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          /* Blood Pressure Hero Card */
          <div className="bp-hero-card stack" style={{ gap: '14px' }}>
            <div className="hero-card-head">
              <span className="hero-input-label">သွေးပေါင်ချိန်နှင့် နှလုံးခုန်နှုန်း</span>
              <span className="bp-norm-pill">ပုံမှန်: 120 / 80</span>
            </div>

            <div className="bp-tiles">
              {/* Systolic */}
              <div className={`bp-tile ${hasError(errors, 'systolic') ? 'has-error' : ''}`}>
                <label className="bp-tile-header" htmlFor="bp-systolic">
                  <span>အပေါ်သွေး</span>
                  <span className="bp-tile-abbr">SYS</span>
                </label>
                <div className="bp-tile-input-row">
                  <input
                    id="bp-systolic"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="120"
                    value={draft.systolic}
                    aria-invalid={hasError(errors, 'systolic')}
                    className="bp-tile-input"
                    onChange={(event) => setNumber('systolic', event.target.value)}
                    autoFocus={!editing}
                  />
                </div>
                <span className="bp-tile-unit-label">mmHg</span>
              </div>

              {/* Diastolic */}
              <div className={`bp-tile ${hasError(errors, 'diastolic') ? 'has-error' : ''}`}>
                <label className="bp-tile-header" htmlFor="bp-diastolic">
                  <span>အောက်သွေး</span>
                  <span className="bp-tile-abbr">DIA</span>
                </label>
                <div className="bp-tile-input-row">
                  <input
                    id="bp-diastolic"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="80"
                    value={draft.diastolic}
                    aria-invalid={hasError(errors, 'diastolic')}
                    className="bp-tile-input"
                    onChange={(event) => setNumber('diastolic', event.target.value)}
                  />
                </div>
                <span className="bp-tile-unit-label">mmHg</span>
              </div>

              {/* Pulse */}
              <div className={`bp-tile ${hasError(errors, 'pulse') ? 'has-error' : ''}`}>
                <label className="bp-tile-header" htmlFor="bp-pulse">
                  <span>နှလုံးခုန်</span>
                  <span className="bp-tile-abbr">PUL</span>
                </label>
                <div className="bp-tile-input-row">
                  <input
                    id="bp-pulse"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="72"
                    value={draft.pulse}
                    aria-invalid={hasError(errors, 'pulse')}
                    className="bp-tile-input"
                    onChange={(event) => setNumber('pulse', event.target.value)}
                  />
                </div>
                <span className="bp-tile-unit-label">bpm (မထည့်လည်းရ)</span>
              </div>
            </div>

            <p className="hero-input-tip" style={{ margin: 0 }}>
              💡 အကွက်တစ်ခုချင်းစီကို နှိပ်၍ ဂဏန်းရိုက်ထည့်ပါ
            </p>
          </div>
        )}

        {/* Symptoms Section - Quick Toggle Pills */}
        <div className="card-soft stack" style={{ gap: '10px', padding: '14px 16px' }}>
          <div className="symptoms-header">
            <span className="field-title">ခံစားရသော လက္ခဏာများ (ရှိပါက နှိပ်ပါ)</span>
            {draft.symptoms.length > 0 ? (
              <button
                type="button"
                className="btn-link-action"
                onClick={() => update({ symptoms: [] })}
              >
                အားလုံးဖယ်မည် ({draft.symptoms.length})
              </button>
            ) : null}
          </div>

          <div className="symptoms-pills-wrap">
            {SYMPTOMS.map((symptom) => {
              const isSelected = draft.symptoms.includes(symptom);
              const isEmergency = (EMERGENCY_SYMPTOMS as readonly string[]).includes(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  aria-pressed={isSelected}
                  className={`symptom-choice-btn ${isSelected ? 'selected' : ''} ${isEmergency ? 'emergency' : ''}`}
                  onClick={() => toggleSymptom(symptom)}
                >
                  {isEmergency ? '🚨 ' : ''}
                  <span>{SYMPTOM_LABEL[symptom]}</span>
                  {isSelected ? <span className="check-mark">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes Field */}
        <label className="field">
          <span className="field-title-sm">မှတ်ချက် (မဖြစ်မနေ မလိုပါ)</span>
          <textarea
            rows={2}
            placeholder="ဆေးသောက်ချိန် သို့မဟုတ် အခြားကျန်းမာရေး အခြေအနေများ…"
            value={draft.notes}
            maxLength={2000}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </label>

        {/* Error Notification List */}
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

      {/* Real-time Validation Preview Card */}
      {preview ? (
        <section className="preview-card">
          <p className="preview-value">{previewValue}</p>
          {previewUnit ? <p className="preview-unit">{previewUnit}</p> : null}
          <p className="preview-meta">
            <span className="context-pill">{readingContext(preview.reading)}</span>
            {badgeText(preview.reading, others) ? (
              <span className={`badge ${badgeFor(noticesFor(preview.reading, others))}`}>
                {badgeText(preview.reading, others)}
              </span>
            ) : null}
          </p>
          <SafetyList notices={preview.notices} />
        </section>
      ) : null}

      {/* Sticky Bottom Actions - Thumb-friendly */}
      <div className="sticky-actions-bar">
        <button type="button" className="btn btn-quiet btn-cancel-action" onClick={onCancel}>
          <XIcon />
          မသိမ်းပါ
        </button>
        <button type="button" className="btn btn-primary btn-save-action" onClick={save}>
          <CheckIcon />
          {editing ? 'ပြင်ဆင်ချက်သိမ်းမည်' : 'သိမ်းဆည်းမည်'}
        </button>
      </div>
    </div>
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

function CalendarIcon() {
  return (
    <FormIcon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </FormIcon>
  );
}

function ClockIcon() {
  return (
    <FormIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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
    glucoseUnit: draft.glucoseUnit || 'mg/dL',
    mealContext: draft.mealContext,
    minutesSinceMealStart: draft.mealContext === 'postmeal' && draft.minutesSinceMealStart !== '' ? parseLooseNumber(draft.minutesSinceMealStart) : null,
  };
}
