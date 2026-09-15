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

const bootstrap = process.env.COVERAGE_BOOTSTRAP === '1';

/** Fail loudly unless `actual` is exactly `expected`. Returns `actual` so a
 *  call can sit inline: `for (const f of expectCount(…, files, 12))`. */
export function expectCount<T extends number | readonly unknown[]>(label: string, actual: T, expected: number): T {
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
