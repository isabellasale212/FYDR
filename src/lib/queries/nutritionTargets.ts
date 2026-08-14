import { todayIso } from '@/lib/format';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';

/* screens/nutrition-plans.md and screens/nutrition-guidance.md, cut down hard to
 * exactly what 20-route-map.md's own gap note ("G-4") says is buildable: "The
 * targets panel is buildable from nutrition_targets. The guidance content panels
 * are not." See migration 0019's header for the full reasoning — the short version
 * is that nutrition-guidance.md §9 (written after nutrition-plans.md) settled
 * nutrition as guidance-only, so nutrition-plans.md's own Squad tab (intake versus
 * target) and Athlete tab (intake charts, meal distribution) ask for data —
 * logged intake — that CLAUDE.md rule 8 says will never exist. Building those two
 * tabs would be building a screen with an empty column forever, not a reduced
 * screen.
 *
 * What this file covers instead: a Targets list (squad default, group and
 * athlete-specific targets, by MD-n, coach authored or medical-for-an-open-injury
 * authored) and the resolve function an athlete's own "today's targets" card reads.
 * No `/programme` shell was built to hang `nutrition-guidance.md` off — that
 * screen's spec is itself mostly meal ideas and around-training timing content
 * this pass does not build (§17.14, the table that content needs, "was never
 * written" per the same gap note) — so the athlete-facing numbers land on Today
 * instead, which is one of nutrition-guidance.md's own listed entry points
 * ("Today tab, 'Fuelling for today' card"), not an invented shortcut.
 */

export type TargetScope = 'athlete' | 'group' | 'org_default';

export type NutritionTarget = {
  id: string;
  athlete_id: string | null;
  group_id: string | null;
  org_default: boolean;
  md_offset: number | null;
  energy_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fluid_ml: number | null;
  reason: string | null;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
};

export type TargetWithNames = NutritionTarget & {
  athlete_name: string | null;
  group_name: string | null;
};

function scopeOf(t: NutritionTarget): TargetScope {
  if (t.athlete_id) return 'athlete';
  if (t.group_id) return 'group';
  return 'org_default';
}

const SCOPE_ORDER: Record<TargetScope, number> = { org_default: 0, group: 1, athlete: 2 };

/** Live targets by default (not expired, not superseded). Pass includeExpired to
 *  see the full history — nothing is ever deleted, per the table's own comment. */
export async function fetchTargets(
  db: Db,
  orgId: string,
  timezone: string,
  includeExpired = false,
): Promise<TargetWithNames[]> {
  let query = db
    .from('nutrition_targets')
    .select(
      'id, athlete_id, group_id, org_default, md_offset, energy_kcal, protein_g, carbs_g, fat_g, fluid_ml, reason, effective_from, effective_to, created_by, athletes(first_name, last_name), groups(name)',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (!includeExpired) {
    // The org's local today, not the server's UTC one — for an org with a
    // non-UTC offset, a target whose effective_to is exactly today could be
    // wrongly filtered out (or a newly-expired one wrongly kept) depending
    // on the sign of the offset and time of day.
    const today = todayIso(timezone);
    query = query.or(`effective_to.is.null,effective_to.gte.${today}`);
  }

  const { data, error } = await query.order('effective_from', { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((t) => ({
      id: t.id,
      athlete_id: t.athlete_id,
      group_id: t.group_id,
      org_default: t.org_default,
      md_offset: t.md_offset,
      energy_kcal: t.energy_kcal,
      protein_g: t.protein_g,
      carbs_g: t.carbs_g,
      fat_g: t.fat_g,
      fluid_ml: t.fluid_ml,
      reason: t.reason,
      effective_from: t.effective_from,
      effective_to: t.effective_to,
      created_by: t.created_by,
      athlete_name: t.athletes ? `${t.athletes.first_name} ${t.athletes.last_name}` : null,
      group_name: t.groups?.name ?? null,
    }))
    .sort(
      (a, b) =>
        SCOPE_ORDER[scopeOf(a)] - SCOPE_ORDER[scopeOf(b)] ||
        (a.group_name ?? a.athlete_name ?? '').localeCompare(b.group_name ?? b.athlete_name ?? '') ||
        (a.md_offset ?? -999) - (b.md_offset ?? -999),
    );
}

export type CreateTargetInput = {
  scope: TargetScope;
  athleteId: string | null;
  groupId: string | null;
  mdOffset: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fluidMl: number | null;
  reason: string | null;
  effectiveFrom: string;
};

/** The unique indexes are the real rule (one live row per scope+day, one live org
 *  default per day); this just turns their violation into a plain sentence rather
 *  than a raw constraint name. */
export async function createTarget(
  db: Db,
  orgId: string,
  userId: string,
  input: CreateTargetInput,
): Promise<{ error: string | null }> {
  if (
    input.energyKcal === null &&
    input.proteinG === null &&
    input.carbsG === null &&
    input.fatG === null &&
    input.fluidMl === null
  ) {
    return { error: 'Set at least one macro or fluid target.' };
  }

  const { error } = await db.from('nutrition_targets').insert({
    org_id: orgId,
    athlete_id: input.scope === 'athlete' ? input.athleteId : null,
    group_id: input.scope === 'group' ? input.groupId : null,
    org_default: input.scope === 'org_default',
    md_offset: input.mdOffset,
    energy_kcal: input.energyKcal,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
    fluid_ml: input.fluidMl,
    reason: input.reason,
    effective_from: input.effectiveFrom,
    created_by: userId,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'A live target already covers this exact scope and day. Expire it first, or pick a different day.',
      };
    }
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return {
        error:
          input.scope === 'athlete'
            ? 'Medical can only set a personal target for an athlete with an open injury.'
            : 'Only coaching staff can set a group or squad-wide target.',
      };
    }
    /* Raw driver strings never leave this file — audit S5. */
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}

/** Sets effective_to to today rather than deleting — the table's own history is
 *  kept, matching every other interval-style table in this build. "Today" is
 *  the org's local date (todayIso), not the server's UTC one — the same fix
 *  as fetchTargets' own "not expired" filter just above, on the write side
 *  this time: a server-UTC date here could set effective_to to a day the
 *  coach doesn't recognise as "today" for an org with a non-UTC offset. */
export async function expireTarget(db: Db, orgId: string, id: string, timezone: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('nutrition_targets')
    .update({ effective_to: todayIso(timezone) })
    .eq('org_id', orgId)
    .eq('id', id)
    .is('effective_to', null);
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export type ResolvedTarget = {
  target_date: string;
  md_offset: number | null;
  energy_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fluid_ml: number | null;
  source_scope: string;
  md_specific: boolean;
};

/** One athlete, one day. Used by the athlete's own "today's targets" card and
 *  reusable for a future staff athlete-detail view. security definer on the RPC
 *  (migration 0019's own header explains why) means an athlete calling this for
 *  themselves works even though they hold no direct SELECT on nutrition_targets. */
export async function resolveTargetForDate(
  db: Db,
  athleteId: string,
  dateIso: string,
): Promise<ResolvedTarget | null> {
  const { data, error } = await db.rpc('resolve_nutrition_targets', {
    p_athlete_ids: [athleteId],
    p_from: dateIso,
    p_to: dateIso,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    target_date: row.target_date,
    md_offset: row.md_offset,
    energy_kcal: row.energy_kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fluid_ml: row.fluid_ml,
    source_scope: row.source_scope,
    md_specific: row.md_specific,
  };
}
