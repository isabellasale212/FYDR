import Link from 'next/link';
import { fetchMealLibrary, libraryMealToMeal } from '@/lib/queries/mealLibrary';
import { fetchBodyCompositionEntries } from '@/lib/queries/bodyComposition';
import { REFERENCE_MASS_KG, scaleDay, scaleMeal, type ScaledMeal } from '@/lib/nutritionMeals';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Meal ideas · Fydr' };

/* docs/screens/nutrition-guidance.md, screen 3's "Meal ideas" panel, part of the
 * documented `/programme/nutrition` route (docs/20-route-map.md §4.9). Built on the
 * real meal_library table (migration 0051, athlete read added by migration 0054)
 * instead of the never-written meal_ideas table G-4 blocks on — see that migration's
 * own header and nutrition-guidance.md's amended note for the full reasoning.
 *
 * Read-only, CLAUDE.md rule 8: no logging, no per-meal macro entry, no submit
 * action anywhere on this screen. An athlete browses the exact same real meals (the
 * fixed five reference meals plus whatever their club's coach has authored in the
 * library) a coach already previews on the staff /nutrition workspace, portion-scaled
 * by the SAME scaleMeal/scaleDay math (lib/nutritionMeals.ts) against this athlete's
 * own real body_composition mass — reused unchanged, never reimplemented, so a
 * recipe can never read differently here than it does on the coach's screen.
 *
 * Does not touch or repurpose the coach-only "Food library" / "+ Meal" tools on the
 * staff /nutrition workspace (NutritionWorkspace.tsx) — this is a separate, net-new,
 * athlete-facing screen reading the same underlying table, not a rewire of that one. */
export default async function MealIdeasPage() {
  const { db, orgId, athleteId } = await requireAthlete();

  const [mealLibrary, massHistory] = await Promise.all([
    fetchMealLibrary(db, orgId),
    fetchBodyCompositionEntries(db, orgId, athleteId),
  ]);

  const latestMass = massHistory.find((h) => h.body_mass_kg !== null)?.body_mass_kg ?? null;
  const massKg = latestMass ?? REFERENCE_MASS_KG;
  /* The day-type read (resolveTargetForDate → training or matchday) went with
     the scaling sentence it fed (16 Sept 2026, 1.5); the meals themselves
     never varied by it. */

  const scaledMeals: ScaledMeal[] = [
    ...scaleDay(massKg),
    ...mealLibrary.map((m) => scaleMeal(libraryMealToMeal(m), massKg)),
  ];

  return (
    <>
      <p className="eyebrow">
        <Link href="/programme">My programme</Link> · Meal ideas
      </p>
      <div className="hd">
        <h1 className="d">Meal ideas</h1>
      </div>

      {/* MEALS ONLY (Isabella, 16 Sept 2026, the evening queue, 1.5). The
          scaling line ("Portions scaled to your last weigh-in, 84.5 kg, on a
          training day. Nothing here is logged."), the library note ("The
          standard starting meals — your club has not added its own yet") and
          the supplement/anti-doping sentence that closed the page all went
          under the text rule: the first is a definition sentence (category 3,
          removed from the athlete app) with a helper line (category 1), the
          second orientation (category 2); the third fits none of the six and
          is listed in the report for a ruling. The portions are still scaled
          to the last weigh-in — the number, not the sentence. */}
      <div className="nutr-meal-grid">
        {scaledMeals.map((meal, i) => (
          <MealIdeaCard key={`${meal.name}-${i}`} meal={meal} />
        ))}
      </div>

    </>
  );
}

/* Each meal is a native disclosure (16 Sept 2026, 1.1: "shorter, and
   clickable to expand into the actual meal"): closed, one row — the name,
   its time, its energy; open, the items with their scaled portions and the
   four macros. No JavaScript; the row is the summary, at the 44px floor. */
function MealIdeaCard({ meal }: { meal: ScaledMeal }) {
  return (
    <details className="nutr-meal-card meal-idea">
      <summary className="nutr-meal-header meal-idea-row">
        <span className="nutr-meal-name">{meal.name}</span>
        <span className="nutr-mono nutr-meal-time">
          {meal.time} · {Math.round(meal.totals.energyKcal)} kcal
        </span>
        <span className="meal-idea-chev" aria-hidden="true">
          ▾
        </span>
      </summary>
      {meal.items.map((item) => (
        <div key={item.name} className="nutr-meal-item">
          <span className="nutr-meal-item-name">{item.name}</span>
          <span className="nutr-mono nutr-meal-item-qty">
            {item.scaledQty < 10 ? item.scaledQty.toFixed(1) : Math.round(item.scaledQty)} {item.unit}
          </span>
        </div>
      ))}
      <div className="nutr-meal-macros">
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.energyKcal)}</div>
          <div className="nutr-meal-macro-label">kcal</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.proteinG)}</div>
          <div className="nutr-meal-macro-label">P</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.carbG)}</div>
          <div className="nutr-meal-macro-label">C</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.fatG)}</div>
          <div className="nutr-meal-macro-label">F</div>
        </div>
      </div>
    </details>
  );
}
