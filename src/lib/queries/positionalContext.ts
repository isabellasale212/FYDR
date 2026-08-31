import { groupScopeLabel } from '@/lib/groupFilter';
import { positionToUnit } from '@/lib/nutritionRules';
import { fetchAllPaged } from './paged';
import { fetchGroupAthleteIds, type Db, type Group } from './groups';
import { fetchPositionalGroup, quartile } from './playerProfile';

/* ===========================================================================
 * POSITIONAL CONTEXT — "how does this compare for someone in his position?"
 *
 * The client's own words: "there should also be a comparison to other people
 * in their position". This module is the whole of that comparison, shared by
 * the three per-athlete domain pages (/squad/[athleteId]/nutrition, /wellness,
 * /gym) so all three answer it the same way.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS NOT, AND WHY THAT IS THE POINT
 * ---------------------------------------------------------------------------
 *
 * It is CONTEXT, never a ranking of named team-mates. Every export here
 * returns aggregates — a median, an interquartile band, a count — and the
 * athlete's own value as a marker against them. Nothing in this file returns a
 * peer's name, a peer's id paired with a peer's value, or an ordering of
 * people, and nothing should be added that does.
 *
 * That is not fastidiousness. supabase/migrations/0016_leaderboards.sql
 * already decided this for the two domains this module serves:
 *
 *   wellness.readiness_score  leaderboard_eligible = false, because ranking it
 *     "publishes a health disclosure and rewards over-reporting". Same for
 *     sleep_hours and soreness, each with its own recorded reason.
 *   body composition           barred by name, "Why body composition must
 *     never be leaderboarded" (screens/leaderboards.md).
 *
 * A "top 5 props by body mass" table on a player profile is that decision
 * routed around by a different door. If a comparison can only be expressed as
 * a ranking of named people, it does not get built — the page says so instead.
 *
 * The small-population rule is borrowed from the same migration rather than
 * invented: metric_definitions.min_population defaults to 3 and
 * compute_leaderboard() enforces `greatest(min_population, 3)`. This module
 * uses a HIGHER floor (POSITIONAL_MIN_N below) because a median is a weaker
 * disguise than a rank cut-off: a coach who knows two of three props can read
 * the third off the median exactly.
 *
 * ---------------------------------------------------------------------------
 * TWO REAL POSITIONAL GROUPINGS EXIST. BOTH ARE USED, ON PURPOSE
 * ---------------------------------------------------------------------------
 *
 * Neither was invented here; both were already in the codebase and each is
 * right for a different question.
 *
 *   'group'    — the coach-defined `groups` row with group_type = 'positional'
 *                that the athlete is a member of. Coarse in the seeded data
 *                (Forwards, Backs) but REAL: a club manages it, it is what
 *                queries/playerProfile.ts's Athleticism card already says
 *                "vs Forwards · 12 players" against, and it is what
 *                queries/trainingReport.ts's "vs unit" lens uses. Larger n,
 *                so a safer denominator for anything self-reported.
 *
 *   'position' — lib/nutritionRules.ts's POSITION_TO_UNIT, which maps the free
 *                text in athletes.position onto the six rugby units the
 *                NUTRITION-SPEC's own group rows want (Front row, Second row,
 *                Back row, Half backs, Centres, Back three). Finer, and it is
 *                the taxonomy the /nutrition workspace already thinks in.
 *                Its own header is explicit that it is a display convenience
 *                computed from free text, never stored — a position typed
 *                outside the list falls to 'Other'.
 *
 * WHICH PAGE USES WHICH, and the argument in one line each:
 *
 *   Nutrition → 'position'. Energy and protein needs track body mass, and mass
 *     is exactly what separates a prop from a wing INSIDE "Forwards"/"Backs".
 *     A front-row median is the number a nutritionist actually wants; the
 *     Forwards median blends props with back-rowers and means less than
 *     either. It is also the grouping the rest of the nutrition domain uses.
 *
 *   Wellness → 'group'. Position has no mechanism by which it should change
 *     how well you slept, so the finer split buys nothing — and it costs the
 *     one thing that matters here, n. Wellness is the self-reported health
 *     data 0016 refuses to rank; the widest honest peer set is the safest one.
 *
 *   Gym → 'group'. Same denominator argument, plus this is the grouping
 *     trainingReport.ts already benchmarks load against, so "vs unit" means
 *     the same thing on the training report and on the gym page.
 *
 * 'Other' IS NOT A UNIT. A club using different position names, or a different
 * sport, lands every athlete in 'Other', and a median across an arbitrary
 * catch-all is not a positional comparison. resolvePositionalUnit returns null
 * for it and the page states why rather than drawing a meaningless band.
 *
 * ---------------------------------------------------------------------------
 * THE GROUP FILTER (CLAUDE.md §3 / rule 7) APPLIES, AND IT IS NOT REDUNDANT
 * ---------------------------------------------------------------------------
 *
 * A positional band aggregates other athletes, so it is a multi-athlete view
 * and the global filter scopes it. The tempting reading — "the positional unit
 * IS the filter, so skip it" — is wrong: the unit and the filter are different
 * axes. A coach filtered to Academy looking at a senior prop must not be shown
 * a median computed over senior professionals, and would have no way to tell
 * from the screen that they had been.
 *
 * So the peer set is (positional unit) ∩ (group filter) ∩ (live athletes), the
 * caption names the active scope, and when the intersection is empty or too
 * small the page says which of the two axes emptied it. That last part is why
 * excludedByFilter is returned rather than just a count: "no comparison" and
 * "no comparison because you are filtered to Backs" are different sentences
 * and the coach can only act on the second.
 * ======================================================================== */

/** Below this many athletes with a value, no band is drawn and the reason is
 *  stated.
 *
 *  FIVE, not the leaderboard's three. migration 0016's floor guards a RANK
 *  ("you are 2nd of 3"), which leaks only an ordering. This module publishes a
 *  MEDIAN and an interquartile band, which leak magnitudes: with n=3 the
 *  median IS one athlete's exact value, and a coach who knows the other two
 *  knows whose. Five is the smallest n at which the median is interpolated
 *  away from any single reading and the quartiles span more than one person
 *  each. It also matches the number playerProfile.ts already chose for
 *  BAND_SHADING_MIN_N when it decided "a percentile against three team-mates
 *  shades further than it should" — the same worry, one screen earlier. */
export const POSITIONAL_MIN_N = 5;

export type PositionalSource = 'group' | 'position';

export type PositionalUnit = {
  /** "Forwards", "Front row" — whichever grouping produced it. */
  name: string;
  source: PositionalSource;
  /** Live athletes in the unit AFTER the group filter, subject included when
   *  the subject survives the filter. This is the peer set every band is
   *  computed over. */
  athleteIds: string[];
  /** Live athletes in the unit BEFORE the group filter. */
  unfilteredSize: number;
  /** unfilteredSize − athleteIds.length. Non-zero means the group filter is
   *  narrowing the comparison, which the caption must say out loud. */
  excludedByFilter: number;
  /** False when the group filter excludes the athlete whose page this is. The
   *  page still renders their own value — they are its subject, not part of
   *  the aggregate — but the band is then "his unit, minus him". */
  subjectIncluded: boolean;
};

/** Athletes in the org who are really still here.
 *
 *  `neq('status', 'left_club')` and `is('deleted_at', null)` match
 *  fetchSquadList exactly, so the denominator on these pages is the same set of
 *  people the squad list shows. CLAUDE.md rule 4 means departed athletes are
 *  soft-deleted, not gone, and would otherwise sit in every median forever.
 *
 *  `ids` narrows the read for the callers that already know who they are asking
 *  about — the 'group' branch has the unit's membership in hand and needs this
 *  only as a liveness check, so it must not pull the whole roster to answer
 *  "are these fifteen people still here". The 'position' branch genuinely does
 *  need every athlete, because the unit is derived from a column rather than
 *  read from a membership table and there is no way to know who is in it
 *  without looking.
 *
 *  PAGED either way. One row per athlete with nothing else bounding it is
 *  exactly the read queries/groups.ts's fetchAthletesInNoGroup already pages,
 *  and `.order('id')` is the total order that makes `.range()` safe — it
 *  re-runs the query per page, so a non-unique sort can duplicate or drop a row
 *  across a boundary. */
async function fetchLiveAthletes(
  db: Db,
  orgId: string,
  ids?: readonly string[],
): Promise<{ id: string; position: string | null }[]> {
  if (ids !== undefined && ids.length === 0) return [];
  return fetchAllPaged<{ id: string; position: string | null }>((from, to) => {
    let q = db
      .from('athletes')
      .select('id, position')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club');
    if (ids !== undefined) q = q.in('id', [...ids]);
    return q.order('id').range(from, to);
  });
}

/** Resolves the peer set for one athlete under one grouping, already
 *  intersected with the active group filter and with the live squad.
 *
 *  Returns null when there is no honest positional unit to compare against:
 *  no positional group membership ('group'), or a position that
 *  POSITION_TO_UNIT does not recognise ('position'). Null is a real answer the
 *  page renders as a named absence, never an empty band. */
export async function resolvePositionalUnit(
  db: Db,
  orgId: string,
  athleteId: string,
  opts: { source: PositionalSource; groupIds: readonly string[] },
): Promise<PositionalUnit | null> {
  let name: string;
  let members: string[];
  let scope: string[] | null;

  if (opts.source === 'position') {
    /* The whole roster, because the unit is derived from a COLUMN rather than
     * read from a membership table: there is no query that returns "everyone in
     * the front row" without looking at everyone's position. */
    const [filterScope, live] = await Promise.all([
      fetchGroupAthleteIds(db, orgId, opts.groupIds),
      fetchLiveAthletes(db, orgId),
    ]);
    scope = filterScope;
    const subject = live.find((a) => a.id === athleteId);
    const unit = positionToUnit(subject?.position ?? null);
    // 'Other' is POSITION_TO_UNIT's explicit "I do not recognise this", not a
    // seventh unit. See the header.
    if (unit === 'Other') return null;
    name = unit;
    members = live.filter((a) => positionToUnit(a.position) === unit).map((a) => a.id);
  } else {
    const [filterScope, group] = await Promise.all([
      fetchGroupAthleteIds(db, orgId, opts.groupIds),
      fetchPositionalGroup(db, orgId, athleteId),
    ]);
    scope = filterScope;
    if (!group) return null;
    name = group.name;
    /* fetchPositionalGroup reads group_memberships only and does not know
     * whether a member is still at the club — see its own header. This second
     * read is narrowed to the group's own members rather than the whole roster:
     * it is a liveness check on a known list, not a search. */
    const live = await fetchLiveAthletes(db, orgId, group.athleteIds);
    const liveIds = new Set(live.map((a) => a.id));
    members = group.athleteIds.filter((id) => liveIds.has(id));
  }

  const unfilteredSize = members.length;
  const scopeSet = scope === null ? null : new Set(scope);
  const inScope = scopeSet === null ? members : members.filter((id) => scopeSet.has(id));
  return {
    name,
    source: opts.source,
    athleteIds: inScope,
    unfilteredSize,
    excludedByFilter: unfilteredSize - inScope.length,
    subjectIncluded: inScope.includes(athleteId),
  };
}

export type PositionalBand = {
  key: string;
  label: string;
  /** Appended to every number in the row: 'kg', ' of 100', 'h'. */
  unit: string;
  decimals: number;
  /** This athlete's own value. Rendered even when the band is suppressed —
   *  it is his page, and his own number is not an aggregate of anybody. */
  athleteValue: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  /** Athletes in the peer set who actually have a value for this metric —
   *  always ≤ the unit size, and the number the suppression rule tests. */
  n: number;
  /** True when n < POSITIONAL_MIN_N. The row still renders, with its own
   *  value and an explicit "not enough players" line; the median, the band
   *  and the bar do not. */
  suppressed: boolean;
};

/** One row of positional context.
 *
 *  `valuesByAthlete` must already be restricted to the peer set — this
 *  function does no scoping of its own, deliberately, so there is exactly one
 *  place (resolvePositionalUnit) that decides who is in and the caller cannot
 *  half-apply it.
 *
 *  Note what is absent: no rank, no percentile, no "better/worse". The
 *  quartiles are direction-agnostic on purpose. A low soreness score and a
 *  high squat are not the same kind of fact and this module refuses to pretend
 *  one comparison shape covers both — the page states what the number means. */
export function summarisePositional(
  athleteId: string,
  valuesByAthlete: ReadonlyMap<string, number>,
  meta: { key: string; label: string; unit: string; decimals: number },
): PositionalBand {
  const sorted = [...valuesByAthlete.values()].sort((a, b) => a - b);
  const n = sorted.length;
  const suppressed = n < POSITIONAL_MIN_N;
  return {
    key: meta.key,
    label: meta.label,
    unit: meta.unit,
    decimals: meta.decimals,
    athleteValue: valuesByAthlete.get(athleteId) ?? null,
    median: suppressed ? null : quartile(sorted, 0.5),
    q1: suppressed ? null : quartile(sorted, 0.25),
    q3: suppressed ? null : quartile(sorted, 0.75),
    n,
    suppressed,
  };
}

/** The scope sentence every positional card carries, built from the same
 *  groupScopeLabel every other header eyebrow, CSV caption and PDF meta line
 *  in this app uses (audit finding S4: a filter that re-scopes a screen and
 *  never names itself is the bug). */
export function positionalScopeLine(
  unit: PositionalUnit,
  groups: readonly Group[],
  selectedGroupIds: readonly string[],
): string {
  const scope = groupScopeLabel(groups, selectedGroupIds);
  const base = `${unit.name} · ${unit.athleteIds.length} player${unit.athleteIds.length === 1 ? '' : 's'}`;
  if (unit.excludedByFilter === 0) return `${base} · ${scope}`;
  return (
    `${base} · ${scope} — ${unit.excludedByFilter} of ${unit.unfilteredSize} in this unit ` +
    `${unit.excludedByFilter === 1 ? 'is' : 'are'} outside the group filter and not counted`
  );
}
