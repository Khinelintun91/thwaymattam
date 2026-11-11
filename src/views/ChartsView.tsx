import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSlidingPill } from '../components/useSlidingPill.ts';
import { bpSeries, cappedDomain, CHART_GAP_MS, glucoseSeries, polylines, yDomain, type ChartPoint } from '../domain/chart.ts';
import { filterReadings, groupByDay } from '../domain/history.ts';
import { MEAL_LABEL, SYMPTOM_LABEL } from '../domain/labels.ts';
import { summarizeReadings, type MonthSummary, type ReadingStatus, type TargetCategory, evaluateGlucose, evaluateBp, classifyReading } from '../domain/summary.ts';
import { dateKey, formatTime12, shiftDateKey } from '../domain/time.ts';
import type { BpReading, GlucoseUnit, MealContext, Reading } from '../domain/types.ts';
import { convertGlucose, formatGlucose } from '../domain/units.ts';
import { dayHeading, displayNotes } from '../components/format.ts';
import { useLog } from '../store/LogProvider.tsx';

const RANGE_OPTIONS = [
  { value: 1 as const, label: 'ဒီနေ့' },
  { value: 7 as const, label: 'ဒီအပတ်' },
  { value: 30 as const, label: 'ဒီလ' },
  { value: 'all' as const, label: 'အားလုံး' },
];

export type { ReadingStatus, TargetCategory };
export { evaluateGlucose, evaluateBp, classifyReading };

export function ChartsView() {
  const { readings } = useLog();
  const [days, setDays] = useState<1 | 7 | 30 | 'all'>(30);
  const [metric, setMetric] = useState<'glucose' | 'bp'>('glucose');
  const [unit, setUnit] = useState<GlucoseUnit>('mg/dL');
  const [showTrend, setShowTrend] = useState(true);

  const rangeRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  useSlidingPill(rangeRef, days);
  useSlidingPill(metricRef, metric);
  useSlidingPill(unitRef, unit);

  const ranged = useMemo(() => inRange(readings, days), [readings, days]);

  const activeReadings = useMemo(() => {
    return ranged.filter((r) => r.type === metric);
  }, [ranged, metric]);

  const groupedDays = useMemo(() => {
    return groupByDay(activeReadings);
  }, [activeReadings]);

  // Donut chart slices & metrics
  const donutStats = useMemo(() => {
    let normalCount = 0;
    let highCount = 0;
    let alertCount = 0;
    let unknownCount = 0;

    for (const r of activeReadings) {
      const st = r.type === 'glucose' ? evaluateGlucose(r) : evaluateBp(r);
      if (st.category === 'normal') normalCount++;
      else if (st.category === 'high') highCount++;
      else if (st.category === 'alert') alertCount++;
      else if (st.category === 'unknown') unknownCount++;
    }

    const total = activeReadings.length;
    const normalPct = total > 0 ? Math.round((normalCount / total) * 100) : 0;
    const highPct = total > 0 ? Math.round((highCount / total) * 100) : 0;
    const alertPct = total > 0 ? Math.round((alertCount / total) * 100) : 0;
    const unknownPct = total > 0 && unknownCount > 0 ? Math.max(0, 100 - normalPct - highPct - alertPct) : 0;

    return {
      total,
      normalCount,
      highCount,
      alertCount,
      unknownCount,
      normalPct,
      highPct,
      alertPct,
      unknownPct,
    };
  }, [activeReadings]);

  const summary = useMemo(() => {
    if (ranged.length === 0) return null;
    const dates = ranged.map((reading) => dateKey(new Date(reading.recordedAt))).sort();
    return summarizeReadings(ranged, dates[0] ?? '', dates[dates.length - 1] ?? '');
  }, [ranged]);

  // Series for optional trend line graph
  const mg = glucoseSeries(ranged, 'mg/dL');
  const mmol = glucoseSeries(ranged, 'mmol/L');
  const activeSeries = unit === 'mg/dL' ? mg : mmol;
  const pressure = bpSeries(ranged);

  return (
    <div className="stack charts-modern">
      <div className="charts-top-header">
        <div>
          <h2>ကျန်းမာရေး သုံးသပ်ချက်</h2>
          <p className="charts-sub-p">ပစ်မှတ်အတွင်းရှိမှု အချိုးအစားနှင့် နေ့စဉ်အခြေအနေ</p>
        </div>
      </div>

      {/* Main filter controls */}
      <div className="charts-controls-grid">
        <div className="segmented" ref={rangeRef} role="group" aria-label="ကာလ">
          {RANGE_OPTIONS.map((option) => (
            <button key={String(option.value)} type="button" aria-pressed={days === option.value} onClick={() => setDays(option.value)}>
              {option.label}
            </button>
          ))}
        </div>

        <div className="charts-type-row">
          <div className="segmented" ref={metricRef} role="group" aria-label="အမျိုးအစား">
            <button type="button" aria-pressed={metric === 'glucose'} onClick={() => setMetric('glucose')}>
              သွေးချို (ဂလူးကို့စ်)
            </button>
            <button type="button" aria-pressed={metric === 'bp'} onClick={() => setMetric('bp')}>
              သွေးပေါင်
            </button>
          </div>

          {metric === 'glucose' && (
            <div className="segmented segmented-sm" ref={unitRef} role="group" aria-label="ဂလူးကို့စ်ယူနစ်">
              <button type="button" aria-pressed={unit === 'mg/dL'} onClick={() => setUnit('mg/dL')}>mg/dL</button>
              <button type="button" aria-pressed={unit === 'mmol/L'} onClick={() => setUnit('mmol/L')}>mmol/L</button>
            </div>
          )}
        </div>
      </div>

      {/* Top Section: Donut Chart Card */}
      <section className="card donut-card">
        <div className="donut-card-head">
          <h3>
            {metric === 'glucose' ? `သွေးချို ပစ်မှတ်အချိုးအစား (${unit})` : 'သွေးပေါင် ပစ်မှတ်အချိုးအစား (mmHg)'}
          </h3>
          <span className="donut-target-note">
            {metric === 'glucose' ? 'ပစ်မှတ်: အစာရှောင် 80–130 · စားပြီး <180' : 'ပစ်မှတ်: < 130/80 mmHg'}
          </span>
        </div>

        {donutStats.total === 0 ? (
          <div className="chart-empty">
            <span className="chart-empty-icon" aria-hidden="true"><FlatChartIcon /></span>
            <p>ရွေးချယ်ထားသော ကာလတွင် မှတ်တမ်းမရှိသေးပါ။</p>
          </div>
        ) : (
          <div className="donut-content">
            <DonutChart
              slices={[
                { id: 'normal', label: 'ပုံမှန်', count: donutStats.normalCount, percent: donutStats.normalPct, color: '#10B981' },
                { id: 'high', label: 'မြင့်', count: donutStats.highCount, percent: donutStats.highPct, color: '#F59E0B' },
                { id: 'alert', label: 'သတိပြုရန်', count: donutStats.alertCount, percent: donutStats.alertPct, color: '#EF4444' },
                ...(metric === 'glucose' || donutStats.unknownCount > 0
                  ? [{ id: 'unknown', label: 'အခြေအနေမသိ', count: donutStats.unknownCount, percent: donutStats.unknownPct, color: '#94A3B8' }]
                  : []),
              ]}
              centerValue={`${donutStats.normalPct}%`}
              centerLabel="ပုံမှန်ပစ်မှတ်"
              centerSub={`စုစုပေါင်း ${donutStats.total} ကြိမ်`}
            />

            {/* Averages Row */}
            {metric === 'glucose' ? (
              <GlucoseAverages summary={summary} unit={unit} />
            ) : (
              <BpAverages summary={summary} activeReadings={activeReadings} />
            )}
          </div>
        )}
      </section>

      {/* Bottom Section: Simple Daily Breakdown Cards */}
      <section className="daily-breakdown-section">
        <div className="daily-section-head">
          <h3>နေ့စဉ် မှတ်တမ်းများ</h3>
          <span className="daily-section-count">
            {activeReadings.length > 0 ? `${activeReadings.length} ကြိမ် မှတ်ထားသည်` : 'မှတ်တမ်းမရှိပါ'}
          </span>
        </div>

        {groupedDays.length === 0 ? (
          <div className="card empty-daily-card">
            <p className="muted">ဤကာလတွင် ပြစရာ နေ့စဉ်မှတ်တမ်း မရှိပါ။</p>
          </div>
        ) : (
          <div className="daily-cards-stack">
            {groupedDays.map((dayGroup) => (
              <article key={dayGroup.date} className="card daily-card">
                <div className="daily-card-head">
                  <div className="daily-card-date">
                    <CalendarIcon />
                    <strong>{dayHeading(dayGroup.date)}</strong>
                  </div>
                  <span className="daily-card-count">{dayGroup.items.length} ကြိမ်</span>
                </div>

                <div className="daily-items-list">
                  {dayGroup.items.map((reading) => (
                    <DailyReadingRow key={reading.id} reading={reading} targetUnit={unit} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Optional Trend Graph toggle for reference */}
      <div className="trend-toggle-area">
        <button
          type="button"
          className="btn btn-quiet trend-toggle-btn"
          onClick={() => setShowTrend(!showTrend)}
        >
          <TrendIcon />
          <span>{showTrend ? 'မျဉ်းကွေးဂရပ်ကို ဖျောက်မည်' : 'မျဉ်းကွေးဂရပ် ကြည့်မည် (အသေးစိတ်)'}</span>
        </button>
      </div>

      {showTrend && (
        <section className="card stack chart-card trend-drawer">
          <div className="chart-card-head">
            <h3>{metric === 'glucose' ? `ဂလူးကို့စ် မျဉ်းကွေး (${unit})` : 'သွေးပေါင် မျဉ်းကွေး (mmHg)'}</h3>
            <span className="icon-well" aria-hidden="true"><ChartIcon /></span>
          </div>

          {metric === 'glucose' ? (
            <>
              <Trend
                yLabel={unit}
                cap={unit === 'mg/dL' ? 300 : 16.7}
                band={unit === 'mg/dL' ? { min: 70, max: 180, label: '70–180' } : { min: 3.9, max: 10.0, label: '3.9–10.0' }}
                guides={unit === 'mg/dL' ? [{ y: 70, label: '၇၀' }, { y: 300, label: '၃၀၀' }] : [{ y: 3.9, label: '၃.၉' }, { y: 16.7, label: '၁၆.၇' }]}
                series={activeSeries.map((series) => ({
                  id: series.context,
                  label: MEAL_LABEL[series.context],
                  color: CONTEXT_COLOR[series.context],
                  dashed: series.context === 'unknown',
                  points: series.points,
                }))}
              />
              <PointTable
                rows={activeSeries.flatMap((series) =>
                  series.points.map((point) => ({ ...point, label: MEAL_LABEL[series.context] }))
                )}
                valueLabel={unit}
              />
            </>
          ) : (
            <>
              <Trend
                yLabel="mmHg"
                cap={200}
                guides={[{ y: 180, label: 'SYS ၁၈၀' }, { y: 120, label: 'DIA ၁၂၀' }]}
                series={[
                  { id: 'sys', label: 'အပေါ် (SYS)', color: '#3B5BF5', points: pressure.systolic },
                  { id: 'dia', label: 'အောက် (DIA)', color: '#7C93FA', points: pressure.diastolic },
                ]}
              />
              <PointTable
                rows={pressure.systolic
                  .map((point) => ({ ...point, label: 'အပေါ် (SYS)' }))
                  .concat(pressure.diastolic.map((point) => ({ ...point, label: 'အောက် (DIA)' })))}
                valueLabel="mmHg"
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/* Donut Chart Component */
interface DonutSlice {
  id: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

function DonutChart({
  slices,
  centerValue,
  centerLabel,
  centerSub,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  centerSub: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const size = 180;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="donut-wrap">
      <div className="donut-chart-container">
        <svg
          className="donut-svg"
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${centerLabel} စက်ဝိုင်းပုံဇယား`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line, #E2E8F0)"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            slices.map((slice) => {
              if (slice.count <= 0) return null;
              const strokeDasharray = `${(slice.percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += slice.percent;

              return (
                <circle
                  key={slice.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ transition: 'stroke-dasharray 0.3s ease, stroke-dashoffset 0.3s ease' }}
                />
              );
            })}
        </svg>

        <div className="donut-center-info">
          <span className="donut-center-pct">{centerValue}</span>
          <span className="donut-center-label">{centerLabel}</span>
          <span className="donut-center-sub">{centerSub}</span>
        </div>
      </div>

      <div className={`donut-legend-grid ${slices.some((s) => s.id === "unknown") ? "has-unknown" : ""}`}>

        {slices.map((slice) => (
          <div key={slice.id} className="donut-legend-card">
            <div className="donut-legend-top">
              <span className="donut-legend-dot" style={{ backgroundColor: slice.color }} />
              <span className="donut-legend-title">{slice.label}</span>
            </div>
            <div className="donut-legend-bottom">
              <strong className="donut-legend-count">{slice.count} ကြိမ်</strong>
              <span className="donut-legend-pct">({slice.percent}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Daily Reading Row */
function DailyReadingRow({ reading, targetUnit }: { reading: Reading; targetUnit: GlucoseUnit }) {
  const time = formatTime12(new Date(reading.recordedAt));
  const notes = displayNotes(reading);

  if (reading.type === 'glucose') {
    const status = evaluateGlucose(reading);
    const val = convertGlucose(reading.glucoseValue, reading.glucoseUnit, targetUnit);
    const displayVal = formatGlucose(val, targetUnit);
    const mealLabel = MEAL_LABEL[reading.mealContext];
    const minutes = reading.minutesSinceMealStart ? ` · ${reading.minutesSinceMealStart} မိနစ်` : '';

    return (
      <div className="daily-item-row">
        <div className="daily-item-meta">
          <span className="daily-item-time">{time}</span>
          <span className="daily-item-context">{mealLabel}{minutes}</span>
        </div>

        <div className="daily-item-right">
          <span className="daily-item-value">
            <strong>{displayVal}</strong> <small>{targetUnit}</small>
          </span>
          <span className={`status-pill ${status.badgeClass}`}>{status.label}</span>
        </div>

        {(notes || reading.symptoms.length > 0) && (
          <div className="daily-item-notes">
            {reading.symptoms.length > 0 && (
              <span className="daily-item-symptom-tag">
                {reading.symptoms.map((s) => SYMPTOM_LABEL[s]).join(', ')}
              </span>
            )}
            {notes && <span className="daily-item-note-text">{notes}</span>}
          </div>
        )}
      </div>
    );
  }

  // Blood Pressure
  const status = evaluateBp(reading);
  const pulseText = reading.pulse ? ` · ခုန်နှုန်း ${reading.pulse}` : '';

  return (
    <div className="daily-item-row">
      <div className="daily-item-meta">
        <span className="daily-item-time">{time}</span>
        <span className="daily-item-context">သွေးပေါင်{pulseText}</span>
      </div>

      <div className="daily-item-right">
        <span className="daily-item-value">
          <strong>{reading.systolic}/{reading.diastolic}</strong> <small>mmHg</small>
        </span>
        <span className={`status-pill ${status.badgeClass}`}>{status.label}</span>
      </div>

      {(notes || reading.symptoms.length > 0) && (
        <div className="daily-item-notes">
          {reading.symptoms.length > 0 && (
            <span className="daily-item-symptom-tag">
              {reading.symptoms.map((s) => SYMPTOM_LABEL[s]).join(', ')}
            </span>
          )}
          {notes && <span className="daily-item-note-text">{notes}</span>}
        </div>
      )}
    </div>
  );
}

/* Glucose Averages */
function GlucoseAverages({ summary, unit }: { summary: MonthSummary | null; unit: GlucoseUnit }) {
  if (!summary) return null;
  const avg = (mg: number) => (unit === 'mmol/L' ? formatGlucose(convertGlucose(mg, 'mg/dL', 'mmol/L'), 'mmol/L') : String(mg));
  const items: { value: string; label: string }[] = [];
  if (summary.fasting.avg != null) {
    items.push({ value: `${avg(summary.fasting.avg)} ${unit}`, label: 'အစာရှောင် ပျမ်းမျှ (80–130)' });
  }
  if (summary.postmeal.avg != null) {
    items.push({ value: `${avg(summary.postmeal.avg)} ${unit}`, label: 'အစာစားပြီး ပျမ်းမျှ (<180)' });
  }
  if (items.length === 0) return null;
  return (
    <div className="donut-avg-strip">
      {items.map((item) => (
        <div key={item.label} className="donut-avg-block">
          <span className="donut-avg-val">{item.value}</span>
          <span className="donut-avg-lbl">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* BP Averages */
function BpAverages({ summary, activeReadings }: { summary: MonthSummary | null; activeReadings: Reading[] }) {
  if (!summary || summary.bp.avgSys == null || summary.bp.avgDia == null) return null;
  const bpList = activeReadings.filter((r): r is BpReading => r.type === 'bp');
  const maxSys = bpList.length > 0 ? Math.max(...bpList.map((r) => r.systolic)) : null;

  return (
    <div className="donut-avg-strip">
      <div className="donut-avg-block">
        <span className="donut-avg-val">{summary.bp.avgSys}/{summary.bp.avgDia} <small>mmHg</small></span>
        <span className="donut-avg-lbl">ပျမ်းမျှသွေးပေါင် (target &lt; 130/80)</span>
      </div>
      {maxSys != null && (
        <div className="donut-avg-block">
          <span className="donut-avg-val">{maxSys} <small>mmHg</small></span>
          <span className="donut-avg-lbl">အမြင့်ဆုံး အပေါ်သွေးပေါင်</span>
        </div>
      )}
    </div>
  );
}

const CONTEXT_COLOR: Record<MealContext, string> = {
  fasting: '#3B5BF5',
  premeal: '#7C93FA',
  postmeal: '#1E2F8F',
  random: '#8B5CF6',
  unknown: '#94A3B8',
};

function inRange(readings: Reading[], days: 1 | 7 | 30 | 'all'): Reading[] {
  if (days === 'all') return readings;
  const start = shiftDateKey(dateKey(new Date()), 1 - days);
  if (!start) return readings;
  return filterReadings(readings, { type: 'all', context: 'all', unit: 'all', from: start, to: '' });
}

function Trend({
  series,
  guides,
  yLabel,
  cap,
  band,
}: {
  series: { id: string; label: string; color: string; dashed?: boolean; points: ChartPoint[] }[];
  guides: { y: number; label: string }[];
  yLabel: string;
  cap?: number;
  band?: { min: number; max: number; label: string };
}) {
  const values = series.flatMap((item) => item.points.map((point) => point.y));
  if (values.length === 0) {
    return (
      <div className="chart-empty">
        <span className="chart-empty-icon" aria-hidden="true"><FlatChartIcon /></span>
        <p>ဤကာလတွင် ပြစရာမရှိပါ။</p>
      </div>
    );
  }
  const domain = cap == null ? yDomain(values, guides.map((guide) => guide.y)) : cappedDomain(values, cap, guides.map((guide) => guide.y));
  const times = series.flatMap((item) => item.points.map((point) => point.t));
  let tMin = Math.min(...times);
  let tMax = Math.max(...times);
  if (tMin === tMax) {
    tMin -= 3_600_000;
    tMax += 3_600_000;
  }
  const width = 640;
  const height = 280;
  const pad = { l: 52, r: 12, t: 16, b: 28 };
  const xOf = (t: number) => pad.l + ((t - tMin) / (tMax - tMin)) * (width - pad.l - pad.r);
  const clampY = (y: number) => (cap == null ? y : Math.min(y, cap));
  const yOf = (y: number) => pad.t + (1 - (clampY(y) - domain.min) / (domain.max - domain.min)) * (height - pad.t - pad.b);
  const ticks = [domain.min, (domain.min + domain.max) / 2, domain.max];
  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} ဂရပ်`}>
        {band && band.max > domain.min && band.min < domain.max ? (
          <g>
            <rect
              x={pad.l}
              width={width - pad.l - pad.r}
              y={yOf(Math.min(band.max, domain.max))}
              height={Math.max(0, yOf(Math.max(band.min, domain.min)) - yOf(Math.min(band.max, domain.max)))}
              fill="var(--chart-band)"
              rx="8"
            />
            <text x={width - pad.r - 4} y={yOf(Math.min(band.max, domain.max)) + 13} fontSize="11" textAnchor="end" fill="var(--accent)">
              {band.label}
            </text>
          </g>
        ) : null}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yOf(tick)} y2={yOf(tick)} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={4} y={yOf(tick) + 4} fontSize="11" fill="var(--chart-tick)">{formatTick(tick)}</text>
          </g>
        ))}
        {guides.map((guide) => (
          guide.y >= domain.min && guide.y <= domain.max ? (
            <g key={guide.label}>
              <line x1={pad.l} x2={width - pad.r} y1={yOf(guide.y)} y2={yOf(guide.y)} stroke="var(--chart-guide)" strokeWidth="1.25" strokeDasharray="4 4" />
              <text x={width - pad.r - 48} y={yOf(guide.y) - 4} fontSize="11" fill="var(--chart-guide)">{guide.label}</text>
            </g>
          ) : null
        ))}
        {series.map((item) =>
          polylines(item.points.map((point) => ({ ...point, y: clampY(point.y) })), CHART_GAP_MS).map((line, index) =>
            line.length > 1 ? (
              <polyline
                key={`${item.id}-${index}`}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={item.dashed ? '6 4' : undefined}
                points={line.map((point) => `${xOf(point.t)},${yOf(point.y)}`).join(' ')}
              />
            ) : null,
          ),
        )}
        {series.flatMap((item) =>
          item.points.map((point) => {
            const capped = cap != null && point.y > cap;
            const cx = xOf(point.t);
            const cy = yOf(point.y);
            if (capped) {
              return (
                <g key={`${item.id}-${point.id}-${point.y}`}>
                  <path d={`M ${cx} ${cy - 8} L ${cx + 6} ${cy + 4} L ${cx - 6} ${cy + 4} Z`} fill={item.color}>
                    <title>{`${item.label} ${point.y} ${formatTime12(new Date(point.t))}`}</title>
                  </path>
                  <text x={cx} y={Math.max(11, cy - 11)} fontSize="11" textAnchor="middle" fill={item.color}>
                    {formatTick(point.y)}
                  </text>
                </g>
              );
            }
            return (
              <circle key={`${item.id}-${point.id}-${point.y}`} cx={cx} cy={cy} r="4.5" fill={item.color} stroke="#fff" strokeWidth="2">
                <title>{`${item.label} ${point.y} ${formatTime12(new Date(point.t))}`}</title>
              </circle>
            );
          }),
        )}
      </svg>
      <div className="row legend">
        {series.filter((item) => item.points.length > 0).map((item) => (
          <span key={item.id} className="badge" style={{ '--series': item.color } as CSSProperties}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function PointTable({ rows, valueLabel }: { rows: (ChartPoint & { label: string })[]; valueLabel: string }) {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return null;
  return (
    <div className="table-wrap chart-table sr-only">
      <table>
        <caption className="sr-only">{valueLabel} ဇယား</caption>
        <thead>
          <tr>
            <th scope="col">အချိန်</th>
            <th scope="col">အခြေအနေ</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={`${row.id}-${row.y}-${row.t}`}>
              <td>{dateKey(new Date(row.t))} {formatTime12(new Date(row.t))}</td>
              <td>{row.label}</td>
              <td>{row.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 40) return String(Math.round(value));
  return (Math.round(value * 10) / 10).toFixed(1);
}

function ChartsIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ChartIcon() {
  return (
    <ChartsIcon>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </ChartsIcon>
  );
}

function TrendIcon() {
  return (
    <ChartsIcon>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </ChartsIcon>
  );
}

function CalendarIcon() {
  return (
    <ChartsIcon>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </ChartsIcon>
  );
}

function FlatChartIcon() {
  return (
    <ChartsIcon>
      <path d="M3 3v18h18" />
      <path d="M7 15h10" />
    </ChartsIcon>
  );
}
