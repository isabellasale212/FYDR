'use client';

import { useMemo, useState } from 'react';
import type { Exercise } from '@/lib/queries/programmes';
import type { ExerciseCategory } from '@/lib/types/database';
import { enumLabel } from '@/lib/format';

const CATEGORIES: ExerciseCategory[] = [
  'squat',
  'hinge',
  'push',
  'pull',
  'carry',
  'olympic',
  'plyo',
  'core',
  'mobility',
  'conditioning',
];

/** Audit finding 33: "exercise library: no search/filter/edit/detail". Search
 *  and a category filter, client-side — the library is at most a few hundred
 *  rows for one club, well within "filter what's already on the page"
 *  territory, no new query needed. Edit and a detail view are still a real,
 *  documented gap: this component only ever lists and links out to add. */
export function ExerciseLibraryList({ exercises }: { exercises: readonly Exercise[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (category !== 'all' && ex.category !== category) return false;
      if (q && !ex.name.toLowerCase().includes(q) && !(ex.primary_muscle ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, category]);

  return (
    <div className="card flush">
      <div style={{ display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid var(--border)' }}>
        <input
          className="field"
          style={{ flex: 1 }}
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search exercises"
        />
        <select
          className="field"
          style={{ maxWidth: 160 }}
          value={category}
          onChange={(e) => setCategory(e.target.value as ExerciseCategory | 'all')}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {enumLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="tiny" style={{ padding: 16 }}>
          {exercises.length === 0 ? 'No exercises yet. Add the first one.' : `No exercises match “${query}”.`}
        </p>
      ) : (
        filtered.map((ex, index) => (
          <div key={ex.id}>
            {index > 0 ? <div className="hair" /> : null}
            <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <div>
                <span className="nm">{ex.name}</span>
                <div className="tiny">
                  {enumLabel(ex.category)}
                  {ex.primary_muscle ? ` · ${ex.primary_muscle}` : ''}
                </div>
              </div>
              {ex.one_rm_test_definition_id ? <span className="pill pill-accent">1RM linked</span> : <span />}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
