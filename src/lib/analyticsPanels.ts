/* PATTERN-S7 C6 (Isabella, 2026-09-13; built 2026-09-14): analytics as four
 * fixed panels of bars — one athlete against the squad's spread, or against
 * the club's zone where one is set. A wholly premium destination covering
 * every metric, GPS included (docs/decisions/absence-rule.md, 14 September):
 * gated at the database by analytics_daily_rows (0125) and at the route under
 * D-20 — absent from a basic club's sidebar, refused at the URL, no upsell
 * page. Every rule the panels rest on is here, pure, so the guard can hold
 * the words and the numbers:
 *
 *   - the grain: one bar per day up to a fortnight, one bar per week beyond;
 *   - what a week bar is: summed for a volume measure, meaned for a scored
 *     one, and for the trailing ratio the value standing at the end of the
 *     week (a mean of overlapping windows is a number with no definition —
 *     lib/analyticsBuilder's own rule for ACWR);
 *   - the ground: the squad's mean ± 1 SD per period across the athletes in
 *     scope with a value, under the one squad floor (lib/smallSample); or the
 *     club's zone, drawn only when the club has set a fixed rule on the
 *     panel's measure, named and dated — never a default line;
 *   - the axis: zero-based, and the axis line says so in words;
 *   - suppression: below MIN_POINTS bars with a value the panel is withheld
 *     and says why, with one action;
 *   - the words for a period with nothing: per measure, never a zero.
 *
 * Nothing here exports. A question worth keeping leaves as a report. */
import type { MetricKey } from '@/lib/analyticsBuilder';
import { belowSquadFloor, MIN_ATHLETES_WITH_DATA } from '@/lib/smallSample';
import { dayMonthShort } from '@/lib/format';

export type PanelKey = 'load' | 'wellness' | 'gym' | 'acwr';
export type Measure = 'volume' | 'scored' | 'ratio';
export type Grain = 'day' | 'week';

/** One thing a panel can measure: the metric, its kind, and its words. */
export type PanelMeasure = {
  metric: MetricKey;
  measure: Measure;
  /** What one bar measures, in a sentence — the definition line's first clause. */
  sentence: string;
  unit: string;
  decimals: number;
  /** The readout for a period with no value. */
  missingWord: string;
};

export type Panel = {
  key: PanelKey;
  /** The panel's own name. Where the panel offers a choice of measure the
   *  heading shown is the MEASURE's name (titleFor), so the card says what
   *  its number is; this stays the panel's identity for the URL and tests. */
  title: string;
  /** What the panel can measure; the first is its default. Only Training
   *  load offers a choice — the GPS family joined it on 14 September 2026
   *  (analytics is premium and covers every metric, GPS included). */
  measures: readonly PanelMeasure[];
  /** The URL key the choice rides on, when there is one. */
  param: string | null;
  /** The thresholds metric key a club zone may be set on; null = no zone exists for this measure. */
  thresholdMetric: string | null;
  /** A bounded scale keeps its ceiling so two windows read alike. */
  axisTop: number | null;
};

const GPS_VOLUME = (metric: MetricKey, sentence: string, unit: string): PanelMeasure => ({ metric, measure: 'volume', sentence, unit, decimals: 0, missingWord: 'No unit worn' });

export const PANELS: readonly Panel[] = [
  {
    key: 'load',
    /* The default is session load, not total distance (Isabella, 15
     * September 2026): a premium club that has not yet imported a GPS file
     * opens Analytics and must not meet an empty panel; session load exists
     * for every club collecting RPE, so it is the measure most likely to
     * have data on first open. The GPS family stays in the select. The
     * panel's TITLE follows the selected measure (titleFor below) — a card
     * called "Training load" while it draws total distance would break the
     * rule that a screen says what its number is. */
    title: 'Training load',
    measures: [
      { metric: 'load', measure: 'volume', sentence: 'Session load — RPE × minutes (MET-007), summed across every session logged', unit: ' AU', decimals: 0, missingWord: 'No session logged' },
      GPS_VOLUME('gps_distance', 'Total distance — metres from the GPS unit (MET-017), summed across every session it was worn', ' m'),
      GPS_VOLUME('gps_high_speed_distance', 'High speed distance — metres above the vendor’s high-speed threshold (MET-018), summed', ' m'),
      GPS_VOLUME('gps_sprint_distance', 'Sprint distance — metres above the vendor’s sprint threshold (MET-019), summed', ' m'),
      GPS_VOLUME('gps_player_load', 'Player load — the vendor’s accelerometer load (MET-021), summed', ''),
      GPS_VOLUME('gps_accelerations', 'Accelerations — above the vendor’s threshold (MET-022), summed', ''),
      GPS_VOLUME('gps_decelerations', 'Decelerations — above the vendor’s threshold (MET-023), summed', ''),
    ],
    param: 'load',
    thresholdMetric: null,
    axisTop: null,
  },
  {
    key: 'wellness',
    title: 'Wellness',
    measures: [{ metric: 'readiness', measure: 'scored', sentence: 'Readiness — the five morning answers on 0 to 100, a day missing any answer has no value (MET-002)', unit: '', decimals: 0, missingWord: 'Not submitted' }],
    param: null,
    thresholdMetric: 'wellness.readiness_score',
    axisTop: 100,
  },
  {
    key: 'gym',
    title: 'Gym volume',
    measures: [{ metric: 'gym_volume', measure: 'volume', sentence: 'Tonnage — load × reps across every live working set (MET-041), summed', unit: ' kg', decimals: 0, missingWord: 'No gym session' }],
    param: null,
    thresholdMetric: null,
    axisTop: null,
  },
  {
    key: 'acwr',
    title: 'Acute to chronic',
    measures: [{ metric: 'acwr', measure: 'ratio', sentence: 'Acute to chronic load ratio — the last 7 days of session load over the last 28 (MET-010)', unit: '', decimals: 2, missingWord: 'Not enough days on record' }],
    param: null,
    thresholdMetric: 'load.acwr',
    axisTop: null,
  },
];

/** The measure's own short name — the sentence's first clause ("Session
 *  load", "Total distance"). */
export function measureName(m: PanelMeasure): string {
  return m.sentence.split(' — ')[0]!;
}

/** The heading a panel shows: the selected measure's name where the panel
 *  offers a choice, else the panel's title. Select changes measure, heading
 *  and definition together (Isabella, 15 September 2026). */
export function titleFor(panel: Panel, m: PanelMeasure): string {
  return panel.param ? measureName(m) : panel.title;
}

/** The measure a panel draws: the URL's choice when the panel offers one and
 *  the value is on its list, else the default. A stale link degrades. */
export function measureFor(panel: Panel, raw: string | string[] | undefined): PanelMeasure {
  const key = typeof raw === 'string' ? raw : undefined;
  return (panel.param && key ? panel.measures.find((m) => m.metric === key) : undefined) ?? panel.measures[0]!;
}

/** The windows offered. Days, because every series is built per day. The
 *  grain follows the window: a fortnight or less is read by the day, anything
 *  longer by the week. */
export const WINDOWS: readonly { days: number; label: string }[] = [
  { days: 14, label: '14 days' },
  { days: 42, label: '6 weeks' },
  { days: 84, label: '12 weeks' },
  { days: 182, label: '26 weeks' },
];
export const DEFAULT_WINDOW_DAYS = 84;
export const DAY_GRAIN_MAX_DAYS = 14;

export function grainFor(days: number): Grain {
  return days <= DAY_GRAIN_MAX_DAYS ? 'day' : 'week';
}

/** Below this many bars with a value the panel is withheld: two bars are a
 *  before-and-after, not a pattern. */
export const MIN_POINTS = 3;

export type Bucket = { start: string; end: string; label: string };

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week the date falls in — a calendar fact, no timezone. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDaysIso(iso, -dow);
}

function shortDate(iso: string): string {
  return dayMonthShort(iso, 'UTC');
}

/** The periods a window splits into, oldest first. Day buckets are the days;
 *  week buckets run Monday to Sunday and the first and last are clipped to
 *  the window, so a bar never counts a day outside it. */
export function bucketsFor(from: string, to: string, grain: Grain): Bucket[] {
  const out: Bucket[] = [];
  if (grain === 'day') {
    for (let d = from; d <= to; d = addDaysIso(d, 1)) out.push({ start: d, end: d, label: shortDate(d) });
    return out;
  }
  let start = from;
  while (start <= to) {
    const weekEnd = addDaysIso(mondayOf(start), 6);
    const end = weekEnd < to ? weekEnd : to;
    out.push({ start, end, label: `w/c ${shortDate(mondayOf(start))}` });
    start = addDaysIso(end, 1);
  }
  return out;
}

/** One bar: the bucket's value for one athlete under the measure's rule. Null
 *  when no day in the bucket has a value — never zero. */
export function bucketValue(values: ReadonlyMap<string, number>, bucket: Bucket, measure: Measure): number | null {
  const days: { date: string; v: number }[] = [];
  for (let d = bucket.start; d <= bucket.end; d = addDaysIso(d, 1)) {
    const v = values.get(d);
    if (v !== undefined) days.push({ date: d, v });
  }
  if (days.length === 0) return null;
  if (measure === 'volume') return days.reduce((s, p) => s + p.v, 0);
  if (measure === 'scored') return days.reduce((s, p) => s + p.v, 0) / days.length;
  return days[days.length - 1]!.v;
}

export type BandEdge = { lo: number; hi: number; n: number } | null;

/** The squad's spread for one bucket: mean ± 1 SD across the athletes in scope
 *  with a value in it, or null under the squad floor. `n` is the athletes
 *  with data, which the definition line prints. */
export function squadBand(perAthlete: ReadonlyMap<string, ReadonlyMap<string, number>>, bucket: Bucket, measure: Measure): BandEdge {
  const vals: number[] = [];
  for (const values of perAthlete.values()) {
    const v = bucketValue(values, bucket, measure);
    if (v !== null) vals.push(v);
  }
  if (belowSquadFloor(vals.length)) return null;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  return { lo: Math.max(0, mean - sd), hi: mean + sd, n: vals.length };
}

export type ZoneRule = {
  metric: string;
  comparison: string;
  value: number;
  name: string;
  updated_at: string;
  applies_to_group_id: string | null;
  is_active: boolean;
};

export type Zone = { lo: number | null; hi: number | null; names: string[]; setAt: string };

/** The club's zone on a panel: the club-wide, active, fixed (below / above)
 *  rules on the panel's measure — a rule read against a personal baseline or
 *  a z-score is not a line on a shared axis and draws nothing. `lo` from a
 *  "below" rule, `hi` from an "above" one; either may be open. Null when the
 *  club has set none: no default line, ever. */
export function zoneFor(panel: Panel, rules: readonly ZoneRule[]): Zone | null {
  if (!panel.thresholdMetric) return null;
  const fixed = rules.filter((r) => r.metric === panel.thresholdMetric && r.is_active && r.applies_to_group_id === null && (r.comparison === 'below' || r.comparison === 'above'));
  if (fixed.length === 0) return null;
  const below = fixed.filter((r) => r.comparison === 'below').sort((a, b) => b.value - a.value)[0] ?? null;
  const above = fixed.filter((r) => r.comparison === 'above').sort((a, b) => a.value - b.value)[0] ?? null;
  const used = [below, above].filter((r): r is ZoneRule => r !== null);
  return {
    lo: below?.value ?? null,
    hi: above?.value ?? null,
    names: [...new Set(used.map((r) => r.name))],
    setAt: used.map((r) => r.updated_at).sort().reverse()[0]!,
  };
}

export function fmt(value: number, decimals: number): string {
  return decimals === 0 ? Math.round(value).toLocaleString('en-GB') : value.toFixed(decimals);
}

/** "0.80 to 1.30 · Acute chronic ratio high · set by Jane Pemberton, 24 Aug". */
export function zoneWords(zone: Zone, m: PanelMeasure, setBy: string | null, setAtWords: string): string {
  const range = zone.lo !== null && zone.hi !== null ? `${fmt(zone.lo, m.decimals)} to ${fmt(zone.hi, m.decimals)}` : zone.hi !== null ? `0 to ${fmt(zone.hi, m.decimals)}` : `${fmt(zone.lo!, m.decimals)} and above`;
  return `${range}${m.unit} · ${zone.names.join(', ')} · set by ${setBy ?? 'the club'}, ${setAtWords}`;
}

/** A nice ceiling above the data so the top bar has air and the axis reads as
 *  a round number. Never below the panel's own fixed top. */
export function axisTop(panel: Panel, m: PanelMeasure, values: readonly (number | null)[]): number {
  const max = Math.max(0, ...values.filter((v): v is number => v !== null));
  if (panel.axisTop !== null) return Math.max(panel.axisTop, max);
  if (max === 0) return m.measure === 'ratio' ? 2 : 1;
  if (m.measure === 'ratio') return Math.max(2, Math.ceil(max * 4) / 4);
  const mag = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const s of steps) if (max <= s * mag) return s * mag;
  return 10 * mag;
}

/** The axis line, in words. */
export function axisWords(m: PanelMeasure, top: number, grain: Grain): string {
  return `Axis 0 to ${fmt(top, m.decimals)}${m.unit} · one bar per ${grain} · hover or tap a bar for its value`;
}

/** The grain clause of the definition line. */
export function grainWords(m: PanelMeasure, grain: Grain): string {
  if (grain === 'day') return 'one bar per day';
  if (m.measure === 'volume') return 'one bar per week, the week summed';
  if (m.measure === 'scored') return 'one bar per week, the week meaned';
  return 'one bar per week, the ratio as it stood at the end of the week';
}

/** The ground clause: the band or the zone, and n. */
export function groundWords(o: { zone: string | null; nWithData: number; scope: string; grain: Grain }): string {
  if (o.zone) return `ground: the club's zone, ${o.zone}`;
  if (o.nWithData < MIN_ATHLETES_WITH_DATA) return `ground: none — ${o.nWithData} athlete${o.nWithData === 1 ? '' : 's'} with data in ${o.scope}, fewer than ${MIN_ATHLETES_WITH_DATA}`;
  return `ground: the squad's mean ± 1 SD per ${o.grain}, n = ${o.nWithData} athletes with data in ${o.scope}`;
}

export type Suppression = { reason: string; action: { label: string; href: string } };

/** Withheld below MIN_POINTS bars with a value, with one action: widen the
 *  window while a wider one exists, otherwise the athlete's own report. */
export function suppression(o: { points: number; buckets: number; grain: Grain; days: number; athleteName: string; widenHref: string | null; reportHref: string }): Suppression | null {
  if (o.points >= MIN_POINTS) return null;
  const unit = o.grain === 'day' ? 'day' : 'week';
  const have = o.points === 0 ? `no ${unit}` : o.points === 1 ? `1 ${unit}` : `${o.points} ${unit}s`;
  return {
    reason: `Not drawn: ${o.athleteName} has ${have} with a value in the last ${o.days} days, out of ${o.buckets} — fewer than ${MIN_POINTS}. Nothing here is estimated from less.`,
    action: o.widenHref ? { label: 'Widen the window', href: o.widenHref } : { label: `Open ${o.athleteName}'s report`, href: o.reportHref },
  };
}
