import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { NutritionWorkspace } from '@/components/NutritionWorkspace/NutritionWorkspace';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { clampPeriod, resolveRange, type RangeKey } from '@/lib/period';
import {
  fetchBodyCompositionForAthletes,
  fetchEarliestBodyCompositionDate,
} from '@/lib/queries/bodyComposition';
import {
  fetchTargetRangesForAthletes,
  type BodyMassTargetRange,
} from '@/lib/queries/bodyMassTargetRange';
import { fetchGroupAthleteIds, fetchGroups, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { fetchCheckinsForAthletes } from '@/lib/queries/nutrition';
import { fetchMealLibrary } from '@/lib/queries/mealLibrary';
import { fetchRules } from '@/lib/queries/nutritionRules';
import { fetchTargets } from '@/lib/queries/nutritionTargets';
import { fetchCurrentSeason, mondayOf } from '@/lib/queries/schedule';
import { fetchSquadList } from '@/lib/queries/squad';
import { buildChaseList, buildWorkspaceAthlete, groupByUnit, meanMass } from '@/lib/nutritionWorkspace';
import { MASS_TREND_FLAG_WINDOW_DAYS } from '@/lib/nutritionRules';
import { requireStaff } from '@/lib/session';
import { MEAL_LIBRARY_EDIT, NUTRITION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Nutrition · Fydr' };

/** Narrows a staff target range row to just its two bounds before it enters the
 *  workspace types. Deliberate: the table draws a band, and a shape that cannot carry
 *  the rationale or the setter's id cannot leak either of them into a component tree
 *  that is one careless prop away from a shared component. */
function rangeBounds(row: BodyMassTargetRange | undefined): { low: number; high: number } | null {
  return row ? { low: row.target_low_kg, high: row.target_high_kg } : null;
}

/* Rebuild of NUTRITION-SPEC.md, replacing the Targets-tab-only cut this route
 * shipped earlier today (see the previous version of this file's own header, and
 * lib/queries/nutritionTargets.ts's, for the "Squad tab and Athlete tab need logged
 * intake that will never exist" reasoning — that reasoning is still correct and this
 * rebuild does not reopen it). What changed: NUTRITION-SPEC.md is staff-side plan
 * *authoring*, not athlete-side intake logging, so CLAUDE.md rule 8 does not block it
 * — the rule's own text names "targets, meal ideas, and training-day fuelling" as
 * exactly the guidance content staff may author. Real deviations from the literal
 * spec, and why, are documented at the point each one is made:
 *   - lib/nutritionRules.ts: the rugby positional-unit mapping (real, derived from
 *     real free-text positions). NOTE: the body-mass target RANGE used to be listed
 *     here as a fabricated schema column, cut twice. It is no longer a deviation —
 *     migration 0060 created body_mass_target_ranges, and this page reads it (see
 *     the BodyMassTargetRange import above) to render the staff-only target column.
 *   - lib/nutritionWorkspace.ts: the "Needs a word" chase list's third reason
 *     (no real daily-intake number exists; reframed onto the real weekly check-in).
 *   - lib/nutritionMeals.ts: the meal plan itself (seed data — no meal_plans table
 *     exists yet; portion scaling against it is real).
 *   - migration 0039_nutrition_rules.sql: the per-kilogram rule storage this whole
 *     screen is organised around, additive and new.
 * "Plans" are real nutrition_rules rows (a plan IS a group- or org-scoped rule), not
 * a separate authored table — there is no plans table anywhere in this schema and the
 * spec's own three named plans do not differ numerically, so nothing is lost by
 * making the plan real instead of decorative. */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* ONE CONTROL. The week navigator, and nothing else.
 *
 * docs/screens/nutrition-plans.md's component table asks for a PeriodSelector
 * here — "Window for the Athlete tab AND the week navigation on Squad" — and
 * for a while this screen had both: a "Mass trend" dropdown over `?period=`,
 * and the week strip over `?week=`. The dropdown is gone at the club's
 * request, so the doc is now ahead of the code on this one row. Recorded here
 * rather than silently diverging, per CLAUDE.md §5.
 *
 * `?week=` — THE WEEK STRIP. A week navigator, NOT a period selector, and the
 * distinction is the whole point. "How many of the last 7 days did they weigh in
 * on" is a question about ONE week; widening it to a season would not answer it
 * more fully, it would replace it with a different question and make this a
 * different screen. So the week gets prev/next, the way /reports/squad's own
 * navigator works. Before that the week was always THIS week, with not even a
 * prev/next — a coach could not look at last week at all.
 *
 * The body-mass trend now runs over a FIXED window (see MASS_TREND_FALLBACK
 * below), which is what it did before the dropdown ever existed. It still
 * cannot be a day or a week: a trend is a line through weekly weigh-ins against
 * a mean +/- 1SD band (lib/nutritionRules.ts), and one day is one point. That
 * constraint has just moved from a disabled dropdown option to a value nobody
 * can set. MASS_TREND_PERIODS survives as the clamp's allow-list, so the
 * fallback still cannot resolve to something a trend cannot be read over.
 *
 * Neither the week nor the trend touches the plans, the targets table or the
 * meal card, none of which are windowed. */
const MASS_TREND_PERIODS: readonly RangeKey[] = ['month', 'season', 'year', 'all'];

/* THIS SCREEN'S OWN DEFAULT, and it is deliberately NOT DEFAULT_RANGE.
 *
 * The trend was a silent fixed `today - 90` before the control existed. Making
 * it selectable also handed it resolvePeriod's global default of `month` (28
 * days) whenever nobody had expressed a period — which is too narrow for what
 * this particular window actually feeds, in two ways that are not cosmetic:
 *
 *  - THE BAND NEEDS WEEKS, NOT DAYS. computeMassBand (nutritionRules.ts) is a
 *    mean +/- 1 SD over ONE WEIGH-IN PER ISO WEEK and returns null below two of
 *    them. A club weighing in monthly has ONE inside 28 days, so it got no band,
 *    no range bar and no in-range count at all.
 *  - THE 12-WEEK CHANGE NEEDS 84 DAYS. `change12wk` is computed inside the trend
 *    window on purpose (a comparison must not reach outside the window its own
 *    caption names), so at 28 days it is unconditionally null — the screen was
 *    rendering a column it had made structurally impossible to fill.
 *
 * `season` is the closest honest fit among the six keys the product defines
 * (lib/period.ts's header: "day to the week to the season to the year to all" is
 * the client's own vocabulary, so a seventh 90-day key is not mine to invent).
 * It is a real nutrition conversation's window, and for the mid-season club this
 * screen serves it is months long — nearest to the 90 days this actually had.
 * `year` and `all` were the alternative and are worse HERE for the reason
 * MASS_TREND_FLAG_WINDOW_DAYS already states about its own 90-day cap: a mean
 * dragged across a close-season or a deliberate mass programme stops describing
 * where the athlete sits now.
 *
 * The pre-season case (a season two weeks old) does collapse the band, and that
 * is accepted rather than missed: the control NAMES the window, so a short band
 * under "This season" is legible, where a 28-day default silently deleted the
 * band while claiming "Last 28 days". A seasonless club gets `year`, the same
 * pairing the testing report makes (TESTING_FALLBACK / TESTING_FALLBACK_NO_SEASON). */
const MASS_TREND_FALLBACK: RangeKey = 'season';
const MASS_TREND_FALLBACK_NO_SEASON: RangeKey = 'year';

export default async function NutritionPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  /* Two different nutrition writes, two different sets, and they are not the
     same question. A nutrition TARGET is a prescription for one athlete
     (NUTRITION_EDIT: sport scientist, nutritionist). The meal LIBRARY is the
     club's shared list of food (MEAL_LIBRARY_EDIT: those two plus the coach).
     Both were previously decided by `isCoach`, which got each of them wrong in
     the opposite direction. */
  const canManualTarget = hasAnyRole(claims.roles, NUTRITION_EDIT);
  const canAuthorMeals = hasAnyRole(claims.roles, MEAL_LIBRARY_EDIT);
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, groupsWithCounts, fullSquad, rules, allTargets, mealLibrary] = await Promise.all([
    fetchGroups(db, orgId),
    fetchGroupsWithCounts(db, orgId),
    fetchSquadList(db, orgId, []), // unfiltered — plan metadata (assigned count, mean
    // mass) is a fact about the plan, not about the page's current group filter
    fetchRules(db, orgId),
    fetchTargets(db, orgId, timezone),
    fetchMealLibrary(db, orgId), // org-scoped meal library, migration 0051 — read here
    // (coach or medical both read fine) regardless of isCoach/isMedical below, same as
    // every other data fetch on this page; write access is gated by RLS, not by what
    // this page chooses to fetch.
  ]);

  // The org's real local today, not the server's UTC clock (todayIso's
  // hardcoded Europe/London fallback) — this page used to call todayIso()
  // with no argument at all despite requireStaff() already having the real
  // timezone, same bug class as schedule.ts's own dayBounds()/rangeBounds().
  const today = todayIso(timezone);

  /* CONTROL 2 — the week navigator. `?week=` is any date inside the wanted
   * week; mondayOf() snaps it, so a link built from any day of a week lands on
   * the same Monday. Clamped forward to the current week: a stray `?week=` must
   * never park a "days weighed in this week" strip in a week that has not
   * happened, which would read as nobody having logged anything.
   *
   * mondayOf is queries/schedule.ts's — the SAME Monday rule as
   * lib/nutritionWorkspace.ts's private mondayOfLocal, which buckets weigh-ins
   * into weeks for the trend band. Checked rather than assumed: both take
   * `T12:00:00Z` (midday, so no DST shift can move the day), read getUTCDay(),
   * and apply `day === 0 ? -6 : 1 - day`. Identical logic, so the strip's week
   * and the band's weeks cannot disagree. */
  const currentWeekStart = mondayOf(today);
  const requestedWeek = typeof params.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.week)
    ? mondayOf(params.week)
    : currentWeekStart;
  const weekStart = requestedWeek > currentWeekStart ? currentWeekStart : requestedWeek;
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;
  const prevWeekStart = addDays(weekStart, -7);
  const nextWeekStart = addDays(weekStart, 7);

  /* CONTROL 1 — the body-mass trend window. Resolved and clamped server-side as
   * well as disabled in the control; the control alone does not stop a
   * bookmarked `?period=day`. fetchCurrentSeason, never fetchCurrentSeasonId
   * (the partial `seasons_one_current` index makes the deleted_at filter
   * mandatory), and starts_on is a `date` column passed through as a plain
   * YYYY-MM-DD string, never via dateInTz. */
  const season = await fetchCurrentSeason(db, orgId);

  /* The screen default is applied BEFORE the clamp, because clampPeriod only
   * substitutes for an ILLEGAL key and resolvePeriod hands an ABSENT period
   * back as `month` with `source: 'default'` — which is legal here, so nothing
   * was ever substituted and MASS_TREND_FALLBACK would have been dead on the
   * only path it exists for. Same fix, same reasoning, as
   * resolveReportPeriod()'s (lib/reportPeriod.server.ts); written out here
   * because this screen is not a report and resolves its own range against its
   * own earliest-weigh-in anchor. */
  /* FIXED, not chosen. The Mass trend dropdown is gone, so `?period=` is
   * deliberately ignored here rather than quietly honoured: a window a reader
   * cannot see, change or reset is worse than no window at all, and this screen
   * shares `fydr-period` with every other one — reading it would let a choice
   * made on Analytics silently re-scope a body-mass trend nobody was looking
   * at. The window is this screen's own default, which is what the trend ran
   * over before the control existed. */
  const period = clampPeriod(season !== null ? MASS_TREND_FALLBACK : MASS_TREND_FALLBACK_NO_SEASON, {
    allowed: MASS_TREND_PERIODS,
    seasonAvailable: season !== null,
    fallback: MASS_TREND_FALLBACK_NO_SEASON,
  });

  const earliestMass = period.key === 'all' ? await fetchEarliestBodyCompositionDate(db, orgId) : null;
  const massRange = resolveRange(period.key, today, season?.starts_on ?? null, earliestMass);

  /* THE TREND INDICATOR'S FIXED WINDOW — not a control, and not derived from
   * either of the two above. massTrendFlag must fire on the same evidence
   * wherever it renders, and /nutrition/new has no period control to agree
   * with, so both screens pass this same trailing 90 days. See
   * MASS_TREND_FLAG_WINDOW_DAYS's own doc in lib/nutritionRules.ts. */
  const flagFrom = addDays(today, -MASS_TREND_FLAG_WINDOW_DAYS);

  /* THREE WINDOWS SHARE ONE FETCH, so its lower bound is the EARLIEST of them,
   * not the trend's alone. Without this, a coach who steps the week navigator
   * back six months while the trend is on "Last 28 days" gets a weigh-in strip
   * showing zero logged days — not because nobody weighed in that week, but
   * because the read never reached back to it. Silently reporting "0 of 7" for
   * a week that was fully logged is exactly the class of lie this whole change
   * exists to remove, and the trend flag's 90 days is now in the same position:
   * narrow the read to the selected trend and the indicator quietly stops
   * firing on a window it does not control. All are plain YYYY-MM-DD calendar
   * dates off `date` columns, so a string compare IS the date compare. */
  const massSince = [weekStart, massRange.from, flagFrom].reduce((a, b) => (b < a ? b : a));

  // Follows the week navigator rather than today, so stepping back a week steps
  // the check-in strip back with it instead of showing this week's answers
  // beside last week's weigh-ins.
  const checkinsSince = addDays(weekStart, -49); // trailing ~7 weeks of check-ins

  const athleteIds = fullSquad.map((a) => a.id);
  /* targetRangesByAthlete: the STAFF-SET body-mass target ranges, migration 0060 — the
   * thing the client asked for and this schema did not have until then. Fetched here
   * rather than per row for the obvious reason, and unconditionally rather than behind
   * a role check because this route is already coach-or-medical only (isCoach/isMedical
   * below) and the table would return an empty map to anyone else regardless: it grants
   * an athlete session no rows at all, which is what keeps client rule 2 true no matter
   * what this page renders. */
  const [massByAthlete, checkinsByAthlete, scopeIds, targetRangesByAthlete] = await Promise.all([
    fetchBodyCompositionForAthletes(db, orgId, athleteIds, massSince),
    fetchCheckinsForAthletes(db, orgId, athleteIds, checkinsSince),
    groupIds.length === 0 ? Promise.resolve(null) : fetchGroupAthleteIds(db, orgId, groupIds),
    fetchTargetRangesForAthletes(db, orgId, athleteIds),
  ]);

  const personalOverrideIds = new Set(
    allTargets.filter((t) => t.athlete_id !== null).map((t) => t.athlete_id as string),
  );

  const allAthletes = fullSquad.map((a) =>
    buildWorkspaceAthlete({
      id: a.id,
      firstName: a.first_name,
      lastName: a.last_name,
      position: a.position,
      groupIds: a.group_ids,
      history: massByAthlete.get(a.id) ?? [],
      trendFrom: massRange.from,
      flagFrom,
      weekStart,
      weekEnd,
      /* Bounded at BOTH ends. fetchCheckinsForAthletes takes only a `since`,
         and exportBuilder's fetchNutritionCheckinExportRows bounds the top in
         memory for exactly this reason -- this call site did not. A check-in
         dated after the current week has not happened yet, and counting one
         inside "the last seven weeks" is the same defect that had the athlete
         picker reporting two 2033-dated wellness entries as this week's
         mornings. Two such rows are in wellness_entries today. */
      checkins: (checkinsByAthlete.get(a.id) ?? []).filter((c) => c.week_start <= weekStart),
      hasPersonalTargetOverride: personalOverrideIds.has(a.id),
      targetRange: rangeBounds(targetRangesByAthlete.get(a.id)),
    }),
  );

  const inScopeAthletes = scopeIds ? allAthletes.filter((a) => scopeIds.includes(a.id)) : allAthletes;
  const chaseList = buildChaseList(inScopeAthletes);
  const unitGroups = groupByUnit(inScopeAthletes);

  const plans = rules
    .filter((r) => r.group_id !== null || r.org_default)
    .map((r) => {
      const groupCount = r.group_id ? (groupsWithCounts.find((g) => g.id === r.group_id)?.member_count ?? 0) : null;
      const members = r.group_id ? allAthletes.filter((a) => a.groupIds.includes(r.group_id as string)) : allAthletes;
      const overrideCount = rules.filter((o) => o.athlete_id && members.some((m) => m.id === o.athlete_id)).length;
      return {
        rule: r,
        name: r.group_id ? (groups.find((g) => g.id === r.group_id)?.name ?? 'Group plan') : 'Squad default',
        assignedCount: r.group_id ? (groupCount ?? members.length) : members.length,
        overrideCount,
        referenceMassKg: meanMass(members),
      };
    });

  const groupsWithoutPlan = groups.filter((g) => !rules.some((r) => r.group_id === g.id));

  /* The week links are built from the LIVE search params, not from a fixed list
   * of keys, so `?groups=` and `?period=` survive a week step. Hand-building an
   * href from known keys is exactly how /reports/athlete/[athleteId] silently
   * drops the group filter (CLAUDE.md §3) — PeriodSelector's own header calls
   * that out as the bug class to stop repeating, and it applies just as much to
   * a prev/next link as to a select. */
  function weekHref(monday: string): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === 'week' || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
    }
    next.set('week', monday);
    return `/nutrition?${next.toString()}`;
  }

  const assignedAthleteCount = allAthletes.filter((a) => {
    const inAGroupWithPlan = a.groupIds.some((gid) => rules.some((r) => r.group_id === gid));
    const hasPersonalRule = rules.some((r) => r.athlete_id === a.id);
    const hasOrgDefault = rules.some((r) => r.org_default);
    return hasPersonalRule || inAGroupWithPlan || hasOrgDefault;
  }).length;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            Nutrition · {groupScopeLabel(groups, groupIds)} · {plans.length} plan{plans.length === 1 ? '' : 's'} · {assignedAthleteCount} athletes assigned
          </p>
          <h1>Nutrition</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canManualTarget ? (
            <Link href="/nutrition/new" className="btn-ghost" title="Set one absolute target by hand, outside the rule engine">
              Manual target
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {/* The week navigator — a different control from the one above, for a
        * different panel, deliberately. Same shape as /reports/squad's own week
        * nav so a coach meets one week-stepping idiom in this app, not two. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <Link href={weekHref(prevWeekStart)} className="btn-ghost" aria-label="Previous week">
          ‹ Previous week
        </Link>
        <p className="num" style={{ fontWeight: 700, margin: 0, flex: 1, textAlign: 'center' }}>
          Week of {formatDate(weekStart, timezone)} to {formatDate(weekEnd, timezone)}
          {isCurrentWeek ? (
            <span className="tiny" style={{ fontWeight: 400 }}> · current week</span>
          ) : null}
        </p>
        {isCurrentWeek ? (
          <span className="btn-ghost" aria-disabled="true" style={{ opacity: 0.4, pointerEvents: 'none' }}>
            Next week ›
          </span>
        ) : (
          <Link href={weekHref(nextWeekStart)} className="btn-ghost" aria-label="Next week">
            Next week ›
          </Link>
        )}
      </div>


      <NutritionWorkspace
        orgId={orgId}
        userId={claims.userId}
        canAuthorMeals={canAuthorMeals}
        canManageNutrition={hasAnyRole(claims.roles, NUTRITION_EDIT)}
        plans={plans.map((p) => ({
          ruleId: p.rule.id,
          name: p.name,
          scope: p.rule.group_id ? ('group' as const) : ('org_default' as const),
          groupId: p.rule.group_id,
          assignedCount: p.assignedCount,
          overrideCount: p.overrideCount,
          referenceMassKg: p.referenceMassKg,
          protein: p.rule.protein_g_per_kg,
          carbByDay: {
            training: p.rule.carb_g_per_kg_training,
            match: p.rule.carb_g_per_kg_match,
            rest: p.rule.carb_g_per_kg_rest,
          },
          fat: p.rule.fat_g_per_kg,
          fluid: p.rule.fluid_ml_per_kg,
          energyCap: p.rule.energy_kcal_cap,
          reason: p.rule.reason,
        }))}
        groupsWithoutPlan={groupsWithoutPlan}
        rules={rules}
        athletes={inScopeAthletes}
        chaseList={chaseList}
        unitGroups={unitGroups.map((g) => ({ unit: g.unit, athleteIds: g.athletes.map((a) => a.id) }))}
        weekStart={weekStart}
        weekEnd={weekEnd}
        timezone={timezone}
        mealLibrary={mealLibrary}
      />
    </>
  );
}
