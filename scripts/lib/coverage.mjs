/* Every guard asserts its own coverage — decision-batch-2026-09-15-pm.md
 * item 5 (Isabella): "Any guard that walks a list of files, roles, routes or
 * screens asserts the number it expected to find and fails loudly when the
 * count does not match. Eleven roles means eleven, or the run fails."
 *
 * Why: the accessibility sweep's reporter silently skipped three roles whose
 * filenames carried underscores and printed a clean report anyway — the
 * third check that could not tell "this passed" from "this never ran". A
 * guard that enumerates and finds nothing passes every assertion it never
 * made.
 *
 * Usage: `expectCount('routes with a skeleton', found.length, 5)`. The
 * expected number is written into the guard by hand, so adding a sixth
 * route fails the run until someone raises it — that is the point: the
 * number is a claim about the codebase, and the run checks the claim.
 *
 * COVERAGE_BOOTSTRAP=1 prints every count instead of failing, so a new
 * guard can be written against what is actually there, once, by a person
 * who then reads the numbers. */

export class CoverageError extends Error {}

/** The counts that guards walking a whole tree share — one place to raise
 *  when a file is added. A guard that walks a narrower list keeps its own
 *  number beside the walk. Every number is a claim about the repository as
 *  of the commit that last changed it; a mismatch is not a nuisance to be
 *  bumped past, it is the run asking what was added or lost. */
/* 15 Sept 2026, the mobile queue: +1 athlete page (me/profile) and +1
   component (NutritionTargetsCard) — twelve counts moved by one or two.
   Later that day, the staff phone items: +1 staff page (/print), +1 layout
   (reports/layout.tsx), +1 component (DesktopOnlyNotice), +1 lib
   (printableDoc.ts) — fourteen counts moved. Then the athlete zoom and
   docked-footer pass: +2 components (StandaloneViewport, AthleteFooterDock),
   +1 lib (viewportMeta.ts) — six counts. 16 Sept 2026, the overnight
   queue's athlete section: +2 components (TodoStatusCard, AthleteBoardTable),
   +2 lib (todayStatus.ts, gymWeeks.ts), −1 component (TodayGymRow, its row
   now a status card) — six counts. */
export const COUNTS = {
  /** supabase/migrations/*.sql */
  migrations: 133,
  /** supabase/tests/*.sql (pgTAP) */
  pgtapTests: 94,
  /** every file under src, of any kind */
  srcFiles: 557,
  /** .ts and .tsx under src */
  srcTs: 552,
  /** .tsx under src */
  srcTsx: 304,
  /** .css under src (src/styles) */
  srcCss: 2,
  /** page.tsx under src/app/(staff) */
  staffPages: 77,
  /** .tsx under src/app/(staff) */
  staffTsx: 97,
  /** route.ts / route.tsx under src/app/(staff) */
  staffRoutes: 44,
  /** .tsx under src/app/(athlete) */
  athleteTsx: 27,
  /** .tsx under src/components */
  componentTsx: 169,
  /** .ts and .tsx under src/components */
  componentTs: 175,
  /** .tsx under src/app */
  appTsx: 134,
  /** .ts and .tsx under src/app */
  appTs: 181,
  /** every file under src/app, of any kind */
  appFiles: 184,
  /** route.ts and .tsx under src/app */
  appRoutesAndTsx: 175,
  /** route.ts under src/app */
  appRoutes: 41,
  /** .ts and .tsx under src/lib */
  libTs: 195,
  /** page.tsx under src/app */
  appPages: 108,
  /** layout.tsx under src/app */
  appLayouts: 4,
  /** page.tsx under src/app/(athlete) */
  athletePages: 25,
};

const bootstrap = process.env.COVERAGE_BOOTSTRAP === '1';

/** Fail loudly unless `actual` is exactly `expected`. Returns `actual` so a
 *  call can sit inline: `for (const f of expectCount(…, files, 12))`. */
export function expectCount(label, actual, expected) {
  const n = typeof actual === 'number' ? actual : actual.length;
  if (bootstrap) {
    console.log(`  coverage - ${label}: found ${n} (guard expects ${expected})`);
    return actual;
  }
  if (n !== expected) {
    const msg = `coverage: expected ${expected} ${label}, found ${n} — the guard's own list is wrong, or something was added or removed; fix the number only once you know which`;
    console.log(`  FAIL - ${msg}`);
    throw new CoverageError(msg);
  }
  console.log(`  ok   - ${label}: ${n} of ${expected}`);
  return actual;
}
