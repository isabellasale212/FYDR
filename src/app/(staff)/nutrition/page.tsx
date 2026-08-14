import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { NutritionWorkspace } from '@/components/NutritionWorkspace/NutritionWorkspace';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { addDays, todayIso } from '@/lib/format';
import { fetchBodyCompositionForAthletes } from '@/lib/queries/bodyComposition';
import { fetchGroupAthleteIds, fetchGroups, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { fetchCheckinsForAthletes } from '@/lib/queries/nutrition';
import { fetchRules } from '@/lib/queries/nutritionRules';
import { fetchTargets } from '@/lib/queries/nutritionTargets';
import { mondayOf } from '@/lib/queries/schedule';
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

export default async function NutritionPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, groupsWithCounts, fullSquad, rules, allTargets] = await Promise.all([
    fetchGroups(db, orgId),
    fetchGroupsWithCounts(db, orgId),
    fetchSquadList(db, orgId, []), // unfiltered — plan metadata (assigned count, mean
    // mass) is a fact about the plan, not about the page's current group filter
    fetchRules(db, orgId),
    fetchTargets(db, orgId, timezone),
  ]);

  const today = todayIso(timezone);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const massSince = addDays(today, -90); // trailing ~13 weeks, covers the spec's 12 weekly points
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
          {isCoach || isMedical ? (
            <Link href="/nutrition/new" className="btn-ghost" title="Set one absolute target by hand, outside the rule engine">
              Manual target
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

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
      />
    </>
  );
}
