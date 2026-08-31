import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { NutritionWorkspace } from '@/components/NutritionWorkspace/NutritionWorkspace';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { clampPeriod, resolveRange, type RangeKey } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import {
  fetchBodyCompositionForAthletes,
  fetchEarliestBodyCompositionDate,
} from '@/lib/queries/bodyComposition';
import { fetchGroupAthleteIds, fetchGroups, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { fetchCheckinsForAthletes } from '@/lib/queries/nutrition';
import { fetchMealLibrary } from '@/lib/queries/mealLibrary';
import { fetchRules } from '@/lib/queries/nutritionRules';
import { fetchTargets } from '@/lib/queries/nutritionTargets';
import { fetchCurrentSeason, mondayOf } from '@/lib/queries/schedule';
import { fetchSquadList } from '@/lib/queries/squad';
import { buildChaseList, buildWorkspaceAthlete, groupByUnit, meanMass } from '@/lib/nutritionWorkspace';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Nutrition · Fydr' };

/* Rebuild of NUTRITION-SPEC.md, replacing the Targets-tab-only cut this route
 * shipped earlier today (see the previous version of this file's own header, and
 * lib/queries/nutritionTargets.ts's, for the "Squad tab and Athlete tab need logged
 * intake that will never exist" reasoning — that reasoning is still correct and this
 * rebuild does not reopen it). What changed: NUTRITION-SPEC.md is staff-side plan
 * *authoring*, not athlete-side intake logging, so CLAUDE.md rule 8 does not block it
 * — the rule's own text names "targets, meal ideas, and training-day fuelling" as
 * exactly the guidance content staff may author. Real deviations from the literal
 * spec, and why, are documented at the point each one is made:
 *   - lib/nutritionRules.ts: the body-mass target RANGE (a fabricated schema column,
 *     already cut once on the player-profile page) and the rugby positional-unit
 *     mapping (real, derived from real free-text positions).
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

/* TWO CONTROLS, NOT ONE. docs/screens/nutrition-plans.md's own component table
 * asks for exactly this split — PeriodSelector is listed as the "Window for the
 * Athlete tab AND the week navigation on Squad", which is two different things
 * wearing one row.
 *
 * 1. `?period=` — the SELECTED ATHLETE'S BODY-MASS TREND. Was a silent, fixed
 *    `today - 90`. `day` and `week` are DISABLED with their reason rather than
 *    hidden: a body-mass trend is a line through weekly weigh-ins against a
 *    mean +/- 1SD band (lib/nutritionRules.ts), and one day or one week is one
 *    or two points — not a band, and not a trend. That is lib/period.ts's rule
 *    1 applied to this screen's actual metric, not a style preference.
 *
 * 2. `?week=` — THE WEEK STRIP. A week navigator, NOT a period selector, and
 *    the distinction is the whole point. "How many of the last 7 days did he
 *    weigh in on" is a question about ONE week; widening it to a season would
 *    not answer it more fully, it would replace it with a different question
 *    and make this a different screen. So the week gets prev/next, the way
 *    /reports/squad's own navigator works, and keeps its identity. Before this
 *    the week was always THIS week, with not even a prev/next — a coach could
 *    not look at last week at all.
 *
 * The two are independent and both live on the URL at once. Neither touches the
 * plans, the targets table or the meal card, none of which are windowed. */
const MASS_TREND_PERIODS: readonly RangeKey[] = ['month', 'season', 'year', 'all'];
const MASS_TREND_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'one weigh-in is not a trend',
  week: 'a mass trend needs a band, not a week',
};

export default async function NutritionPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
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
  const [requestedPeriod, season] = await Promise.all([resolvePeriod(params), fetchCurrentSeason(db, orgId)]);
  const period = clampPeriod(requestedPeriod.key, {
    allowed: MASS_TREND_PERIODS,
    seasonAvailable: season !== null,
  });
  const earliestMass = period.key === 'all' ? await fetchEarliestBodyCompositionDate(db, orgId) : null;
  const massRange = resolveRange(period.key, today, season?.starts_on ?? null, earliestMass);

  /* THE TWO CONTROLS SHARE ONE FETCH, so its lower bound is the EARLIER of the
   * two, not the trend's alone. Without this, a coach who steps the week
   * navigator back six months while the trend is on "Last 28 days" gets a
   * weigh-in strip showing zero logged days — not because nobody weighed in
   * that week, but because the read never reached back to it. Silently
   * reporting "0 of 7" for a week that was fully logged is exactly the class of
   * lie this whole change exists to remove. Both are plain YYYY-MM-DD calendar
   * dates off `date` columns, so a string compare IS the date compare. */
  const massSince = weekStart < massRange.from ? weekStart : massRange.from;

  // Follows the week navigator rather than today, so stepping back a week steps
  // the check-in strip back with it instead of showing this week's answers
  // beside last week's weigh-ins.
  const checkinsSince = addDays(weekStart, -49); // trailing ~7 weeks of check-ins

  const athleteIds = fullSquad.map((a) => a.id);
  const [massByAthlete, checkinsByAthlete, scopeIds] = await Promise.all([
    fetchBodyCompositionForAthletes(db, orgId, athleteIds, massSince),
    fetchCheckinsForAthletes(db, orgId, athleteIds, checkinsSince),
    groupIds.length === 0 ? Promise.resolve(null) : fetchGroupAthleteIds(db, orgId, groupIds),
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
      weekStart,
      weekEnd,
      checkins: checkinsByAthlete.get(a.id) ?? [],
      hasPersonalTargetOverride: personalOverrideIds.has(a.id),
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
          <p className="nutr-intro">
            A plan is a set of rules per kilogram of body mass. Change the protein rule once and
            every athlete&rsquo;s target moves with it, and it moves again on its own when they
            next weigh in.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Labelled for what it actually governs. A bare "Period" beside a
            * screen with a week strip on it would read as though it moved the
            * week too, which is precisely what it must not do. */}
          <PeriodSelector
            value={period.key}
            allowed={MASS_TREND_PERIODS}
            reasons={MASS_TREND_REASONS}
            season={season}
            label="Mass trend"
            ariaLabel="Window for the selected athlete's body mass trend"
          />
          {isCoach || isMedical ? (
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
        <p className="mono" style={{ fontWeight: 700, margin: 0, flex: 1, textAlign: 'center' }}>
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

      <p className="cap" style={{ margin: '0 0 12px' }}>
        The week above drives the weigh-in strip, the weekly check-in panel and the &ldquo;needs a
        word&rdquo; list. The mass trend runs over {massRange.label.toLowerCase()} (
        {formatDate(massRange.from, timezone)} to {formatDate(massRange.to, timezone)}) and is set
        separately, because a trend and a week are two different questions.
        {massRange.clipped ? ' The trend is clipped to the two-year maximum this app reads in one window.' : ''}
        {period.coercedFrom !== null
          ? ` "${period.coercedFrom}" is not a window a mass trend can be read over, so ${massRange.label.toLowerCase()} is shown instead.`
          : ''}
      </p>

      <NutritionWorkspace
        orgId={orgId}
        userId={claims.userId}
        isCoach={isCoach}
        isMedical={isMedical}
        plans={plans.map((p) => ({
          ruleId: p.rule.id,
          name: p.name,
          scope: p.rule.group_id ? ('group' as const) : ('org_default' as const),
          groupId: p.rule.group_id,
          assignedCount: p.assignedCount,
          overrideCount: p.overrideCount,
          referenceMassKg: p.referenceMassKg,
          protein: p.rule.protein_g_per_kg,
          carb: p.rule.carb_g_per_kg,
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
