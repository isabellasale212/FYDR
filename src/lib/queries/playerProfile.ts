import {
  ACWR_ACUTE_WINDOW_DAYS,
  ACWR_BAND_HIGH,
  ACWR_BAND_LOW,
  ACWR_CHRONIC_WINDOW_DAYS,
  acwrSuppressedLabel,
  computeAcwr,
  loadByDateFrom,
} from '@/lib/acwr';
import { addDays, ageFrom, daysBetween, formatDate, todayIso } from '@/lib/format';
import { resolveRange, type RangeKey, type ResolvedRange } from '@/lib/period';
import { bandPosition } from '@/lib/stats';
import { fetchAllPaged } from './paged';
import { fetchAthlete, type AthleteProfile } from './squad';
import { fetchAthleteInjuries, type AthleteInjuryRow } from './injuries';
import { fetchFlagsList, type FlagListRow } from './flags';
import { fetchWellnessByAthlete, wellnessSeries } from './wellness';
import { fetchTestDefinitions } from './testing';
import { resolveTargetForDate, type ResolvedTarget } from './nutritionTargets';
import { describeThreshold, fetchThresholds, findActiveAcwrThreshold } from './thresholds';
import type { Db } from './groups';

/* PLAYER-PROFILE-SPEC.md, the query layer behind it. One function assembles
 * everything the page needs in parallel, the same shape athleteReport.ts
 * already uses for the Athlete report — this is a sibling of that file, not
 * a replacement: it reuses athleteReport.ts's exact ACWR maths rather than
 * a second copy, so a coach never sees two different ACWR numbers for the
 * same athlete on two screens.
 *
 * Every section below is wired to a real table. Two sections the spec draws
 * have no backing schema anywhere in this build and are cut honestly rather
 * than fabricated, per this session's own established rule for exactly this
 * situation (see athleteReport.ts's and nutritionTargets.ts's own headers
 * for precedent):
 *   - §6 S&C history log — no adaptation-log table exists. The card ships
 *     with its real header and description and an honest empty state.
 *   - §10 Goals' "Next window:" coaching note — no freeform weekly-note
 *     table exists. "Goal:" is real (programmes.goal, via the athlete's
 *     active programme_assignment); "Next window:" is cut with a one-line
 *     note explaining why, not silently dropped.
 * Body weight (§10) sits between those two: body_composition is a real
 * table with real columns, but shipped with zero rows anywhere in this
 * project — see the seed enrichment note below. The value, history and
 * trend delta are real.
 *
 * THE TARGET RANGE IS NO LONGER CUT — CORRECTED, MIGRATION 0060. This
 * paragraph used to end "The target range and 'On target' pill in the spec
 * have no backing column at all (no target_weight_kg anywhere in the
 * schema), so those are cut too." That was true when written and is now
 * wrong: migration 0060 added body_mass_target_ranges, read through
 * lib/queries/bodyMassTargetRange.ts. The client asked for it directly and
 * gave four binding rules — staff-set, never athlete-visible, a RANGE not a
 * single number, never leaderboarded.
 *
 * IT IS DELIBERATELY NOT FETCHED HERE, and that is a design choice rather
 * than an omission. fetchPlayerProfile assembles what the page renders for
 * anyone allowed on it; the target range is readable by coach and medical
 * only, so folding it into this function would put a staff-only value inside
 * the same object as everything else and make every future consumer of
 * PlayerProfile responsible for not leaking it. The page fetches it
 * separately, behind its own role check, and hands it only to the components
 * that draw it. Keep it that way.
 *
 * The band this file already computes for the sparkline is NOT the target
 * range and must not be conflated with it: computeMassBand is where the
 * athlete HAS BEEN (their own trailing mean +/- 1 SD), the target range is
 * where staff WANT them. See lib/nutritionRules.ts's header. */

/* ACWR windows, band and computation all come from lib/acwr.ts now — this
 * file used to carry its own copy of the maths and its own hardcoded 1.5
 * "flag ceiling", which the audit (S1) caught contradicting the org's real
 * flag rule (above 1.30, thresholds table). The dial's full ring is the
 * top of the shared display band; the "flags above X" copy quotes the
 * real threshold row. */
/* ---------------------------------------------------------------------- *
 * WHICH WINDOWS THE PERIOD CONTROL MOVES, AND WHICH IT MUST NOT
 * ---------------------------------------------------------------------- *
 *
 * This file used to hold four hardcoded windows and the page held a fifth,
 * none of them visible to a coach. `?period=` (lib/period.ts) now drives TWO
 * of the five. The other three are NOT view windows and are deliberately left
 * fixed — a page-wide override would have silently redefined them:
 *
 *  MOVES  weightFrom     — the body-weight sparkline. Was a fixed 120 days.
 *  MOVES  the wellness dial's SUBMISSION COUNT — "n of D days submitted" now
 *                          spans the selected period, which is the one part of
 *                          that card a longer window genuinely improves: a
 *                          season-long submission rate is a better number than
 *                          a 28-day one.
 *
 *  FIXED  the wellness dial's MEAN, capped at WELLNESS_MEAN_WINDOW (28 days).
 *         Body mass and readiness are not the same kind of signal, and the two
 *         panels sharing one control exposed it. Mass is SLOW and the sparkline
 *         shows a SHAPE, so a longer window adds information. Readiness is FAST
 *         and the dial collapses its window to ONE NUMBER, so a longer window
 *         removes it: a season-long mean readiness barely moves, washes out
 *         exactly the peaks and troughs the dial exists to surface, and sits
 *         next to ACWR where the surrounding grammar reads "how is he right
 *         now". Capping the mean while letting the count follow the period
 *         keeps both halves honest instead of sacrificing one to fix the other.
 *         The card labels the two windows separately so it is visible that they
 *         differ. This is the screen's ESTABLISHED grammar, not an exception
 *         invented for this card — the wellness baseline is pinned at 14 days
 *         regardless of period, ACWR at 7:28, the correction panel at 28.
 *
 *  FIXED  ACWR_ACUTE_WINDOW_DAYS (7) / ACWR_CHRONIC_WINDOW_DAYS (28), from
 *         lib/acwr.ts. ACWR is DEFINED as a trailing 7-day acute load over a
 *         trailing 28-day chronic load. There is no season-long or all-time
 *         ACWR: widening the window does not widen the ratio, it only changes
 *         how many already-trailing ratios you are looking at (lib/period.ts's
 *         header states the general rule). The dial carries a visible caption
 *         naming its two real windows so a coach reading this page at
 *         `period=year` is not misled into thinking the ratio moved with it.
 *
 *  FIXED  WELLNESS_ROLLING_WINDOW (14). This is the BASELINE the wellness band
 *         is drawn against — "is this normal for him" — not the window being
 *         viewed. The mean the dial reports is what widens; the 14 days it is
 *         judged against stay 14 days, or "steady" would mean something
 *         different at every period and the two could not be compared.
 *
 *  FIXED  CORRECTION_WINDOW_DAYS (28, in the page). Its own comment there
 *         argues it is a performance bound on a base-table read, not a view
 *         window. Also captioned rather than moved.
 *
 * ROW CEILING. Widening weightFrom to `all` (capped at MAX_WINDOW_DAYS, 730)
 * puts the body_composition read past PostgREST's silent 1000-row ceiling in
 * principle — nothing constrains an athlete to one weigh-in a day — so that
 * read pages via fetchAllPaged with `measured_on, id` as its total order.
 * The wellness read is provably bounded instead of paged: the
 * `wellness_entries_one_live_per_day` unique index (migration 0004) means
 * wellness_entries_current holds AT MOST one row per athlete per day, so a
 * single athlete over 730 visible days plus a 14-day lead-in is at most 744
 * rows. That is a proof, not an assumption — if that index is ever dropped,
 * fetchWellnessByAthlete must be paged. */
const WELLNESS_ROLLING_WINDOW = 14; // matches wellnessSeries's use elsewhere (athleteReport.ts, the old profile page)

/** The ceiling on the wellness dial's mean, in days. A CAP, not a fixed
 *  window: the mean spans min(this, the selected period), so `week` still means
 *  a 7-day mean exactly as it did before the period control existed, and
 *  everything from `month` upwards means 28 days.
 *
 *  A literal 28 rather than ACWR_CHRONIC_WINDOW_DAYS, which is also 28: that
 *  constant is half of a sports-science ratio definition and this is a
 *  readability judgement about a mean. Importing it here would tie two numbers
 *  together that have no reason to move together. */
const WELLNESS_MEAN_WINDOW = 28;
const WEIGHT_TREND_LOOKBACK_DAYS = 14;

export type Tone = 'accent' | 'accent2' | 'warn' | 'bad' | 'faint';

export type StatusLabel = { label: string; tone: Tone };

/** §5's band rule, verbatim: pct >= 60 good, >= 40 warn, else bad. Shared by
 *  every percentile-driven label on the page (per-row bands and the
 *  Athleticism composite) so one number always reads the same colour
 *  wherever it appears. */
export function bandTone(pct: number): Tone {
  if (pct >= 60) return 'accent2';
  if (pct >= 40) return 'warn';
  return 'bad';
}

/** The smallest peer group whose distribution is allowed to tint a row.
 *
 *  The light-theme handoff §7 sets it: "Suppress shading below five subjects
 *  with data, and when suppressed say so and state that the numbers themselves
 *  are unchanged. Small samples make shading lie." A percentile computed
 *  against three team-mates is arithmetically fine and visually a lie — the
 *  bottom of a three-man group is the 0th percentile and would take the
 *  darkest red row in the list. The percentile itself is still shown, still
 *  correct, and still labelled; only the row tint is withheld. */
export const BAND_SHADING_MIN_N = 5;

/** §7's four percentile bands, which are NOT the three bandTone() colours: the
 *  0-19th and 20-39th bands are the same red and differ only in wash strength,
 *  so a list of poor results still reads top-to-bottom rather than as one flat
 *  block. Returns 1-4, matching --band-1-wash … --band-4-wash in tokens.css.
 *
 *  Deliberately separate from bandTone() rather than folded into it: the LABEL
 *  colour and the bar fill still come from bandTone's three tones, exactly as
 *  the handoff's own table has them (bands 1 and 2 share #f15a4a as fill and
 *  #8a2418 as label). Only the row wash needs the fourth step. */
export function bandIndex(pct: number): 1 | 2 | 3 | 4 {
  if (pct >= 60) return 4;
  if (pct >= 40) return 3;
  if (pct >= 20) return 2;
  return 1;
}

const COMPOSITE_LABEL: Record<Tone, string> = {
  accent2: 'Elite',
  warn: 'Solid',
  bad: 'Developing',
  accent: 'Elite',
  faint: 'No data',
};

export type BenchmarkRow = {
  testDefinitionId: string;
  name: string;
  unit: string;
  decimals: number;
  higherIsBetter: boolean;
  value: number | null;
  pct: number | null;
  median: number | null;
  best: number | null;
  n: number;
};

export type AthleticismSummary = {
  compositePct: number | null;
  band: StatusLabel;
  positionGroupName: string | null;
  positionGroupSize: number;
  rows: BenchmarkRow[];
};

export type AcwrSummary = {
  value: number | null;
  pct: number | null; // for the dial arc, §9: round(acwr / band-top * 100), clamped to [0,100]
  suppressed: boolean;
  daysWithData: number;
  sessionsN: number;
  status: StatusLabel;
  /** The org's real active flag rule value (thresholds table), quoted by
   *  the dial's meta line — never a hardcoded number. Null when no ACWR
   *  rule is active. */
  flagRuleValue: number | null;
};

export type WellnessRatingSummary = {
  /** Mean readiness over the TRAILING `meanWindowDays`, which is capped at
   *  WELLNESS_MEAN_WINDOW and is NOT the selected period once the period is
   *  longer than that. See the header for why. */
  meanPct: number | null;
  /** The mean's real window, in days: min(WELLNESS_MEAN_WINDOW, windowDays).
   *  Carried so the card can label it, because a mean over 28 days sitting
   *  above a count over 214 must not look like one window. */
  meanWindowDays: number;
  /** Days in the SELECTED period with a submitted entry, out of `windowDays`.
   *  This half does follow the control — a season-long submission rate is a
   *  better number than a 28-day one. */
  submittedN: number;
  windowDays: number;
  /** The period's own label ("Last 28 days", "This season"), for the
   *  submission line. */
  windowLabel: string;
  status: StatusLabel;
};

export type HeaderWellness = { pct: number | null };

/* §8: "The evidence line is the whole point of the card... names the
 * dates, the values, the baseline and the sample so a coach can act
 * without opening another screen." The mock's own two examples narrate a
 * day-by-day breakdown ("2 Aug 2, 3 Aug 2 · site marked left calf") that
 * nothing in this schema stores — flags.observed_value/expected_value are
 * single numbers, not the series that produced them, and there is no
 * evidence/notes column on `flags` itself. ruleSentence is real:
 * describeThreshold() (thresholds.ts), the exact sentence-builder the
 * Thresholds screen itself already uses, run against the real threshold
 * the flag was raised under. evidence is real but narrower than the mock —
 * the rule's own window and baseline, plus when it fired — not a
 * reconstructed day-by-day trail, which would mean bespoke per-domain
 * queries (wellness, gps, compliance, nutrition, testing, training, gym
 * each store their history differently) to rebuild a narrative this table
 * was never asked to keep. */
export type ProfileFlag = FlagListRow & { ruleSentence: string; evidence: string };

export type ProgrammeBanner = {
  programmeId: string;
  name: string;
  goal: string | null;
  weekNow: number;
  weekTotal: number | null;
  endsOn: string | null;
} | null;

export type WeightPoint = { date: string; kg: number };

export type BodyWeightSummary = {
  latestKg: number | null;
  history: WeightPoint[];
  deltaKg: number | null;
  deltaDays: number | null;
};

export type PlayerProfile = {
  /** The window that ACTUALLY rendered, after resolveRange clipped and
   *  anchored it. Returned rather than recomputed on the page so the control,
   *  the captions and the query can never disagree — and so the page can say
   *  when MAX_WINDOW_DAYS clipped what the label promised. Governs the body
   *  weight sparkline and the wellness rating ONLY; see the header. */
  range: ResolvedRange;
  athlete: AthleteProfile;
  age: number | null;
  athleticism: AthleticismSummary;
  injuries: AthleteInjuryRow[];
  flags: ProfileFlag[];
  acwr: AcwrSummary;
  wellnessRating: WellnessRatingSummary;
  headerWellness: HeaderWellness;
  programme: ProgrammeBanner;
  nutrition: ResolvedTarget | null;
  bodyWeight: BodyWeightSummary;
};

/* Same interpolated-rank quartile as testingReport.ts's own quartile() —
 * copied rather than imported (that one is a private, unexported helper of
 * a report file, not a shared utility) so "median" means the exact same
 * arithmetic wherever a coach reads that word in this app. */
function quartile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base];
  if (a === undefined) return null;
  const b = sorted[base + 1];
  return b === undefined ? a : a + rest * (b - a);
}

/* Percentile rank within the peer set, direction aware, ties inclusive: the
 * fraction of peers (self included) this athlete matches or beats. The best
 * performer(s) in a group always land on 100, never on a number that
 * implies someone did better than the group's own best. Not a spec'd
 * formula — §5 only fixes the dial geometry, not how a benchmark percentile
 * itself is computed — so this is a deliberate, documented choice rather
 * than a guess at the mock's own placeholder numbers. */
function percentileRank(value: number, peers: number[], higherIsBetter: boolean): number {
  const atLeastAsGood = higherIsBetter
    ? peers.filter((v) => v <= value).length
    : peers.filter((v) => v >= value).length;
  return Math.round((100 * atLeastAsGood) / peers.length);
}

async function fetchPositionalGroup(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<{ id: string; name: string; athleteIds: string[] } | null> {
  const { data: memberships, error } = await db
    .from('group_memberships')
    .select('group_id, groups!inner(id, name, group_type, deleted_at)')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('removed_at', null);
  if (error) throw new Error(error.message);

  type GroupRow = { id: string; name: string; group_type: string; deleted_at: string | null };
  const positional = (memberships ?? [])
    .map((m) => m.groups as unknown as GroupRow)
    .find((g) => g.group_type === 'positional' && g.deleted_at === null);
  if (!positional) return null;

  const { data: peers, error: peersError } = await db
    .from('group_memberships')
    .select('athlete_id')
    .eq('org_id', orgId)
    .eq('group_id', positional.id)
    .is('removed_at', null);
  if (peersError) throw new Error(peersError.message);

  return { id: positional.id, name: positional.name, athleteIds: [...new Set((peers ?? []).map((p) => p.athlete_id))] };
}

/* §5: "Athleticism" is the composite of the position-relative percentiles
 * below, and §11 rule 3: compared against the athlete's positional unit,
 * not the whole squad, with the card stating which unit and how many
 * players. The mock's own example unit is "Front Row" — finer-grained than
 * anything in this schema (no sub-positional grouping table exists, only
 * the broad positional groups seeded in migration 0009-era data: Forwards,
 * Backs). Using the real positional group an athlete belongs to is coarser
 * than the mock but is a true positional unit, which is what the rule
 * actually asks for. */
async function fetchAthleticism(db: Db, orgId: string, athleteId: string): Promise<AthleticismSummary> {
  const group = await fetchPositionalGroup(db, orgId, athleteId);
  const definitions = await fetchTestDefinitions(db, orgId);

  if (!group || definitions.length === 0) {
    return {
      compositePct: null,
      band: { label: 'No data', tone: 'faint' },
      positionGroupName: group?.name ?? null,
      positionGroupSize: group?.athleteIds.length ?? 0,
      rows: definitions.map((d) => ({
        testDefinitionId: d.id,
        name: d.name,
        unit: d.unit,
        decimals: d.decimal_places,
        higherIsBetter: d.higher_is_better,
        value: null,
        pct: null,
        median: null,
        best: null,
        n: 0,
      })),
    };
  }

  const { data: results, error } = await db
    .from('test_results')
    .select('athlete_id, test_definition_id, value')
    .eq('org_id', orgId)
    .eq('is_best', true)
    .is('deleted_at', null)
    .in('athlete_id', group.athleteIds);
  if (error) throw new Error(error.message);

  const valuesByTest = new Map<string, number[]>();
  const athleteValueByTest = new Map<string, number>();
  for (const r of results ?? []) {
    const list = valuesByTest.get(r.test_definition_id) ?? [];
    list.push(r.value);
    valuesByTest.set(r.test_definition_id, list);
    if (r.athlete_id === athleteId) athleteValueByTest.set(r.test_definition_id, r.value);
  }

  const rows: BenchmarkRow[] = definitions.map((d) => {
    const peers = valuesByTest.get(d.id) ?? [];
    const value = athleteValueByTest.get(d.id) ?? null;
    const pct = value !== null && peers.length > 0 ? percentileRank(value, peers, d.higher_is_better) : null;
    const sorted = [...peers].sort((a, b) => a - b);
    return {
      testDefinitionId: d.id,
      name: d.name,
      unit: d.unit,
      decimals: d.decimal_places,
      higherIsBetter: d.higher_is_better,
      value,
      pct,
      median: quartile(sorted, 0.5),
      best: peers.length > 0 ? (d.higher_is_better ? Math.max(...peers) : Math.min(...peers)) : null,
      n: peers.length,
    };
  });

  const scored = rows.filter((r): r is BenchmarkRow & { pct: number } => r.pct !== null);
  const compositePct = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.pct, 0) / scored.length) : null;
  const tone: Tone = compositePct === null ? 'faint' : bandTone(compositePct);

  return {
    compositePct,
    band: { label: COMPOSITE_LABEL[tone], tone },
    positionGroupName: group.name,
    positionGroupSize: group.athleteIds.length,
    rows,
  };
}

function acwrStatus(
  acwr: number | null,
  suppressed: boolean,
  daysWithData: number,
  flagRuleValue: number | null,
): StatusLabel {
  if (suppressed || acwr === null) {
    return { label: acwrSuppressedLabel(daysWithData), tone: 'faint' };
  }
  // The club's real flag rule outranks the descriptive band: a ratio the
  // flag engine would fire on must never read "in the sweet spot" here.
  if (flagRuleValue !== null && acwr > flagRuleValue) {
    return { label: 'Above the flag threshold', tone: 'bad' };
  }
  if (acwr > ACWR_BAND_HIGH) return { label: 'Above the typical band', tone: 'bad' };
  if (acwr < ACWR_BAND_LOW) return { label: 'Below the sweet spot', tone: 'warn' };
  return { label: 'In the sweet spot', tone: 'accent2' };
}

/* The window+baseline half of describeThreshold()'s own sentence, reused
 * as the evidence line's real content rather than restating the rule (row
 * 2 already shows the rule sentence in full). Comparison-aware for the
 * same reason describeThreshold() is (see thresholds.ts): an above/below
 * rule's baseline is context recorded on the flag, not the thing the
 * value was compared against — "against" would contradict the rule
 * sentence one line up. */
function evidenceLine(
  threshold: {
    comparison: string;
    consecutive_days: number;
    baseline_type: string;
    baseline_days: number | null;
  } | null,
  flagDate: string,
  timezone: string,
): string {
  const flagged = `flagged ${formatDate(flagDate, timezone)}`;
  if (!threshold) return `No threshold on record · ${flagged}.`;
  const days = threshold.consecutive_days === 1 ? '1 day' : `${threshold.consecutive_days} consecutive days`;
  const baseline =
    threshold.baseline_type === 'personal_rolling'
      ? `the athlete's own ${threshold.baseline_days ?? 28}-day average`
      : threshold.baseline_type === 'squad_mean'
        ? "the squad's average that day"
        : null;
  if (baseline === null) return `${days} against a fixed value · ${flagged}`;
  const evaluatesAgainstBaseline = threshold.comparison !== 'above' && threshold.comparison !== 'below';
  return evaluatesAgainstBaseline
    ? `${days} against ${baseline} · ${flagged}`
    : `${days} · expected shows ${baseline} · ${flagged}`;
}

function wellnessStatus(position: ReturnType<typeof bandPosition>): StatusLabel {
  if (position === 'above') return { label: 'Trending up', tone: 'accent2' };
  if (position === 'below') return { label: 'Trending down', tone: 'bad' };
  if (position === 'inside') return { label: 'Steady', tone: 'accent' };
  return { label: 'Not enough data', tone: 'faint' };
}

/** The athlete's own earliest recorded date across the two domains the period
 *  control governs, so `all` anchors on something real instead of silently
 *  becoming "the last 730 days". Only ever called for `all` — resolveRange
 *  ignores it for every other key, and a round trip for an argument nothing
 *  reads is a round trip not worth making. Null when the athlete has no
 *  weigh-in and no wellness entry at all, which resolveRange already degrades
 *  to a bounded window rather than inventing a start date. */
async function fetchEarliestRecordedDate(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<string | null> {
  const [weight, wellness] = await Promise.all([
    db
      .from('body_composition')
      .select('measured_on')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('measured_on', { ascending: true })
      .limit(1),
    db
      .from('wellness_entries_current')
      .select('entry_date')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('entry_date', { ascending: true })
      .limit(1),
  ]);
  if (weight.error) throw new Error(weight.error.message);
  if (wellness.error) throw new Error(wellness.error.message);
  // Both are `date` columns, compared and sorted as plain YYYY-MM-DD strings
  // — CLAUDE.md rule 5 governs instants, and neither of these is one.
  const candidates = [weight.data?.[0]?.measured_on, wellness.data?.[0]?.entry_date].filter(
    (d): d is string => typeof d === 'string',
  );
  if (candidates.length === 0) return null;
  return candidates.sort()[0] ?? null;
}

export async function fetchPlayerProfile(
  db: Db,
  orgId: string,
  athleteId: string,
  timezone: string,
  /** The period the page resolved and clamped. `seasonStart` comes from
   *  fetchCurrentSeason (schedule.ts) — NOT fetchCurrentSeasonId, which has a
   *  documented soft-delete gap — and is null when the club has no current
   *  season, in which case `season` was never offered as an option. */
  period: { key: RangeKey; seasonStart: string | null },
): Promise<PlayerProfile | null> {
  const today = todayIso(timezone);
  // Fixed by definition, never by the control. See the header.
  const chronicFrom = addDays(today, -(ACWR_CHRONIC_WINDOW_DAYS - 1));
  const acuteFrom = addDays(today, -(ACWR_ACUTE_WINDOW_DAYS - 1));

  const athlete = await fetchAthlete(db, orgId, athleteId);
  if (!athlete) return null;

  const earliest = period.key === 'all' ? await fetchEarliestRecordedDate(db, orgId, athleteId) : null;
  const range = resolveRange(period.key, today, period.seasonStart, earliest);

  // Driven by the control.
  const weightFrom = range.from;
  // The band needs WELLNESS_ROLLING_WINDOW days of lead-in BEFORE the first
  // visible day, or the earliest days of the selected period would be judged
  // against a baseline that is still filling up and would read "not enough
  // data" on an athlete with a complete history.
  const wellnessFrom = addDays(range.from, -WELLNESS_ROLLING_WINDOW);

  const [
    athleticism,
    injuries,
    flags,
    thresholds,
    wellnessEntries,
    loadEntries,
    programmeRows,
    nutrition,
    weightRows,
  ] = await Promise.all([
    fetchAthleticism(db, orgId, athleteId),
    fetchAthleteInjuries(db, orgId, athleteId),
    fetchFlagsList(db, orgId, []),
    fetchThresholds(db, orgId, true),
    fetchWellnessByAthlete(db, athleteId, { from: wellnessFrom, to: today }),
    db
      .from('training_entries_current')
      .select('entry_date, session_load')
      .eq('athlete_id', athleteId)
      .gte('entry_date', chronicFrom)
      .lte('entry_date', today),
    db
      .from('programme_assignments')
      .select('id, starts_on, ends_on, status, programmes(id, name, goal, duration_weeks)')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .order('starts_on', { ascending: false })
      .limit(1),
    resolveTargetForDate(db, athleteId, today),
    /* PAGED, and it is the one read on this page that had to be. This window
     * used to be a fixed 120 days; at `season`/`year`/`all` it reaches
     * MAX_WINDOW_DAYS (730) and nothing in the schema stops an athlete having
     * more than one weigh-in on a day, so an unpaginated read could hit
     * PostgREST's 1000-row ceiling and return a truncated history that looks
     * complete. `.order('measured_on').order('id')` is the required TOTAL
     * order: measured_on alone has ties, and .range() re-runs the query per
     * page, so a tie broken differently across a page boundary duplicates or
     * drops a point in the sparkline. Ascending is correct here and is not the
     * trap it was elsewhere in this codebase — the whole window is read, not a
     * first page of it, so no end of the range is preferentially lost. */
    fetchAllPaged<{ measured_on: string | null; body_mass_kg: number | null }>((pageFrom, pageTo) =>
      db
        .from('body_composition')
        .select('measured_on, body_mass_kg')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('measured_on', weightFrom)
        .lte('measured_on', today)
        .order('measured_on')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  if (loadEntries.error) throw new Error(loadEntries.error.message);
  if (programmeRows.error) throw new Error(programmeRows.error.message);

  const thresholdById = new Map(thresholds.map((t) => [t.id, t]));
  const athleteFlags: ProfileFlag[] = flags
    .filter((f) => f.athlete_id === athleteId)
    .map((f) => {
      const threshold = f.threshold_id ? (thresholdById.get(f.threshold_id) ?? null) : null;
      return {
        ...f,
        ruleSentence: threshold ? describeThreshold(threshold) : 'The threshold this flag was raised under is no longer on record.',
        evidence: evidenceLine(threshold, f.flag_date, timezone),
      };
    });

  // ACWR: the one shared computation (lib/acwr.ts) every other surface
  // uses — windows, suppression guard and band all come from there, so a
  // coach never sees two different ACWR numbers for the same athlete on
  // two screens.
  const computed = computeAcwr(loadByDateFrom(loadEntries.data ?? []), acuteFrom);
  const acwrRule = findActiveAcwrThreshold(thresholds);
  const flagRuleValue = acwrRule?.value ?? null;
  const acwrPct =
    computed.acwr === null ? null : Math.min(100, Math.max(0, Math.round((computed.acwr / ACWR_BAND_HIGH) * 100)));

  const acwr: AcwrSummary = {
    value: computed.acwr,
    pct: acwrPct,
    suppressed: computed.suppressed,
    daysWithData: computed.daysWithData,
    sessionsN: (loadEntries.data ?? []).length,
    status: acwrStatus(computed.acwr, computed.suppressed, computed.daysWithData, flagRuleValue),
    flagRuleValue,
  };

  // Wellness rating: mean readiness over the last 7 days, and "is this
  // normal for him" from the same rolling-band machinery WellnessChart and
  // the old profile page both already use, so the header dial doesn't
  // invent a second opinion about what "steady" means.
  // wellnessFrom is range.from minus the 14-day lead-in, so the series runs
  // lead-in + the selected period, and the last range.days entries are exactly
  // the days the coach asked to see. The 14-day BASELINE stays 14 days at every
  // period (see the header) — only the mean's window widens.
  const wellnessDates = Array.from({ length: WELLNESS_ROLLING_WINDOW + range.days }, (_, i) =>
    addDays(wellnessFrom, i),
  );
  const band = wellnessSeries(wellnessEntries, wellnessDates, 'readiness', WELLNESS_ROLLING_WINDOW);
  // The SUBMISSION COUNT spans the whole selected period...
  const visible = band.slice(-range.days);
  const visibleValues = visible.map((b) => b.value).filter((v): v is number => v !== null);

  // ...but the MEAN is capped at a trailing 28 days. Two different windows on
  // one card, deliberately, and both labelled on it. See the header.
  const meanWindowDays = Math.min(WELLNESS_MEAN_WINDOW, range.days);
  const meanValues = band
    .slice(-meanWindowDays)
    .map((b) => b.value)
    .filter((v): v is number => v !== null);
  const meanPct =
    meanValues.length > 0 ? Math.round(meanValues.reduce((s, v) => s + v, 0) / meanValues.length) : null;
  // The most recent day with an actual submitted value, not just the most
  // recent calendar day: band's last entry is today, and today usually has
  // no entry yet at the time a coach is looking (the whole reason the
  // header dial's own em-dash case exists, §11 rule 1). Using band's bare
  // last element here would report "not enough data" every single morning
  // before that day's check-in lands, even on an athlete with a long,
  // completely normal submission history — this instead asks the real
  // question the status line is for: is his most recent real reading
  // normal for him.
  const latestSubmitted = [...band].reverse().find((b) => b.value !== null);

  const wellnessRating: WellnessRatingSummary = {
    meanPct,
    meanWindowDays,
    submittedN: visibleValues.length,
    windowDays: range.days,
    windowLabel: range.label,
    status: wellnessStatus(latestSubmitted ? bandPosition(latestSubmitted) : 'unknown'),
  };

  const todaysEntry = wellnessEntries.find((e) => e.entry_date === today);
  const headerWellness: HeaderWellness = {
    pct: todaysEntry?.readiness_score ?? null,
  };

  const assignmentRow = (programmeRows.data ?? [])[0] as
    | {
        id: string;
        starts_on: string;
        ends_on: string | null;
        programmes: { id: string; name: string; goal: string | null; duration_weeks: number | null } | null;
      }
    | undefined;

  let programme: ProgrammeBanner = null;
  if (assignmentRow?.programmes) {
    const weeksElapsed = Math.floor(daysBetween(assignmentRow.starts_on, today) / 7) + 1;
    const weekTotal = assignmentRow.programmes.duration_weeks;
    const weekNow = weekTotal !== null ? Math.min(Math.max(weeksElapsed, 1), weekTotal) : Math.max(weeksElapsed, 1);
    const endsOn =
      assignmentRow.ends_on ??
      (weekTotal !== null ? addDays(assignmentRow.starts_on, weekTotal * 7) : null);
    programme = {
      programmeId: assignmentRow.programmes.id,
      name: assignmentRow.programmes.name,
      goal: assignmentRow.programmes.goal,
      weekNow,
      weekTotal,
      endsOn,
    };
  }

  const history: WeightPoint[] = weightRows
    .filter(
      (r): r is { measured_on: string; body_mass_kg: number } =>
        r.body_mass_kg !== null && typeof r.measured_on === 'string',
    )
    .map((r) => ({ date: r.measured_on, kg: r.body_mass_kg }));
  const latest = history[history.length - 1] ?? null;
  let deltaKg: number | null = null;
  let deltaDays: number | null = null;
  if (latest) {
    const target = addDays(latest.date, -WEIGHT_TREND_LOOKBACK_DAYS);
    // The history point on or just before the 14-day-ago mark — real
    // spacing between weigh-ins won't land on exactly 14 days, so this is
    // the closest real prior reading, and the label states the real gap
    // rather than claiming an exact fortnight.
    const priorCandidates = history.filter((p) => p.date <= target && p !== latest);
    const prior = priorCandidates[priorCandidates.length - 1] ?? (history.length > 1 ? history[0] : null);
    if (prior && prior !== latest) {
      deltaKg = Math.round((latest.kg - prior.kg) * 10) / 10;
      deltaDays = daysBetween(prior.date, latest.date);
    }
  }

  return {
    range,
    athlete,
    age: ageFrom(athlete.date_of_birth, timezone),
    athleticism,
    injuries,
    flags: athleteFlags,
    acwr,
    wellnessRating,
    headerWellness,
    programme,
    nutrition,
    bodyWeight: { latestKg: latest?.kg ?? null, history, deltaKg, deltaDays },
  };
}
