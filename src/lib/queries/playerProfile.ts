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
import { bandPosition } from '@/lib/stats';
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
 * project — see the seed enrichment note below. The target range and "On
 * target" pill in the spec have no backing column at all (no
 * target_weight_kg anywhere in the schema), so those are cut too; the
 * value, history and trend delta are real. */

/* ACWR windows, band and computation all come from lib/acwr.ts now — this
 * file used to carry its own copy of the maths and its own hardcoded 1.5
 * "flag ceiling", which the audit (S1) caught contradicting the org's real
 * flag rule (above 1.30, thresholds table). The dial's full ring is the
 * top of the shared display band; the "flags above X" copy quotes the
 * real threshold row. */
const WELLNESS_ROLLING_WINDOW = 14; // matches wellnessSeries's use elsewhere (athleteReport.ts, the old profile page)
const WEIGHT_HISTORY_DAYS = 120;
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
  meanPct: number | null; // mean readiness, last 7 days
  submittedN: number; // of 7
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

export async function fetchPlayerProfile(
  db: Db,
  orgId: string,
  athleteId: string,
  timezone: string,
): Promise<PlayerProfile | null> {
  const today = todayIso(timezone);
  const chronicFrom = addDays(today, -(ACWR_CHRONIC_WINDOW_DAYS - 1));
  const acuteFrom = addDays(today, -(ACWR_ACUTE_WINDOW_DAYS - 1));
  const wellnessFrom = addDays(today, -(WELLNESS_ROLLING_WINDOW + ACWR_ACUTE_WINDOW_DAYS - 1));
  const weightFrom = addDays(today, -(WEIGHT_HISTORY_DAYS - 1));

  const athlete = await fetchAthlete(db, orgId, athleteId);
  if (!athlete) return null;

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
    db
      .from('body_composition')
      .select('measured_on, body_mass_kg')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('measured_on', weightFrom)
      .lte('measured_on', today)
      .order('measured_on'),
  ]);

  if (loadEntries.error) throw new Error(loadEntries.error.message);
  if (programmeRows.error) throw new Error(programmeRows.error.message);
  if (weightRows.error) throw new Error(weightRows.error.message);

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
  const wellnessDates = Array.from({ length: WELLNESS_ROLLING_WINDOW + ACWR_ACUTE_WINDOW_DAYS }, (_, i) =>
    addDays(wellnessFrom, i),
  );
  const band = wellnessSeries(wellnessEntries, wellnessDates, 'readiness', WELLNESS_ROLLING_WINDOW);
  const last7 = band.slice(-ACWR_ACUTE_WINDOW_DAYS);
  const last7Values = last7.map((b) => b.value).filter((v): v is number => v !== null);
  const meanPct = last7Values.length > 0 ? Math.round(last7Values.reduce((s, v) => s + v, 0) / last7Values.length) : null;
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
    submittedN: last7Values.length,
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

  const history: WeightPoint[] = (weightRows.data ?? [])
    .filter((r): r is { measured_on: string; body_mass_kg: number } => r.body_mass_kg !== null)
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
    athlete,
    age: ageFrom(athlete.date_of_birth),
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
