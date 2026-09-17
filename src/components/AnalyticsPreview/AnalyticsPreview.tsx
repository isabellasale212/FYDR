'use client';

import { useId, useState } from 'react';

/* THE ANALYTICS DESIGN PREVIEW (17 Sept 2026): four charts drawn by hand as
 * inline SVG from the sample arrays the page file defines, and three
 * dropdowns — group, date range, measure — that are plain client state.
 * Nothing here reads the server: the page passes the sample in as props
 * and this component only chooses which of its series to draw. No chart
 * library, no new colour: every mark is a System A token, the same ones the
 * schedule's session types and the profile's dials already use, and every
 * state is also said in words — a legend, a caption, and a visually-hidden
 * table of every value under each chart (the AnalyticsPanel convention), so
 * colour is never the only carrier.
 *
 * The SVGs stretch to the card (preserveAspectRatio="none") with
 * non-scaling strokes, as AnalyticsPanel does, so nothing inside them is
 * text: the axis labels, the units, the legend and the readouts are HTML
 * beside and beneath the plot. */

export type GroupKey = 'forwards' | 'backs';
export type MeasureKey = 'session_load' | 'total_distance';

export type PreviewSample = {
  /** Week-commencing labels, oldest first, twelve of them. */
  weeks: readonly string[];
  /** Per group, one value a week: the measure summed per athlete over the week, then averaged across the group. */
  weekly: Record<MeasureKey, Record<GroupKey, readonly number[]>>;
  /** One row an athlete: the trailing ratio as it stands today. */
  acwr: readonly { name: string; group: GroupKey; ratio: number }[];
  /** Per group, one value a day for 84 days, oldest first: the group's mean readiness. */
  readiness: Record<GroupKey, readonly number[]>;
  /** Per group, per session type, one value a week: metres per athlete. */
  distanceByType: Record<GroupKey, Record<'training' | 'match' | 'testing', readonly number[]>>;
};

type Props = { sample: PreviewSample };

const GROUPS: { key: 'squad' | GroupKey; label: string }[] = [
  { key: 'squad', label: 'Whole squad' },
  { key: 'forwards', label: 'Forwards' },
  { key: 'backs', label: 'Backs' },
];
const RANGES: { weeks: 4 | 8 | 12; label: string }[] = [
  { weeks: 4, label: 'Last 4 weeks' },
  { weeks: 8, label: 'Last 8 weeks' },
  { weeks: 12, label: 'Last 12 weeks' },
];
const MEASURES: {
  key: MeasureKey;
  label: string;
  unit: string;
  caption: string;
}[] = [
  {
    key: 'session_load',
    label: 'Session load',
    unit: 'AU',
    caption:
      'Session load is the athlete’s CR-10 rating of the session multiplied by its minutes (MET-007), in arbitrary units; a session with no rating or no duration contributes nothing rather than zero. Each point is the week’s sessions summed per athlete, then averaged across the group.',
  },
  {
    key: 'total_distance',
    label: 'Total distance',
    unit: 'm',
    caption:
      'Total distance is what the GPS unit reported for the session, in metres, every step counted (MET-017); an athlete with no GPS row for a session has no figure, never a zero. Each point is the week’s sessions summed per athlete, then averaged across the group.',
  },
];

/* The group colours: Forwards the accent, Backs the second brand blue — the
   two series colours the compare boards already pair. */
const GROUP_TONE: Record<GroupKey, string> = {
  forwards: 'var(--accent)',
  backs: 'var(--accent2)',
};
const GROUP_LABEL: Record<GroupKey, string> = {
  forwards: 'Forwards',
  backs: 'Backs',
};
/* The session types’ own tones, as the schedule draws them (scheduleGeometry
   TYPE_STYLE): training the accent, match bad, testing good. */
const TYPE_TONE: Record<'training' | 'match' | 'testing', string> = {
  training: 'var(--accent)',
  match: 'var(--bad)',
  testing: 'var(--good)',
};
const TYPE_LABEL: Record<'training' | 'match' | 'testing', string> = {
  training: 'Training',
  match: 'Match',
  testing: 'Testing',
};

/* MET-010’s display convention: 0.8 to 1.5 is the comfortable band. Below
   it under-loaded, above it high. The words are the carrier; the tone
   follows the app’s three semantic tones. */
const ACWR_BANDS = [
  {
    key: 'low',
    label: 'below 0.8 · caution',
    test: (r: number) => r < 0.8,
    tone: 'var(--warn)',
    text: 'var(--warn-pill-text)',
  },
  {
    key: 'safe',
    label: '0.8 to 1.5 · the comfortable band',
    test: (r: number) => r >= 0.8 && r <= 1.5,
    tone: 'var(--good)',
    text: 'var(--good-pill-text)',
  },
  {
    key: 'high',
    label: 'above 1.5 · high',
    test: (r: number) => r > 1.5,
    tone: 'var(--bad)',
    text: 'var(--bad-pill-text)',
  },
] as const;
const bandOf = (r: number) => ACWR_BANDS.find((b) => b.test(r)) ?? ACWR_BANDS[1];

const W = 1000;
const H = 220;
const PAD_TOP = 14;
const BASE = H - 10;

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-GB');

/** A line through equally spaced points, as a path — the x is the slot's centre. */
function linePath(values: readonly number[], y: (v: number) => number): string {
  const n = values.length;
  if (n === 0) return '';
  const x = (i: number) => (n === 1 ? W / 2 : (i * W) / (n - 1));
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
}

/** MET-006: for each day, the mean and the standard deviation of the 14 days
 *  ending on it. The first 13 days have no full window; the band starts on
 *  day 14, as the profile's chart does with its lead-in. */
function rolling14(values: readonly number[]): {
  mean: (number | null)[];
  sd: (number | null)[];
} {
  const mean: (number | null)[] = [];
  const sd: (number | null)[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i < 13) {
      mean.push(null);
      sd.push(null);
      continue;
    }
    const window = values.slice(i - 13, i + 1);
    const m = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - m) ** 2, 0) / window.length;
    mean.push(m);
    sd.push(Math.sqrt(variance));
  }
  return { mean, sd };
}

const niceTop = (max: number) => {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const unit = max / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 4 ? 4 : unit <= 5 ? 5 : 10;
  return nice * pow;
};

function YAxis({ top, mid, unit }: { top: string; mid: string; unit: string }) {
  return (
    <div className="apv-y" aria-hidden="true">
      <span>
        {top} {unit}
      </span>
      <span>{mid}</span>
      <span>0</span>
    </div>
  );
}

function Legend({
  items,
}: {
  items: {
    label: string;
    tone: string;
    note?: string;
    shape?: 'line' | 'block';
  }[];
}) {
  return (
    <ul className="apv-legend" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="apv-swatch" data-shape={i.shape ?? 'block'} style={{ background: i.tone }} aria-hidden="true" />
          <span>{i.label}</span>
          {i.note ? <span className="apv-legend-note num">{i.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsPreview({ sample }: Props) {
  const [group, setGroup] = useState<'squad' | GroupKey>('squad');
  const [rangeWeeks, setRangeWeeks] = useState<4 | 8 | 12>(12);
  const [measure, setMeasure] = useState<MeasureKey>('session_load');
  const ids = {
    g: useId(),
    r: useId(),
    m: useId(),
    t1: useId(),
    t2: useId(),
    t3: useId(),
    t4: useId(),
  };

  const groups: GroupKey[] = group === 'squad' ? ['forwards', 'backs'] : [group];
  const weeks = sample.weeks.slice(-rangeWeeks);
  const days = rangeWeeks * 7;
  const measureDef = MEASURES.find((m) => m.key === measure)!;
  const groupWords = group === 'squad' ? 'the whole squad, Forwards and Backs' : GROUP_LABEL[group];

  /* 1. The measure over the weeks, one line a group. */
  const loadSeries = groups.map((g) => ({
    group: g,
    values: sample.weekly[measure][g].slice(-rangeWeeks),
  }));
  const loadTop = niceTop(Math.max(...loadSeries.flatMap((s) => s.values)) * 1.1);
  const yLoad = (v: number) => BASE - (Math.min(v, loadTop) / loadTop) * (BASE - PAD_TOP);

  /* 2. The ratio across the athletes in scope, worst first. */
  const acwrRows = [...sample.acwr].filter((a) => groups.includes(a.group)).sort((a, b) => b.ratio - a.ratio);
  const acwrTop = 2;
  const rowH = 18;
  const acwrH = Math.max(1, acwrRows.length) * rowH;
  const xRatio = (r: number) => (Math.min(r, acwrTop) / acwrTop) * W;
  const acwrCounts = ACWR_BANDS.map((b) => ({
    ...b,
    n: acwrRows.filter((a) => b.test(a.ratio)).length,
  }));

  /* 3. Readiness: the group's daily mean, the 14-day band behind it. */
  const readinessSeries = groups.map((g) => {
    const all = sample.readiness[g];
    const values = all.slice(-days);
    /* The band needs its lead-in: computed over the whole 84 days, then cut. */
    const r = rolling14(all);
    return {
      group: g,
      values,
      mean: r.mean.slice(-days),
      sd: r.sd.slice(-days),
    };
  });
  const yReady = (v: number) => BASE - (Math.min(Math.max(v, 0), 100) / 100) * (BASE - PAD_TOP);
  const bandFor = (s: (typeof readinessSeries)[number]) => {
    const idx = s.mean.map((m, i) => (m === null ? -1 : i)).filter((i) => i >= 0);
    if (idx.length < 2) return '';
    const hi = idx.map((i) => Math.min(100, s.mean[i]! + s.sd[i]!));
    const lo = idx.map((i) => Math.max(0, s.mean[i]! - s.sd[i]!));
    const n = s.values.length;
    const x = (i: number) => (i * W) / (n - 1);
    const top = idx.map((i, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${yReady(hi[k]!).toFixed(1)}`).join(' ');
    const bottom = [...idx]
      .reverse()
      .map((i, k) => `L${x(i).toFixed(1)} ${yReady(lo[idx.length - 1 - k]!).toFixed(1)}`)
      .join(' ');
    return `${top} ${bottom} Z`;
  };

  /* 4. Distance by session type, stacked, per week, per athlete. */
  const types = ['training', 'match', 'testing'] as const;
  const stacked = weeks.map((_, wi) => {
    const i = sample.weeks.length - rangeWeeks + wi;
    const perType = types.map((t) => {
      const vals = groups.map((g) => sample.distanceByType[g][t][i] ?? 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return { training: perType[0]!, match: perType[1]!, testing: perType[2]! };
  });
  const distTop = niceTop(Math.max(...stacked.map((s) => s.training + s.match + s.testing)) * 1.1);
  const yDist = (v: number) => BASE - (Math.min(v, distTop) / distTop) * (BASE - PAD_TOP);
  const slot = W / Math.max(1, weeks.length);
  const barW = slot * 0.62;

  const xLabels = (labels: readonly string[]) => (
    <div className="ap-x" aria-hidden="true">
      <span>{labels[0]}</span>
      {labels.length > 2 ? <span>{labels[Math.floor((labels.length - 1) / 2)]}</span> : null}
      {labels.length > 1 ? <span>{labels[labels.length - 1]}</span> : null}
    </div>
  );
  const dayLabels = (n: number) => [`${n} days ago`, `${Math.floor(n / 2)} days ago`, 'today'];

  return (
    <div className="apv" data-preview>
      <div className="apv-controls" role="group" aria-label="What the charts show">
        <label className="rsel" data-stacked="true">
          <span className="rsel-label" id={ids.g}>
            Group
          </span>
          <span className="rsel-wrap">
            <select value={group} onChange={(e) => setGroup(e.target.value as 'squad' | GroupKey)} aria-labelledby={ids.g}>
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
            <span className="rsel-chev" aria-hidden="true">
              &#9660;
            </span>
          </span>
        </label>
        <label className="rsel" data-stacked="true">
          <span className="rsel-label" id={ids.r}>
            Date range
          </span>
          <span className="rsel-wrap">
            <select value={rangeWeeks} onChange={(e) => setRangeWeeks(Number(e.target.value) as 4 | 8 | 12)} aria-labelledby={ids.r}>
              {RANGES.map((r) => (
                <option key={r.weeks} value={r.weeks}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="rsel-chev" aria-hidden="true">
              &#9660;
            </span>
          </span>
        </label>
        <label className="rsel" data-stacked="true">
          <span className="rsel-label" id={ids.m}>
            Measure
          </span>
          <span className="rsel-wrap">
            <select value={measure} onChange={(e) => setMeasure(e.target.value as MeasureKey)} aria-labelledby={ids.m}>
              {MEASURES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="rsel-chev" aria-hidden="true">
              &#9660;
            </span>
          </span>
        </label>
        <p className="apv-scope num" role="status">
          {groupWords} · last {rangeWeeks} weeks · {measureDef.label.toLowerCase()} · sample data
        </p>
      </div>

      <div className="cmp-grid">
        {/* 1 ------------------------------------------------------------ */}
        <section className="card" aria-labelledby={ids.t1} data-chart="load">
          <h2 className="cmp-card-title" id={ids.t1}>
            {measureDef.label} over the last {rangeWeeks} weeks
          </h2>
          <p className="ap-def">{measureDef.caption}</p>
          <Legend
            items={loadSeries.map((s) => ({
              label: GROUP_LABEL[s.group],
              tone: GROUP_TONE[s.group],
              shape: 'line' as const,
              note: `latest ${fmtInt(s.values[s.values.length - 1] ?? 0)} ${measureDef.unit}`,
            }))}
          />
          <div className="apv-plot">
            <YAxis top={fmtInt(loadTop)} mid={fmtInt(loadTop / 2)} unit={measureDef.unit} />
            <div className="ap-plot">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                width="100%"
                height={H}
                role="img"
                aria-labelledby={`${ids.t1}-cap`}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <line x1={0} x2={W} y1={yLoad(loadTop / 2)} y2={yLoad(loadTop / 2)} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {loadSeries.map((s) => (
                  <path
                    key={s.group}
                    d={linePath(s.values, yLoad)}
                    fill="none"
                    stroke={GROUP_TONE[s.group]}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-series={s.group}
                  />
                ))}
              </svg>
            </div>
            <div className="apv-under">
              {xLabels(weeks.map((w) => `w/c ${w}`))}
              <p className="ap-axis">
                Across: week commencing · Up: {measureDef.label.toLowerCase()} per athlete, {measureDef.unit === 'AU' ? 'arbitrary units' : 'metres'} · axis from 0 to {fmtInt(loadTop)} {measureDef.unit}
              </p>
              <table className="visually-hidden" id={`${ids.t1}-cap`}>
                <caption>
                  {measureDef.label} by week, per athlete, {groupWords}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Week commencing</th>
                    {loadSeries.map((s) => (
                      <th key={s.group} scope="col">
                        {GROUP_LABEL[s.group]} ({measureDef.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w, i) => (
                    <tr key={w}>
                      <td>{w}</td>
                      {loadSeries.map((s) => (
                        <td key={s.group}>{fmtInt(s.values[i] ?? 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 2 ------------------------------------------------------------ */}
        <section className="card" aria-labelledby={ids.t2} data-chart="acwr">
          <h2 className="cmp-card-title" id={ids.t2}>
            Acute to chronic load ratio across {group === 'squad' ? 'the squad' : GROUP_LABEL[group]}
          </h2>
          <p className="ap-def">
            The last 7 days’ session load (acute, MET-008) over the mean week of the last 28 (chronic, MET-009, the 28-day total over 4) — MET-010, as it stands today, two decimal
            places, no unit. Withheld for an athlete with fewer than 21 of the trailing 28 days rated. 0.8 to 1.5 is the display band, not the alert: the flag rule is the club’s
            own threshold.
          </p>
          <Legend
            items={acwrCounts.map((b) => ({
              label: b.label,
              tone: b.tone,
              note: `${b.n} athlete${b.n === 1 ? '' : 's'}`,
            }))}
          />
          <div className="apv-plot apv-plot-rows">
            <div className="apv-rows" aria-hidden="true">
              {acwrRows.map((a) => (
                <span key={a.name} style={{ height: rowH }}>
                  {a.name}
                </span>
              ))}
            </div>
            <div className="ap-plot">
              <svg
                viewBox={`0 0 ${W} ${acwrH}`}
                preserveAspectRatio="none"
                width="100%"
                height={acwrH}
                role="img"
                aria-labelledby={`${ids.t2}-cap`}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <rect x={xRatio(0.8)} y={0} width={xRatio(1.5) - xRatio(0.8)} height={acwrH} fill="var(--track)" data-zone />
                <line x1={xRatio(1)} x2={xRatio(1)} y1={0} y2={acwrH} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                {acwrRows.map((a, i) => {
                  const b = bandOf(a.ratio);
                  return <rect key={a.name} x={0} y={i * rowH + 4} width={xRatio(a.ratio)} height={rowH - 8} fill={b.tone} data-band={b.key} />;
                })}
              </svg>
            </div>
            <div className="apv-rows apv-rows-values num" aria-hidden="true">
              {acwrRows.map((a) => (
                <span key={a.name} style={{ height: rowH, color: bandOf(a.ratio).text }}>
                  {a.ratio.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
          <p className="ap-axis">Across: the ratio, 0 to 2.0 · the shaded band 0.8 to 1.5 · the dashed line 1.0, a normal week for that athlete</p>
          <table className="visually-hidden" id={`${ids.t2}-cap`}>
            <caption>Acute to chronic load ratio, every athlete in scope</caption>
            <thead>
              <tr>
                <th scope="col">Athlete</th>
                <th scope="col">Ratio</th>
                <th scope="col">Band</th>
              </tr>
            </thead>
            <tbody>
              {acwrRows.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>{a.ratio.toFixed(2)}</td>
                  <td>{bandOf(a.ratio).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 3 ------------------------------------------------------------ */}
        <section className="card" aria-labelledby={ids.t3} data-chart="readiness">
          <h2 className="cmp-card-title" id={ids.t3}>
            Wellness readiness, last {days} days
          </h2>
          <p className="ap-def">
            Readiness, the analytics version (MET-002): the five morning self-ratings — sleep quality, fatigue, soreness, stress, mood, 5 the best on each — summed over 25 and
            multiplied by 100, and empty for any day one of the five was skipped. The line is the group’s mean each day; the shaded band is that line’s 14-day mean plus and minus
            one standard deviation (MET-006), what is normal for the group, drawn once 14 days are in.
          </p>
          <Legend
            items={[
              ...readinessSeries.map((s) => ({
                label: `${GROUP_LABEL[s.group]} · daily mean`,
                tone: GROUP_TONE[s.group],
                shape: 'line' as const,
                note: `today ${fmtInt(s.values[s.values.length - 1] ?? 0)}`,
              })),
              {
                label: '14-day mean ± 1 SD',
                tone: 'var(--track)',
                shape: 'block' as const,
              },
            ]}
          />
          <div className="apv-plot">
            <YAxis top="100" mid="50" unit="of 100" />
            <div className="ap-plot">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                width="100%"
                height={H}
                role="img"
                aria-labelledby={`${ids.t3}-cap`}
                style={{ display: 'block', overflow: 'visible' }}
              >
                {readinessSeries.map((s) => (
                  <path key={`${s.group}-band`} d={bandFor(s)} fill="var(--track)" data-band={s.group} />
                ))}
                <line x1={0} x2={W} y1={yReady(50)} y2={yReady(50)} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {readinessSeries.map((s) => (
                  <path
                    key={s.group}
                    d={linePath(s.values, yReady)}
                    fill="none"
                    stroke={GROUP_TONE[s.group]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    data-series={s.group}
                  />
                ))}
              </svg>
            </div>
            <div className="apv-under">
              {xLabels(dayLabels(days))}
              <p className="ap-axis">Across: the day · Up: readiness, 0 to 100 · the dashed line 50</p>
              <table className="visually-hidden" id={`${ids.t3}-cap`}>
                <caption>Readiness by day, the group’s mean, {groupWords}</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    {readinessSeries.map((s) => (
                      <th key={s.group} scope="col">
                        {GROUP_LABEL[s.group]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {readinessSeries[0]!.values.map((_, i) => (
                    <tr key={i}>
                      <td>{days - 1 - i === 0 ? 'today' : `${days - 1 - i} days ago`}</td>
                      {readinessSeries.map((s) => (
                        <td key={s.group}>{s.values[i]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 4 ------------------------------------------------------------ */}
        <section className="card" aria-labelledby={ids.t4} data-chart="distance">
          <h2 className="cmp-card-title" id={ids.t4}>
            Total distance by session type, last {rangeWeeks} weeks
          </h2>
          <p className="ap-def">
            Total distance is what the GPS unit reported for each session, in metres, every step counted (MET-017); a session with no GPS row has no figure, never a zero. Each bar
            is the week’s sessions summed per athlete and averaged across the group, split by the session’s type on the schedule.
          </p>
          <Legend
            items={types.map((t) => ({
              label: TYPE_LABEL[t],
              tone: TYPE_TONE[t],
              note: `latest ${fmtInt(stacked[stacked.length - 1]?.[t] ?? 0)} m`,
            }))}
          />
          <div className="apv-plot">
            <YAxis top={fmtInt(distTop)} mid={fmtInt(distTop / 2)} unit="m" />
            <div className="ap-plot">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                width="100%"
                height={H}
                role="img"
                aria-labelledby={`${ids.t4}-cap`}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <line x1={0} x2={W} y1={yDist(distTop / 2)} y2={yDist(distTop / 2)} stroke="var(--tick)" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                <line x1={0} x2={W} y1={BASE} y2={BASE} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {stacked.map((s, i) => {
                  const x = i * slot + (slot - barW) / 2;
                  let acc = 0;
                  return (
                    <g key={weeks[i]} data-week={weeks[i]}>
                      {types.map((t) => {
                        const v = s[t];
                        if (v <= 0) return null;
                        const y0 = yDist(acc + v);
                        const h = yDist(acc) - y0;
                        acc += v;
                        return <rect key={t} x={x} y={y0} width={barW} height={Math.max(0, h)} fill={TYPE_TONE[t]} data-type={t} />;
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="apv-under">
              {xLabels(weeks.map((w) => `w/c ${w}`))}
              <p className="ap-axis">Across: week commencing · Up: metres per athlete · axis from 0 to {fmtInt(distTop)} m</p>
              <table className="visually-hidden" id={`${ids.t4}-cap`}>
                <caption>Total distance by week and session type, per athlete, {groupWords}</caption>
                <thead>
                  <tr>
                    <th scope="col">Week commencing</th>
                    {types.map((t) => (
                      <th key={t} scope="col">
                        {TYPE_LABEL[t]} (m)
                      </th>
                    ))}
                    <th scope="col">Total (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {stacked.map((s, i) => (
                    <tr key={weeks[i]}>
                      <td>{weeks[i]}</td>
                      {types.map((t) => (
                        <td key={t}>{fmtInt(s[t])}</td>
                      ))}
                      <td>{fmtInt(s.training + s.match + s.testing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
