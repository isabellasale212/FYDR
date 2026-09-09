'use client';

import { useState } from 'react';
import type { MealUnit } from '@/lib/nutritionMeals';
import type { NewLibraryMealInput } from '@/lib/queries/mealLibrary';

const UNITS: MealUnit[] = ['g', 'ml', 'ea'];

type ItemDraft = {
  key: number;
  name: string;
  qty: string;
  unit: MealUnit;
  proteinG: string;
  carbG: string;
  fatG: string;
};

function emptyItem(key: number): ItemDraft {
  return { key, name: '', qty: '', unit: 'g', proteinG: '', carbG: '', fatG: '' };
}

type Props = {
  onSubmit: (input: NewLibraryMealInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  /** Server-side error from the parent's mutation (RLS refusal, a dropped connection).
   *  Local validation errors are held separately, below, so a coach still fixing a typo
   *  never sees a stale server message. */
  error: string | null;
};

/** "+ Meal": name, a time-of-day label, and one or more items (name/qty/unit/protein/
 *  carb/fat). Saves through createLibraryMeal (lib/queries/mealLibrary.ts) into the
 *  org's real meal_library — see migration 0051's own header. Purely a controlled form:
 *  the actual mutation, and adding the result to the current day's preview, live in
 *  NutritionWorkspace.tsx, the same split SelectedAthleteCard and TargetsTable already
 *  use (data and callbacks in, presentation out). */
export function NewMealForm({ onSubmit, onCancel, isSubmitting, error }: Props) {
  const [name, setName] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([emptyItem(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);

  function updateItem(key: number, patch: Partial<ItemDraft>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addItem() {
    setItems((rows) => [...rows, emptyItem(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function removeItem(key: number) {
    setItems((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError('Give the meal a name.');
      return;
    }
    if (!timeLabel.trim()) {
      setLocalError('Give the meal a time-of-day label, e.g. 07:00.');
      return;
    }
    // A row left entirely blank (never touched after "Add item") is dropped rather than
    // forcing every added row to be filled in or deleted again.
    const touched = items.filter((r) => r.name.trim() || r.qty.trim());
    if (touched.length === 0) {
      setLocalError('Add at least one item.');
      return;
    }
    const parsed: NewLibraryMealInput['items'] = [];
    for (const row of touched) {
      const qty = Number(row.qty);
      if (!row.name.trim() || !Number.isFinite(qty) || qty <= 0) {
        setLocalError(`"${row.name.trim() || 'that item'}" needs a name and a quantity greater than zero.`);
        return;
      }
      parsed.push({
        name: row.name.trim(),
        qty,
        unit: row.unit,
        proteinG: numberOr(row.proteinG, 0),
        carbG: numberOr(row.carbG, 0),
        fatG: numberOr(row.fatG, 0),
      });
    }
    setLocalError(null);
    onSubmit({ name: name.trim(), timeLabel: timeLabel.trim(), items: parsed });
  }

  return (
    <form onSubmit={onFormSubmit} className="card" style={{ marginTop: 'var(--sp-10)', borderColor: 'var(--accent)' }}>
      <div className="stack" style={{ gap: 'var(--sp-10)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
          <label style={{ flex: 2 }}>
            <span className="label">Meal name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pre-match carb load" autoFocus />
          </label>
          <label style={{ flex: 1 }}>
            <span className="label">Time label</span>
            <input className="field" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="07:00" />
          </label>
        </div>

        <p className="tiny">
          Quantities and macros below, like the five reference meals already on this screen, are entered at
          a 110 kg reference athlete and scale down or up automatically for whichever athlete is selected.
        </p>

        <div className="stack" style={{ gap: 'var(--sp-8)' }}>
          {items.map((row, i) => (
            <div key={row.key} style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-end' }}>
              <label style={{ flex: 2 }}>
                {i === 0 ? <span className="label">Item</span> : null}
                <input
                  className="field"
                  value={row.name}
                  onChange={(e) => updateItem(row.key, { name: e.target.value })}
                  placeholder="Porridge oats"
                />
              </label>
              <label style={{ flex: 1 }}>
                {i === 0 ? <span className="label">Qty</span> : null}
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.qty}
                  onChange={(e) => updateItem(row.key, { qty: e.target.value })}
                  placeholder="120"
                />
              </label>
              <label style={{ flex: 1 }}>
                {i === 0 ? <span className="label">Unit</span> : null}
                <select className="field" value={row.unit} onChange={(e) => updateItem(row.key, { unit: e.target.value as MealUnit })}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                {i === 0 ? <span className="label">Protein g</span> : null}
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.proteinG}
                  onChange={(e) => updateItem(row.key, { proteinG: e.target.value })}
                  placeholder="0"
                />
              </label>
              <label style={{ flex: 1 }}>
                {i === 0 ? <span className="label">Carb g</span> : null}
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.carbG}
                  onChange={(e) => updateItem(row.key, { carbG: e.target.value })}
                  placeholder="0"
                />
              </label>
              <label style={{ flex: 1 }}>
                {i === 0 ? <span className="label">Fat g</span> : null}
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.fatG}
                  onChange={(e) => updateItem(row.key, { fatG: e.target.value })}
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => removeItem(row.key)}
                disabled={items.length <= 1}
                /* aria-label, not just title. Accessible-name computation puts
                   CONTENT above title, so a bare × announced this control as
                   "times, button" — the tooltip was never its name. */
                aria-label="Remove item"
                title="Remove item"
                style={{ minHeight: 44 }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={addItem} style={{ alignSelf: 'flex-start' }}>
            + Add item
          </button>
        </div>

        {localError || error ? (
          <p className="form-error" role="alert">
            {localError ?? error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--sp-10)' }}>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save to library'}
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function numberOr(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
