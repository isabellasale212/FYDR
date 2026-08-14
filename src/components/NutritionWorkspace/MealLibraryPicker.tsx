'use client';

import type { LibraryMeal } from '@/lib/queries/mealLibrary';

type Props = {
  meals: LibraryMeal[];
  /** ids already showing in the current "day, as food" preview, so a meal already
   *  picked reads as picked rather than inviting a duplicate add. */
  addedIds: readonly string[];
  onAdd: (meal: LibraryMeal) => void;
  onClose: () => void;
};

/** "Food library": the org's saved meals (migration 0051's meal_library), picked into
 *  the currently displayed "day, as food" preview. Read-only against the library
 *  itself — creating one lives in NewMealForm.tsx's "+ Meal" — so this component only
 *  ever calls onAdd, never a mutation of its own, the same data-and-callbacks-in split
 *  SelectedAthleteCard and TargetsTable already use. */
export function MealLibraryPicker({ meals, addedIds, onAdd, onClose }: Props) {
  return (
    <div className="card" style={{ marginTop: 10, borderColor: 'var(--accent)' }}>
      <div className="nutr-card-head" style={{ marginBottom: meals.length === 0 ? 0 : 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Food library
        </div>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="tiny">No meals saved yet for this org. Use “+ Meal” to add the first one.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {meals.map((meal) => {
            const totals = meal.items.reduce(
              (acc, it) => ({
                proteinG: acc.proteinG + it.proteinG,
                carbG: acc.carbG + it.carbG,
                fatG: acc.fatG + it.fatG,
              }),
              { proteinG: 0, carbG: 0, fatG: 0 },
            );
            const added = addedIds.includes(meal.id);
            return (
              <div
                key={meal.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-field)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{meal.name}</div>
                  <div className="tiny nutr-mono">
                    {meal.timeLabel} · {meal.items.length} item{meal.items.length === 1 ? '' : 's'} ·{' '}
                    {Math.round(totals.proteinG)}P / {Math.round(totals.carbG)}C / {Math.round(totals.fatG)}F g at
                    reference mass
                  </div>
                </div>
                <button type="button" className="btn-ghost" disabled={added} onClick={() => onAdd(meal)}>
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
