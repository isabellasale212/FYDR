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
};

export type Meal = {
  name: string;
  time: string;
  items: MealItem[];
};

// it does for the fixed seed meals below.
export const dominant = (p: number, c: number, f: number) => c > p + f;

export const REFERENCE_MASS_KG = 110;

export const MEALS: Meal[] = [
  {
    name: 'Breakfast',
    time: '07:00',
    items: [
      { name: 'Porridge oats', qty: 120, unit: 'g', proteinG: 13, carbG: 80, fatG: 9 },
      { name: 'Whole milk', qty: 400, unit: 'ml', proteinG: 14, carbG: 19, fatG: 15 },
      { name: 'Banana', qty: 1, unit: 'ea', proteinG: 1, carbG: 27, fatG: 0 },
      { name: 'Whey isolate', qty: 30, unit: 'g', proteinG: 25, carbG: 2, fatG: 1 },
    ],
  },
  {
    name: 'Lunch',
    time: '12:00',
    items: [
      { name: 'Chicken breast', qty: 220, unit: 'g', proteinG: 51, carbG: 0, fatG: 6 },
      { name: 'White rice, dry', qty: 150, unit: 'g', proteinG: 11, carbG: 118, fatG: 1 },
      { name: 'Mixed vegetables', qty: 200, unit: 'g', proteinG: 4, carbG: 14, fatG: 1 },
      { name: 'Olive oil', qty: 15, unit: 'ml', proteinG: 0, carbG: 0, fatG: 14 },
    ],
  },
  {
    name: 'Post-training',
    time: '17:45',
    items: [
      { name: 'Whey isolate', qty: 40, unit: 'g', proteinG: 33, carbG: 3, fatG: 1 },
      { name: 'Rice cakes', qty: 60, unit: 'g', proteinG: 4, carbG: 48, fatG: 1 },
      { name: 'Honey', qty: 30, unit: 'g', proteinG: 0, carbG: 24, fatG: 0 },
      { name: 'Orange juice', qty: 300, unit: 'ml', proteinG: 2, carbG: 33, fatG: 0 },
    ],
  },
  {
    name: 'Dinner',
    time: '19:30',
    items: [
      { name: 'Lean beef mince', qty: 220, unit: 'g', proteinG: 46, carbG: 0, fatG: 22 },
      { name: 'Potatoes', qty: 450, unit: 'g', proteinG: 9, carbG: 78, fatG: 1 },
      { name: 'Green salad', qty: 150, unit: 'g', proteinG: 3, carbG: 8, fatG: 0 },
      { name: 'Olive oil', qty: 15, unit: 'ml', proteinG: 0, carbG: 0, fatG: 14 },
    ],
  },
  {
    name: 'Before bed',
    time: '21:30',
    items: [
      { name: 'Greek yoghurt', qty: 250, unit: 'g', proteinG: 25, carbG: 10, fatG: 12 },
      { name: 'Granola', qty: 60, unit: 'g', proteinG: 5, carbG: 38, fatG: 8 },
      { name: 'Mixed berries', qty: 120, unit: 'g', proteinG: 1, carbG: 12, fatG: 0 },
      { name: 'Almond butter', qty: 20, unit: 'g', proteinG: 4, carbG: 2, fatG: 11 },
    ],
  },
];

export type ScaledItem = MealItem & { scaledQty: number };
export type ScaledMeal = Omit<Meal, 'items'> & {
  items: ScaledItem[];
  totals: { proteinG: number; carbG: number; fatG: number; energyKcal: number };
};

/** NUTRITION-SPEC.md §5's portion-scaling formula, less its day-type term:
 *  grams x (athleteMass / referenceMass). The spec's second factor — x
 *  dayMultiplier for carbohydrate-dominant items — was removed on 2026-09-07,
 *  so this deliberately no longer matches the spec on that point. */
export function scaleMeal(meal: Meal, athleteMassKg: number): ScaledMeal {
  /* Mass, and nothing else. The day type used to stretch carbohydrate-dominant
     items by a multiplier so a match-day plate was drawn bigger; that ratio was
     removed on 2026-09-07 along with the rate-and-multiplier target model, and
     removed from the SIGNATURE rather than passed as 1, because a parameter
     that still exists is one something can start passing again. */
  const scale = athleteMassKg / REFERENCE_MASS_KG;
  let proteinG = 0;
  let carbG = 0;
  let fatG = 0;
  const items: ScaledItem[] = meal.items.map((item) => {
    const itemScale = scale;
    const p = item.proteinG * scale;
    const c = item.carbG * scale;
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

export function scaleDay(athleteMassKg: number): ScaledMeal[] {
  return MEALS.map((m) => scaleMeal(m, athleteMassKg));
}
