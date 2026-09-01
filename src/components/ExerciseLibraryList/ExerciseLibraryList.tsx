'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
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
 *  documented gap: this component only ever lists and links out to add.
 *
 *  WHY THIS OWNS THE PAGE HEADER AND NOT JUST THE LIST. The design puts the
 *  search field in the top bar beside the title, the category control and the
 *  per-category counts on their own row beneath it, and the filtered/total
 *  count in the list card's footer. Those four are one piece of state, and
 *  `page.tsx` is an async server component that cannot hold it, so the whole
 *  workspace from the top bar down is rendered here and the add-an-exercise
 *  card arrives as `aside` — a server-composed node dropped into the grid's
 *  right column. The export keeps its original name because that is what the
 *  page imports; it is the library screen's body, not only its list.
 *
 *  The Back button is NOT rendered here. `(staff)/layout.tsx` renders one
 *  `<BackButton />` above `{children}` for every staff screen, which is the
 *  house pattern (`.back-btn` in base.css: "sits above the page's own header
 *  rather than inside it, so no page has to make room for it and every one
 *  places it identically"). The design draws it inside the top bar to the
 *  right of the search field; moving it there is a change to the shared
 *  layout, not to this screen.
 *
 *  The row chevron is decorative and marked aria-hidden. There is no
 *  `/programmes/exercises/[id]` route to open — the detail view is the other
 *  half of audit finding 33 and is still unbuilt — so the row is not a link
 *  and nothing here claims it is.
 */
export function ExerciseLibraryList({
  exercises,
  orgName,
  aside,
}: {
  exercises: readonly Exercise[];
  orgName: string;
  aside: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');

  /** Every category's count, including the zeroes — the picker lists all ten
   *  so its options do not move about as a library fills up. */
  const counts = useMemo(() => {
    const map = new Map<ExerciseCategory, number>(CATEGORIES.map((c) => [c, 0]));
    for (const ex of exercises) map.set(ex.category, (map.get(ex.category) ?? 0) + 1);
    return map;
  }, [exercises]);

  /** The counts line beneath the picker names only the categories that
   *  actually have something in them. A club that never programmes a carry
   *  should not read "Carry 0" every time it opens the library. */
  const populated = useMemo(() => CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0), [counts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (category !== 'all' && ex.category !== category) return false;
      if (q && !ex.name.toLowerCase().includes(q) && !(ex.primary_muscle ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, category]);

  const selectedLabel = category === 'all' ? 'All categories' : enumLabel(category);
  const selectedCount = category === 'all' ? exercises.length : counts.get(category) ?? 0;

  return (
    <>
      <div className="topbar exlib-topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> · Exercise library
          </p>
          <h1>Exercise library</h1>
          <p className="exlib-sub">
            Squad · {orgName} · <span className="exlib-num">{exercises.length}</span> exercises across{' '}
            <span className="exlib-num">{populated.length}</span> categories
          </p>
        </div>
        <div className="exlib-tools">
          <div className="exlib-search">
            <svg
              className="exlib-search-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.25" />
              <path d="m10.3 10.3 3 3" strokeLinecap="round" />
            </svg>
            <input
              className="exlib-search-input"
              type="search"
              placeholder="Search exercises"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search exercises"
            />
          </div>
        </div>
      </div>

      <div className="exlib-catbar">
        {/* A native select carries the behaviour and the accessibility; it is
            laid transparently over the drawn control so the label, the count
            and the chevron can sit where the design puts them, which a styled
            <select> cannot do on its own. */}
        <div className="exlib-cat">
          <span className="exlib-cat-label">{selectedLabel}</span>
          <span className="exlib-cat-count exlib-num">{selectedCount}</span>
          <span className="exlib-cat-chev" aria-hidden="true">
            ▾
          </span>
          <select
            className="exlib-cat-select"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExerciseCategory | 'all')}
            aria-label="Filter by category"
          >
            <option value="all">All categories ({exercises.length})</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {enumLabel(c)} ({counts.get(c) ?? 0})
              </option>
            ))}
          </select>
        </div>
        {populated.length > 0 ? (
          <p className="exlib-counts">
            {populated.map((c, index) => (
              <span key={c}>
                {index > 0 ? ' · ' : ''}
                {enumLabel(c)} <span className="exlib-num">{counts.get(c) ?? 0}</span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="exlib-body">
        <div className="card exlib-list">
          <div className="exlib-head">
            <span className="exlib-col">Exercise</span>
            <span className="exlib-col">Category</span>
            <span />
          </div>

          {filtered.length === 0 ? (
            <p className="exlib-empty">
              {exercises.length === 0
                ? 'No exercises yet. Add the first one.'
                : query.trim()
                  ? `No exercises match “${query}”.`
                  : 'No exercises in this category yet.'}
            </p>
          ) : (
            <div className="exlib-rows">
              {filtered.map((ex) => (
                <div className="exlib-row" key={ex.id}>
                  <div className="exlib-row-main">
                    <div className="exlib-row-name">{ex.name}</div>
                    {ex.cues ? <div className="exlib-row-cue">{ex.cues}</div> : null}
                  </div>
                  <span className="exlib-pill">{enumLabel(ex.category)}</span>
                  <span className="exlib-chev" aria-hidden="true">
                    ›
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="exlib-foot">
            <span className="exlib-num">{filtered.length}</span> of <span className="exlib-num">{exercises.length}</span>{' '}
            shown.
          </p>
        </div>

        {aside}
      </div>
    </>
  );
}
