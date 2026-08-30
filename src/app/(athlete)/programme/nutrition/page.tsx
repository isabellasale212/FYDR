import Link from 'next/link';
import { fetchMealLibrary, libraryMealToMeal } from '@/lib/queries/mealLibrary';
import { fetchBodyCompositionEntries } from '@/lib/queries/bodyComposition';
import { resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import { DAY_TYPES, type DayTypeId } from '@/lib/nutritionRules';
import { REFERENCE_MASS_KG, scaleDay, scaleMeal, type ScaledMeal } from '@/lib/nutritionMeals';
import { todayIso } from '@/lib/format';
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
  const { db, orgId, athleteId, timezone } = await requireAthlete();
  const today = todayIso(timezone);

  const [mealLibrary, massHistory, target] = await Promise.all([
    fetchMealLibrary(db, orgId),
    fetchBodyCompositionEntries(db, orgId, athleteId),
    resolveTargetForDate(db, athleteId, today),
  ]);

  const latestMass = massHistory.find((h) => h.body_mass_kg !== null)?.body_mass_kg ?? null;
  const massKg = latestMass ?? REFERENCE_MASS_KG;

  // Real signal, not invented: nutritionRules.ts's mdOffsetForDayType only ever
  // writes a non-null md_offset (0) for a matchday-specific rule — training and rest
  // both resolve to null and are not distinguishable from a resolved target alone.
  // So: a resolved target that IS specifically the MD-0 rule means today is being
  // treated as a matchday for nutrition purposes; anything else defaults to
  // training, the same default the coach workspace itself opens on.
  const dayType: DayTypeId = target?.md_specific && target.md_offset === 0 ? 'match' : 'training';
  const dayTypeInfo = DAY_TYPES.find((d) => d.id === dayType) ?? DAY_TYPES[0]!;

  const scaledMeals: ScaledMeal[] = [
    ...scaleDay(massKg, dayTypeInfo.multiplier),
    ...mealLibrary.map((m) => scaleMeal(libraryMealToMeal(m), massKg, dayTypeInfo.multiplier)),
  ];

  return (
    <>
      <p className="eyebrow">
        <Link href="/programme">My programme</Link> · Meal ideas
      </p>
      <div className="hd">
        <h1 className="d">Meal ideas</h1>
      </div>

      <p className="import-sub">
        {latestMass !== null ? (
          <>
            Portions below are scaled to your last recorded weight,{' '}
            <span className="nutr-mono">{latestMass.toFixed(1)} kg</span>, on a{' '}
            {dayTypeInfo.label.toLowerCase()}.
          </>
        ) : (
          <>
            We don&rsquo;t have a recent weigh-in on file for you, so portions are shown at a
            standard reference weight (<span className="nutr-mono">{REFERENCE_MASS_KG} kg</span>)
            until your coach or medical staff log one.
          </>
        )}{' '}
        Reference only — nothing here is logged or tracked.
      </p>

      {mealLibrary.length === 0 ? (
        <p className="tiny" style={{ marginBottom: 4 }}>
          Your club hasn&rsquo;t added its own recipes to the library yet — these are the
          standard starting meal ideas everyone begins with.
        </p>
      ) : null}

      <div className="nutr-meal-grid">
        {scaledMeals.map((meal, i) => (
          <MealIdeaCard key={`${meal.name}-${i}`} meal={meal} />
        ))}
      </div>

      <p className="tiny" style={{ marginTop: 14 }}>
        Supplement use is your own decision and, in a tested sport, your own anti-doping
        responsibility. This is guidance, not a clinical or dietetic prescription.
      </p>
    </>
  );
}

function MealIdeaCard({ meal }: { meal: ScaledMeal }) {
  return (
    <div className="nutr-meal-card">
      <div className="nutr-meal-header">
        <span className="nutr-meal-name">{meal.name}</span>
        <span className="nutr-mono nutr-meal-time">{meal.time}</span>
      </div>
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
    </div>
  );
}
