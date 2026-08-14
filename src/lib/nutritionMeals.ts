/* The meal plan: NUTRITION-SPEC.md §8's own literal MEALS array, used as a seed/demo
 * dataset — deliberately, not silently.
 *
 * Touchpoint 4 (this build's own brief): there is no meal_plans / meal_items / foods
 * table anywhere in this schema (checked against docs/04-data-model.md and every
 * migration). docs/10-roadmap.md §5's own Phase 2 line item, "a meal-idea library with
 * images served through a CDN transform", is the real, planned, not-yet-built home for
 * the IMAGES and the CDN transform specifically — those are still not built. The rest of
 * that line item, the library itself, now is: migration 0051_meal_library.sql adds
 * meal_library / meal_library_items (org-scoped only — see that migration's own header
 * for how it resolves O-892), and lib/queries/mealLibrary.ts is the query layer a coach's
 * real "Food library" picker and "+ Meal" form (NutritionWorkspace.tsx) write to and read
 * from. Both buttons used to be permanently inert here because there was nowhere real for
 * either action to write to; that is no longer true, and the FOOD DATA below is fixed
 * seed data for exactly that reason — it predates the library and was never meant to be
 * the only source of meals, just the always-present starting set.
 *
 * The FOOD DATA below is a fixed seed, exactly as literal as the spec's own array, and it
 * stays exactly as it is: the five meals below are still the default, always-shown
 * starting set for "the day, as food", never replaced by the library. What the library
 * adds is more meals alongside them, picked or authored per org. The PORTION SCALING
 * applied to any meal, seed or library, is real either way: scaleMeal/scaleDay multiply
 * real numbers (the selected athlete's real body_composition mass, the real day-type
 * multiplier) through, unchanged by the library's existence, so the meal card in front of
 * a nutritionist is always a true day of food for whichever real athlete is currently
 * selected, not a static mock. Which meals are shown in a given viewing session (seed plus
 * whichever library meals were picked or just authored) is local UI state in
 * NutritionWorkspace.tsx, same as before — only the library itself, not a session's
 * on-screen selection, is persisted. */

export type MealUnit = 'g' | 'ml' | 'ea';

export type MealItem = {
  name: string;
  /** Quantity at the reference mass (110 kg), before scaling. */
  qty: number;
  unit: MealUnit;
  proteinG: number;
  carbG: number;
  fatG: number;
  /** Carbohydrate-dominant items scale with the day-type multiplier as well as mass —
   *  NUTRITION-SPEC.md §5: "a rest day shrinks the rice and the oats but not the
   *  chicken." True for every item here whose carb grams exceed its protein and fat
   *  combined. */
  carbDominant: boolean;
};

export type Meal = {
  name: string;
  time: string;
  items: MealItem[];
};

// Exported so lib/queries/mealLibrary.ts can compute the identical carbDominant flag for
// a library-authored item — one formula, not a second copy of it — without changing what
// it does for the fixed seed meals below.
export const dominant = (p: number, c: number, f: number) => c > p + f;

export const REFERENCE_MASS_KG = 110;

export const MEALS: Meal[] = [
  {
    name: 'Breakfast',
    time: '07:00',
    items: [
      { name: 'Porridge oats', qty: 120, unit: 'g', proteinG: 13, carbG: 80, fatG: 9, carbDominant: dominant(13, 80, 9) },
      { name: 'Whole milk', qty: 400, unit: 'ml', proteinG: 14, carbG: 19, fatG: 15, carbDominant: dominant(14, 19, 15) },
      { name: 'Banana', qty: 1, unit: 'ea', proteinG: 1, carbG: 27, fatG: 0, carbDominant: dominant(1, 27, 0) },
      { name: 'Whey isolate', qty: 30, unit: 'g', proteinG: 25, carbG: 2, fatG: 1, carbDominant: dominant(25, 2, 1) },
    ],
  },
  {
    name: 'Lunch',
    time: '12:00',
    items: [
      { name: 'Chicken breast', qty: 220, unit: 'g', proteinG: 51, carbG: 0, fatG: 6, carbDominant: dominant(51, 0, 6) },
      { name: 'White rice, dry', qty: 150, unit: 'g', proteinG: 11, carbG: 118, fatG: 1, carbDominant: dominant(11, 118, 1) },
      { name: 'Mixed vegetables', qty: 200, unit: 'g', proteinG: 4, carbG: 14, fatG: 1, carbDominant: dominant(4, 14, 1) },
      { name: 'Olive oil', qty: 15, unit: 'ml', proteinG: 0, carbG: 0, fatG: 14, carbDominant: dominant(0, 0, 14) },
    ],
  },
  {
    name: 'Post-training',
    time: '17:45',
    items: [
      { name: 'Whey isolate', qty: 40, unit: 'g', proteinG: 33, carbG: 3, fatG: 1, carbDominant: dominant(33, 3, 1) },
      { name: 'Rice cakes', qty: 60, unit: 'g', proteinG: 4, carbG: 48, fatG: 1, carbDominant: dominant(4, 48, 1) },
      { name: 'Honey', qty: 30, unit: 'g', proteinG: 0, carbG: 24, fatG: 0, carbDominant: dominant(0, 24, 0) },
      { name: 'Orange juice', qty: 300, unit: 'ml', proteinG: 2, carbG: 33, fatG: 0, carbDominant: dominant(2, 33, 0) },
    ],
  },
  {
    name: 'Dinner',
    time: '19:30',
    items: [
      { name: 'Lean beef mince', qty: 220, unit: 'g', proteinG: 46, carbG: 0, fatG: 22, carbDominant: dominant(46, 0, 22) },
      { name: 'Potatoes', qty: 450, unit: 'g', proteinG: 9, carbG: 78, fatG: 1, carbDominant: dominant(9, 78, 1) },
      { name: 'Green salad', qty: 150, unit: 'g', proteinG: 3, carbG: 8, fatG: 0, carbDominant: dominant(3, 8, 0) },
      { name: 'Olive oil', qty: 15, unit: 'ml', proteinG: 0, carbG: 0, fatG: 14, carbDominant: dominant(0, 0, 14) },
    ],
  },
  {
    name: 'Before bed',
    time: '21:30',
    items: [
      { name: 'Greek yoghurt', qty: 250, unit: 'g', proteinG: 25, carbG: 10, fatG: 12, carbDominant: dominant(25, 10, 12) },
      { name: 'Granola', qty: 60, unit: 'g', proteinG: 5, carbG: 38, fatG: 8, carbDominant: dominant(5, 38, 8) },
      { name: 'Mixed berries', qty: 120, unit: 'g', proteinG: 1, carbG: 12, fatG: 0, carbDominant: dominant(1, 12, 0) },
      { name: 'Almond butter', qty: 20, unit: 'g', proteinG: 4, carbG: 2, fatG: 11, carbDominant: dominant(4, 2, 11) },
    ],
  },
];

export type ScaledItem = MealItem & { scaledQty: number };
export type ScaledMeal = Omit<Meal, 'items'> & {
  items: ScaledItem[];
  totals: { proteinG: number; carbG: number; fatG: number; energyKcal: number };
};

/** NUTRITION-SPEC.md §5's own portion-scaling formula, unchanged: grams x
 *  (athleteMass / referenceMass), and x dayMultiplier again for carb-dominant items. */
export function scaleMeal(meal: Meal, athleteMassKg: number, dayMultiplier: number): ScaledMeal {
  const scale = athleteMassKg / REFERENCE_MASS_KG;
  let proteinG = 0;
  let carbG = 0;
  let fatG = 0;
  const items: ScaledItem[] = meal.items.map((item) => {
    const itemScale = item.carbDominant ? scale * dayMultiplier : scale;
    const p = item.proteinG * scale;
    const c = item.carbG * (item.carbDominant ? scale * dayMultiplier : scale);
    const f = item.fatG * scale;
    proteinG += p;
    carbG += c;
    fatG += f;
    return { ...item, scaledQty: item.qty * itemScale };
  });
  return {
    ...meal,
    items,
    totals: { proteinG, carbG, fatG, energyKcal: proteinG * 4 + carbG * 4 + fatG * 9 },
  };
}

export function scaleDay(athleteMassKg: number, dayMultiplier: number): ScaledMeal[] {
  return MEALS.map((m) => scaleMeal(m, athleteMassKg, dayMultiplier));
}
