import { dominant, type Meal, type MealItem, type MealUnit } from '@/lib/nutritionMeals';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

/* Query layer for meal_library / meal_library_items (migration 0051). See that
 * migration's own header for what this table is, why it is org-scoped only (O-892) and
 * why its RLS split (coach write, medical read-only, no athlete access at all) differs
 * from nutritionRules.ts's personal-scope medical carve-out.
 *
 * libraryMealToMeal below is the one place a meal_library row becomes the plain `Meal`
 * shape lib/nutritionMeals.ts's scaleMeal/scaleDay already scale — reusing those
 * functions unchanged, exactly as they already scale the fixed five reference meals, so
 * a library meal is portion-scaled by athlete mass and day-type multiplier identically. */

export type LibraryMealItemRow = {
  id: string;
  name: string;
  qty: number;
  unit: MealUnit;
  proteinG: number;
  carbG: number;
  fatG: number;
};

export type LibraryMeal = {
  id: string;
  name: string;
  timeLabel: string;
  createdBy: string | null;
  createdAt: string;
  items: LibraryMealItemRow[];
};

/** Every live (not soft-deleted) meal in the org, items included, oldest first so a
 *  freshly authored meal reads at the end of the picker list rather than jumping to the
 *  top mid-session. */
export async function fetchMealLibrary(db: Db, orgId: string): Promise<LibraryMeal[]> {
  const { data, error } = await db
    .from('meal_library')
    .select(
      'id, name, time_label, created_by, created_at, meal_library_items(id, name, qty, unit, protein_g, carb_g, fat_g, sequence)',
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    timeLabel: m.time_label,
    createdBy: m.created_by,
    createdAt: m.created_at,
    items: [...(m.meal_library_items ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((it) => ({
        id: it.id,
        name: it.name,
        qty: Number(it.qty),
        unit: it.unit,
        proteinG: Number(it.protein_g),
        carbG: Number(it.carb_g),
        fatG: Number(it.fat_g),
      })),
  }));
}

/** A library meal, in the exact shape scaleMeal/scaleDay (nutritionMeals.ts) already
 *  scale — so a picked or just-created library meal previews in "The day, as food"
 *  through the identical, unchanged scaling math the fixed five reference meals use. */
export function libraryMealToMeal(m: LibraryMeal): Meal {
  const items: MealItem[] = m.items.map((it) => ({
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    proteinG: it.proteinG,
    carbG: it.carbG,
    fatG: it.fatG,
    carbDominant: dominant(it.proteinG, it.carbG, it.fatG),
  }));
  return { name: m.name, time: m.timeLabel, items };
}

export type NewLibraryMealItemInput = {
  name: string;
  qty: number;
  unit: MealUnit;
  proteinG: number;
  carbG: number;
  fatG: number;
};

export type NewLibraryMealInput = {
  name: string;
  timeLabel: string;
  items: NewLibraryMealItemInput[];
};

/** The just-submitted "+ Meal" form input, in the same `Meal` shape libraryMealToMeal
 *  produces from a fetched row — so a newly created meal previews immediately (added to
 *  NutritionWorkspace's local extraMeals state right after a successful save) without
 *  waiting on a second round trip to re-fetch what was just written. */
export function newLibraryMealInputToMeal(input: NewLibraryMealInput): Meal {
  return libraryMealToMeal({
    id: '',
    name: input.name,
    timeLabel: input.timeLabel,
    createdBy: null,
    createdAt: '',
    items: input.items.map((it, i) => ({ id: `draft-${i}`, ...it })),
  });
}

export type CreateLibraryMealResult = { id: string | null; error: string | null };

/** Writes the meal row, then its items in one bulk insert (a single INSERT statement
 *  with several VALUES rows is atomic on its own, even without a client-side
 *  transaction — the same reasoning addExerciseToSession's siblings in
 *  lib/queries/programmes.ts rely on for one-row-at-a-time writes). If the items insert
 *  fails after the meal row already exists, the meal is soft-deleted as a best-effort
 *  cleanup so a broken, empty meal never lingers in the library — the meal never shows
 *  up in fetchMealLibrary either way, but this also frees the coach to retry with a
 *  clean slate instead of leaving an orphan row an admin has to notice later. */
export async function createLibraryMeal(
  db: Db,
  orgId: string,
  userId: string,
  input: NewLibraryMealInput,
): Promise<CreateLibraryMealResult> {
  const { data: meal, error: mealError } = await db
    .from('meal_library')
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      time_label: input.timeLabel.trim(),
      created_by: userId,
    })
    .select('id')
    .single();

  if (mealError) {
    /* Raw driver strings never leave this file — audit S5. */
    if (mealError.message.toLowerCase().includes('row-level security') || mealError.message.toLowerCase().includes('policy')) {
      return { id: null, error: 'Only coaching staff can add to the meal library.' };
    }
    return { id: null, error: humanizeDbError(mealError.message, 'staff') };
  }

  const { error: itemsError } = await db.from('meal_library_items').insert(
    input.items.map((item, i) => ({
      org_id: orgId,
      meal_id: meal.id,
      sequence: i,
      name: item.name.trim(),
      qty: item.qty,
      unit: item.unit,
      protein_g: item.proteinG,
      carb_g: item.carbG,
      fat_g: item.fatG,
    })),
  );

  if (itemsError) {
    await db.from('meal_library').update({ deleted_at: new Date().toISOString() }).eq('id', meal.id).eq('org_id', orgId);
    return { id: null, error: humanizeDbError(itemsError.message, 'staff') };
  }

  return { id: meal.id, error: null };
}

/** Soft delete only — CLAUDE.md rule 4. No hard delete path exists anywhere in
 *  migration 0051 (no delete policy, no delete grant to authenticated). */
export async function deleteLibraryMeal(db: Db, orgId: string, mealId: string): Promise<{ error: string | null }> {
  return mustAffect(
    db.from('meal_library').update({ deleted_at: new Date().toISOString() }).eq('id', mealId).eq('org_id', orgId).select('id'),
    {
      refusal: 'Not saved: the meal library belongs to the nutritionist, the coach and the sport scientist.',
      onError: (m) => humanizeDbError(m, 'staff'),
    },
  );
}
