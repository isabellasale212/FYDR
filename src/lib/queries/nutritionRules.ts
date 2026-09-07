import { computeTargets, mdOffsetForDayType, type DayTypeId, type MacroRule } from '@/lib/nutritionRules';
import { humanizeDbError } from '@/lib/writeErrors';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchBodyCompositionForAthletes } from './bodyComposition';
import { todayIso } from '@/lib/format';

/* Query layer for nutrition_rules (migration 0039). Mirrors lib/queries/nutritionTargets.ts's
 * shape deliberately — same scope model, same versioning convention, same error mapping —
 * because the two tables are siblings and should read like it. See the migration's own
 * header for what this table is and is not. */

export type RuleScope = 'athlete' | 'group' | 'org_default';

export type NutritionRuleRow = {
  id: string;
  athlete_id: string | null;
  group_id: string | null;
  org_default: boolean;
  protein_g_per_kg: number;
  carb_g_per_kg_training: number;
  carb_g_per_kg_match: number;
  carb_g_per_kg_rest: number;
  fat_g_per_kg: number;
  fluid_ml_per_kg: number;
  energy_kcal_cap: number | null;
  reason: string | null;
  effective_from: string;
  created_by: string | null;
};

export type RuleWithNames = NutritionRuleRow & {
  athlete_name: string | null;
  group_name: string | null;
  group_sort_order: number;
};

export function ruleToMacroRule(r: NutritionRuleRow): MacroRule {
  return {
    proteinGPerKg: r.protein_g_per_kg,
    carbGPerKgByDay: {
      training: r.carb_g_per_kg_training,
      match: r.carb_g_per_kg_match,
      rest: r.carb_g_per_kg_rest,
    },
    fatGPerKg: r.fat_g_per_kg,
    fluidMlPerKg: r.fluid_ml_per_kg,
    energyKcalCap: r.energy_kcal_cap,
  };
}

/** Every live rule in the org, athlete and group names attached for display. */
export async function fetchRules(db: Db, orgId: string): Promise<RuleWithNames[]> {
  const { data, error } = await db
    .from('nutrition_rules')
    .select(
      'id, athlete_id, group_id, org_default, protein_g_per_kg, carb_g_per_kg_training, carb_g_per_kg_match, carb_g_per_kg_rest, fat_g_per_kg, fluid_ml_per_kg, energy_kcal_cap, reason, effective_from, created_by, athletes(first_name, last_name), groups(name, sort_order)',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .or('effective_to.is.null')
    .order('effective_from', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    athlete_id: r.athlete_id,
    group_id: r.group_id,
    org_default: r.org_default,
    protein_g_per_kg: Number(r.protein_g_per_kg),
    carb_g_per_kg_training: Number(r.carb_g_per_kg_training),
    carb_g_per_kg_match: Number(r.carb_g_per_kg_match),
    carb_g_per_kg_rest: Number(r.carb_g_per_kg_rest),
    fat_g_per_kg: Number(r.fat_g_per_kg),
    fluid_ml_per_kg: Number(r.fluid_ml_per_kg),
    energy_kcal_cap: r.energy_kcal_cap === null ? null : Number(r.energy_kcal_cap),
    reason: r.reason,
    effective_from: r.effective_from,
    created_by: r.created_by,
    athlete_name: r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : null,
    group_name: r.groups?.name ?? null,
    group_sort_order: r.groups?.sort_order ?? 0,
  }));
}

export type ResolvedRule = {
  rule: RuleWithNames;
  source: RuleScope;
};

/** Same precedence resolve_nutrition_targets already uses: personal beats group beats
 *  org default. An athlete in several groups with rules resolves to the
 *  lowest-sort-order (first-listed) group, matching nutrition-plans.md's own stated
 *  behaviour for the identical ambiguity on nutrition_targets ("Forwards applies,
 *  because it sorts first"). Pure function over already-fetched rows — no I/O — so it
 *  runs identically on the server for the initial render and in the client workspace
 *  every time a plan or athlete selection changes. */
export function resolveRuleForAthlete(
  rules: readonly RuleWithNames[],
  athleteId: string,
  athleteGroupIds: readonly string[],
): ResolvedRule | null {
  const personal = rules.find((r) => r.athlete_id === athleteId);
  if (personal) return { rule: personal, source: 'athlete' };

  const groupRules = rules
    .filter((r) => r.group_id && athleteGroupIds.includes(r.group_id))
    .sort((a, b) => a.group_sort_order - b.group_sort_order);
  if (groupRules[0]) return { rule: groupRules[0], source: 'group' };

  const orgDefault = rules.find((r) => r.org_default);
  if (orgDefault) return { rule: orgDefault, source: 'org_default' };

  return null;
}

export type RuleInput = {
  scope: RuleScope;
  athleteId: string | null;
  groupId: string | null;
  protein: number;
  /* Three independent numbers, not a rate. See MacroRule in lib/nutritionRules.ts
     for why the shared carb rate and its per-day multipliers were removed. */
  carbByDay: Record<DayTypeId, number>;
  fat: number;
  fluid: number;
  energyCap: number | null;
  reason: string | null;
};

/** Create-or-version a rule for one scope. Same same-day-collapse edge case
 *  nutrition-plans.md specifies for nutrition_targets (§"Edge cases" 13): a second
 *  edit on the day the row was already created updates it in place rather than
 *  trying to expire a row whose effective_from is today, which would fail
 *  effective_to >= effective_from. Returns the live row id either way, since the
 *  caller (assignPlan) needs it to write nutrition_targets.reason with a trace back
 *  to the rule that produced them. */
export async function versionRule(
  db: Db,
  orgId: string,
  userId: string,
  input: RuleInput,
  timezone: string,
): Promise<{ id: string | null; error: string | null }> {
  // The org's real local today, not the server's UTC clock (todayIso's
  // hardcoded Europe/London fallback) — same bug class as schedule.ts's
  // own dayBounds()/rangeBounds().
  const today = todayIso(timezone);

  let existing = db
    .from('nutrition_rules')
    .select('id, effective_from')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .is('effective_to', null);
  existing =
    input.scope === 'athlete'
      ? existing.eq('athlete_id', input.athleteId as string)
      : input.scope === 'group'
        ? existing.eq('group_id', input.groupId as string)
        : existing.eq('org_default', true);

  const { data: existingRow, error: existingError } = await existing.maybeSingle();
  /* Raw driver strings never leave this file — audit S5. */
  if (existingError) return { id: null, error: humanizeDbError(existingError.message, 'staff') };

  const values = {
    protein_g_per_kg: input.protein,
    carb_g_per_kg_training: input.carbByDay.training,
    carb_g_per_kg_match: input.carbByDay.match,
    carb_g_per_kg_rest: input.carbByDay.rest,
    fat_g_per_kg: input.fat,
    fluid_ml_per_kg: input.fluid,
    energy_kcal_cap: input.energyCap,
    reason: input.reason,
  };

  if (existingRow && existingRow.effective_from === today) {
    const { error } = await db.from('nutrition_rules').update(values).eq('id', existingRow.id).eq('org_id', orgId);
    if (error) return { id: null, error: humanizeDbError(error.message, 'staff') };
    return { id: existingRow.id, error: null };
  }

  if (existingRow) {
    const { error: expireError } = await db
      .from('nutrition_rules')
      .update({ effective_to: today })
      .eq('id', existingRow.id)
      .eq('org_id', orgId);
    if (expireError) return { id: null, error: humanizeDbError(expireError.message, 'staff') };
  }

  const { data: inserted, error: insertError } = await db
    .from('nutrition_rules')
    .insert({
      org_id: orgId,
      athlete_id: input.scope === 'athlete' ? input.athleteId : null,
      group_id: input.scope === 'group' ? input.groupId : null,
      org_default: input.scope === 'org_default',
      effective_from: today,
      created_by: userId,
      ...values,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { id: null, error: 'A live rule already covers this exact scope. Try again.' };
    }
    if (insertError.message.toLowerCase().includes('row-level security') || insertError.message.toLowerCase().includes('policy')) {
      return {
        id: null,
        error:
          input.scope === 'athlete'
            ? 'Medical can only set a personal rule for an athlete with an open injury.'
            : 'Only coaching staff can set a group or org-default rule.',
      };
    }
    return { id: null, error: humanizeDbError(insertError.message, 'staff') };
  }
  return { id: inserted.id, error: null };
}

export type TargetSyncResult = { athleteId: string; skipped: boolean; reason?: string };

/** The write half of "wires the actual target computation... into the existing
 *  nutrition_targets shape so the athlete-facing screens stay correctly fed"
 *  (this build's own brief). Called after versionRule succeeds, once per affected
 *  athlete. Deliberately conservative: an athlete-scoped assign always writes (that
 *  IS the point of a personal rule); a group or org-default assign skips any athlete
 *  who already carries a live PERSONAL nutrition_targets row, so this never silently
 *  overwrites a manually authored override — like the real one already on this org's
 *  James Barnes ('Return to play, energy reduced during limited training') — set
 *  through the existing /nutrition/new form. Same interval-versioning convention as
 *  versionRule above, applied to nutrition_targets this time. */
export async function syncComputedTarget(
  db: Db,
  orgId: string,
  userId: string,
  athleteId: string,
  ruleScope: RuleScope,
  ruleLabel: string,
  rule: MacroRule,
  massKg: number,
  dayType: DayTypeId,
  dayTypeLabel: string,
  timezone: string,
): Promise<TargetSyncResult> {
  const mdOffset = mdOffsetForDayType(dayType);

  if (ruleScope !== 'athlete') {
    const { data: personal, error: personalError } = await db
      .from('nutrition_targets')
      .select('id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('deleted_at', null)
      .is('effective_to', null)
      .limit(1);
    if (personalError) return { athleteId, skipped: true, reason: personalError.message };
    if ((personal ?? []).length > 0) {
      return { athleteId, skipped: true, reason: 'has its own personal target already' };
    }
  }

  const computed = computeTargets(rule, massKg, dayType);
  // The org's real local today, not the server's UTC clock — same bug
  // class as versionRule above.
  const today = todayIso(timezone);
  const reason = `Auto-computed from ${ruleLabel} (${dayTypeLabel}) at ${massKg.toFixed(1)} kg`;

  let existing = db
    .from('nutrition_targets')
    .select('id, effective_from')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('deleted_at', null)
    .is('effective_to', null);
  existing = mdOffset === null ? existing.is('md_offset', null) : existing.eq('md_offset', mdOffset);
  const { data: existingRow, error: existingError } = await existing.maybeSingle();
  if (existingError) return { athleteId, skipped: true, reason: existingError.message };

  const values = {
    energy_kcal: Math.round(computed.energyKcal),
    protein_g: Math.round(computed.proteinG * 10) / 10,
    carbs_g: Math.round(computed.carbsG * 10) / 10,
    fat_g: Math.round(computed.fatG * 10) / 10,
    fluid_ml: Math.round(computed.fluidMl),
    reason,
  };

  /* G-34. Both updates below ask for the affected rows, and the reason is the
     first one: when a target already exists for TODAY this branch returns
     success without ever attempting an insert. An UPDATE that RLS refuses
     matches no row and does not raise, so before this the whole assign reported
     success and changed nothing, on exactly the day a coach was most likely to
     be adjusting a plan they had already set. On any other day the insert below
     raises 42501 and the refusal is visible, which is why this was invisible.
     Nutrition writes belong to the nutritionist and the sport scientist (0070,
     access matrix §3.3). */
  const REFUSED = 'Not saved: setting nutrition targets belongs to the nutritionist and the sport scientist.';

  if (existingRow && existingRow.effective_from === today) {
    const { data, error } = await db
      .from('nutrition_targets')
      .update(values)
      .eq('id', existingRow.id)
      .eq('org_id', orgId)
      .select('id');
    if (error) return { athleteId, skipped: true, reason: error.message };
    if (!data || data.length === 0) return { athleteId, skipped: true, reason: REFUSED };
    return { athleteId, skipped: false };
  }

  if (existingRow) {
    const { data: expired, error: expireError } = await db
      .from('nutrition_targets')
      .update({ effective_to: today })
      .eq('id', existingRow.id)
      .eq('org_id', orgId)
      .select('id');
    if (expireError) return { athleteId, skipped: true, reason: expireError.message };
    if (!expired || expired.length === 0) return { athleteId, skipped: true, reason: REFUSED };
  }

  const { error: insertError } = await db.from('nutrition_targets').insert({
    org_id: orgId,
    athlete_id: athleteId,
    md_offset: mdOffset,
    effective_from: today,
    created_by: userId,
    ...values,
  });
  if (insertError) return { athleteId, skipped: true, reason: insertError.message };
  return { athleteId, skipped: false };
}

/* ---------------------------------------------------------------------------
 * assignPlan / createPlan — the orchestration behind the spec's "Assign" and
 * "New plan" buttons, both listed as inert in NUTRITION-SPEC.md §9. This build makes
 * them real (see nutrition/page.tsx's header for why): a client component calls
 * these directly with its own browser Supabase client, the same
 * createClient()-plus-useMutation pattern NutritionTargetsList.tsx already uses for
 * expireTarget — RLS is the actual security boundary either way (CLAUDE.md rule 2),
 * not which side of the network the call starts from.
 * ------------------------------------------------------------------------- */

export type AssignPlanInput = {
  scope: RuleScope;
  athleteId: string | null;
  groupId: string | null;
  protein: number;
  /* Three independent numbers, not a rate. See MacroRule in lib/nutritionRules.ts
     for why the shared carb rate and its per-day multipliers were removed. */
  carbByDay: Record<DayTypeId, number>;
  fat: number;
  fluid: number;
  energyCap: number | null;
  reason: string | null;
  dayType: DayTypeId;
  dayTypeLabel: string;
  scopeLabel: string;
};

export type AssignPlanResult = { error: string | null; synced: number; skipped: number };

export async function assignPlan(
  db: Db,
  orgId: string,
  userId: string,
  input: AssignPlanInput,
  timezone: string,
): Promise<AssignPlanResult> {
  const { id: ruleId, error } = await versionRule(
    db,
    orgId,
    userId,
    {
      scope: input.scope,
      athleteId: input.athleteId,
      groupId: input.groupId,
      protein: input.protein,
      carbByDay: input.carbByDay,
      fat: input.fat,
      fluid: input.fluid,
      energyCap: input.energyCap,
      reason: input.reason,
    },
    timezone,
  );
  if (error || !ruleId) return { error: error ?? 'Could not save the rule.', synced: 0, skipped: 0 };

  const athleteIds =
    input.scope === 'athlete'
      ? [input.athleteId as string]
      : input.scope === 'group'
        ? ((await fetchGroupAthleteIds(db, orgId, [input.groupId as string])) ?? [])
        : await allAthleteIds(db, orgId);

  const masses = await fetchBodyCompositionForAthletes(db, orgId, athleteIds, tenYearsAgo());

  const rule: MacroRule = {
    proteinGPerKg: input.protein,
    carbGPerKgByDay: input.carbByDay,
    fatGPerKg: input.fat,
    fluidMlPerKg: input.fluid,
    energyKcalCap: input.energyCap,
  };

  let synced = 0;
  let skipped = 0;
  for (const athleteId of athleteIds) {
    const history = masses.get(athleteId) ?? [];
    const latest = history.find((h) => h.body_mass_kg !== null);
    if (!latest || latest.body_mass_kg === null) {
      skipped += 1;
      continue;
    }
    const result = await syncComputedTarget(
      db,
      orgId,
      userId,
      athleteId,
      input.scope,
      input.scopeLabel,
      rule,
      latest.body_mass_kg,
      input.dayType,
      input.dayTypeLabel,
      timezone,
    );
    if (result.skipped) skipped += 1;
    else synced += 1;
  }

  return { error: null, synced, skipped };
}

async function allAthleteIds(db: Db, orgId: string): Promise<string[]> {
  const { data, error } = await db
    .from('athletes')
    .select('id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

function tenYearsAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

export type CreatePlanResult = { error: string | null; ruleId: string | null };

/** New plan: a real group with no live plan of its own yet, at
 *  NUTRITION-SPEC.md §4's own literal starting numbers. See migration 0039's header
 *  for why this build does not invent a third, numerically distinct "Return from
 *  injury" plan itself. */
export async function createPlan(
  db: Db,
  orgId: string,
  userId: string,
  groupId: string,
  existingRules: readonly RuleWithNames[],
  timezone: string,
): Promise<CreatePlanResult> {
  if (existingRules.some((r) => r.group_id === groupId)) {
    return { error: 'That group already has a live plan.', ruleId: null };
  }
  return versionRule(
    db,
    orgId,
    userId,
    {
      scope: 'group',
      athleteId: null,
      groupId,
      protein: 1.9,
      /* A brand-new group rule starts at the printed guidelines. Written once,
         at creation; from then on each day type is edited on its own. */
      carbByDay: { training: 6.0, match: 7.5, rest: 3.5 },
      fat: 1.0,
      fluid: 40,
      energyCap: null,
      reason: null,
    },
    timezone,
  ).then(({ id, error }) => ({ error, ruleId: id }));
}
