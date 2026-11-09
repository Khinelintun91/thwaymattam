import { useMemo, useState } from 'react';
import { bpSeries, cappedDomain, CHART_GAP_MS, glucoseSeries, polylines, yDomain, type ChartPoint } from '../domain/chart.ts';
import { filterReadings } from '../domain/history.ts';
import { MEAL_LABEL } from '../domain/labels.ts';
import { BP_TARGET, FASTING_TARGET, POSTMEAL_TARGET_MAX, summarizeReadings, type MonthSummary } from '../domain/summary.ts';
import { dateKey, formatWallTime, shiftDateKey } from '../domain/time.ts';
import type { GlucoseUnit, MealContext, Reading } from '../domain/types.ts';
import { useLog } from '../store/LogProvider.tsx';

const CONTEXT_COLOR: Record<MealContext, string> = {
  fasting: '#1d4ed8',
  premeal: '#1d4e89',
  postmeal: '#8a4b12',
  random: '#5c4d7a',
  unknown: '#5e6b66',
};

const RANGE_OPTIONS = [
  { value: 1 as const, label: 'ဒီနေ့' },
  { value: 7 as const, label: 'ဒီအပတ်' },
  { value: 30 as const, label: 'ဒီလ' },
  { value: 'all' as const, label: 'အားလုံး' },
];

export function ChartsView() {
  const { readings } = useLog();
  const [days, setDays] = useState<1 | 7 | 30 | 'all'>(30);
  const [unit, setUnit] = useState<GlucoseUnit>('mg/dL');
  const ranged = useMemo(() => inRange(readings, days), [readings, days]);
  const mg = glucoseSeries(ranged, 'mg/dL');
  const mmol = glucoseSeries(ranged, 'mmol/L');
  const active = unit === 'mg/dL' ? mg : mmol;
  const pressure = bpSeries(ranged);
  const summary = useMemo(() => {
    if (ranged.length === 0) return null;
    const dates = ranged.map((reading) => dateKey(new Date(reading.recordedAt))).sort();
    return summarizeReadings(ranged, dates[0] ?? '', dates[dates.length - 1] ?? '');
  }, [ranged]);

  return (
    <div className="stack">
      <h2>ဂရပ်</h2>
      <p className="hint">အရောင်သည် အစာစားချိန်ဖြစ်သည်။ ကောင်း/မကောင်း မဟုတ်ပါ။ mg/dL နှင့် mmol/L ကို ခွဲပြသည်။ အချက်အလက်မရှိသော ကာလကို မျဉ်းမဆက်ပါ။</p>
      <div className="segmented" role="group" aria-label="ကာလ">
        {RANGE_OPTIONS.map((option) => (
          <button key={String(option.value)} type="button" aria-pressed={days === option.value} onClick={() => setDays(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label="ဂလူးကို့စ်ယူနစ်">
        <button type="button" aria-pressed={unit === 'mg/dL'} onClick={() => setUnit('mg/dL')}>mg/dL</button>
        <button type="button" aria-pressed={unit === 'mmol/L'} onClick={() => setUnit('mmol/L')}>mmol/L</button>
      </div>
      <section className="card stack">
        <h3>ဂလူးကို့စ် ({unit})</h3>
        <Trend
          yLabel={unit}
          cap={unit === 'mg/dL' ? 300 : 16.7}
          band={unit === 'mg/dL' ? { min: 70, max: 180, label: '70–180' } : { min: 3.9, max: 10.0, label: '3.9–10.0' }}
          guides={unit === 'mg/dL' ? [{ y: 70, label: '၇၀' }, { y: 300, label: '၃၀၀' }] : [{ y: 3.9, label: '၃.၉' }, { y: 16.7, label: '၁၆.၇' }]}
          series={active.map((series) => ({
            id: series.context,
            label: MEAL_LABEL[series.context],
            color: CONTEXT_COLOR[series.context],
            dashed: series.context === 'unknown',
            points: series.points,
          }))}
        />
        <GlucoseLine summary={summary} />
        <p className="hint">mmol ဂရပ် {mmol.reduce((sum, series) => sum + series.points.length, 0)} မှတ်၊ mg/dL ဂရပ် {mg.reduce((sum, series) => sum + series.points.length, 0)} မှတ်။</p>
        <PointTable rows={active.flatMap((series) => series.points.map((point) => ({ ...point, label: MEAL_LABEL[series.context] })))} valueLabel={unit} />
      </section>
      <section className="card stack">
        <h3>သွေးပေါင် (mmHg)</h3>
        <Trend
          yLabel="mmHg"
          cap={200}
          guides={[{ y: 180, label: 'SYS ၁၈၀' }, { y: 120, label: 'DIA ၁၂၀' }]}
          series={[
            { id: 'sys', label: 'အပေါ်', color: '#1d4ed8', points: pressure.systolic },
            { id: 'dia', label: 'အောက်', color: '#1d4e89', points: pressure.diastolic },
          ]}
        />
        <BpLine summary={summary} />
      </section>
      <section className="card stack">
        <h3>သွေးခုန်နှုန်း (တစ်မိနစ်)</h3>
        <Trend
          yLabel="ခုန်နှုန်း"
          cap={150}
          guides={[]}
          series={[{ id: 'pul', label: 'ခုန်နှုန်း', color: '#8a4b12', points: pressure.pulse }]}
        />
      </section>
    </div>
  );
}

function GlucoseLine({ summary }: { summary: MonthSummary | null }) {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.fasting.avg != null) {
    parts.push(`အစာရှောင် ပျမ်းမျှ ${summary.fasting.avg} mg/dL (target ${FASTING_TARGET.min}–${FASTING_TARGET.max})`);
  }
  if (summary.postmeal.avg != null) {
    parts.push(`အစာစားပြီး ပျမ်းမျှ ${summary.postmeal.avg} mg/dL (target ${POSTMEAL_TARGET_MAX} အောက်)`);
  }
  if (parts.length === 0) return null;
  return <p className="hint">{parts.join(' · ')}</p>;
}

function BpLine({ summary }: { summary: MonthSummary | null }) {
  if (!summary || summary.bp.avgSys == null || summary.bp.avgDia == null) return null;
  const parts = [`သွေးပေါင် ပျမ်းမျှ ${summary.bp.avgSys}/${summary.bp.avgDia} (target ${BP_TARGET.sys}/${BP_TARGET.dia} အောက်)`];
  if (summary.bp.avgPulse != null) parts.push(`ခုန်နှုန်း ပျမ်းမျှ ${summary.bp.avgPulse}`);
  return <p className="hint">{parts.join(' · ')}</p>;
}

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
  if (values.length === 0) return <p>ဤကာလတွင် ပြစရာမရှိပါ။</p>;
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
              fill="#1d4ed8"
              fillOpacity="0.07"
            />
            <text x={width - pad.r - 4} y={yOf(Math.min(band.max, domain.max)) + 13} fontSize="11" textAnchor="end" fill="#1d4ed8">
              {band.label}
            </text>
          </g>
        ) : null}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yOf(tick)} y2={yOf(tick)} stroke="#d3e1da" />
            <text x={4} y={yOf(tick) + 4} fontSize="12" fill="#3c524c">{formatTick(tick)}</text>
          </g>
        ))}
        {guides.map((guide) => (
          guide.y >= domain.min && guide.y <= domain.max ? (
            <g key={guide.label}>
              <line x1={pad.l} x2={width - pad.r} y1={yOf(guide.y)} y2={yOf(guide.y)} stroke="#7d1524" strokeDasharray="4 4" />
              <text x={width - pad.r - 48} y={yOf(guide.y) - 4} fontSize="11" fill="#7d1524">{guide.label}</text>
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
                    <title>{`${item.label} ${point.y} ${formatWallTime(new Date(point.t))}`}</title>
                  </path>
                  <text x={cx} y={Math.max(11, cy - 11)} fontSize="11" textAnchor="middle" fill={item.color}>
                    {formatTick(point.y)}
                  </text>
                </g>
              );
            }
            return (
              <circle key={`${item.id}-${point.id}-${point.y}`} cx={cx} cy={cy} r="4.5" fill={item.color}>
                <title>{`${item.label} ${point.y} ${formatWallTime(new Date(point.t))}`}</title>
              </circle>
            );
          }),
        )}
      </svg>
      <div className="row">
        {series.filter((item) => item.points.length > 0).map((item) => (
          <span key={item.id} className="badge" style={{ color: item.color }}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function PointTable({ rows, valueLabel }: { rows: (ChartPoint & { label: string })[]; valueLabel: string }) {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return null;
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">{valueLabel} ဇယား</caption>
        <thead>
          <tr><th>အချိန်</th><th>အခြေအနေ</th><th>{valueLabel}</th></tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={`${row.id}-${row.y}`}>
              <td>{dateKey(new Date(row.t))} {formatWallTime(new Date(row.t))}</td>
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
