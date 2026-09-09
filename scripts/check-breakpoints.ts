/* Every responsive boundary is declared once, in one direction, on purpose.
 *
 * WHY THIS IS A GUARD AND NOT A TOKEN FAMILY. CSS custom properties do not work
 * in media queries — `@media (max-width: var(--bp-md))` is invalid and silently
 * matches nothing. So unlike the type scale and the spacing ramp, a breakpoint
 * cannot be centralised in tokens.css at all. A guard is not the second-best
 * mechanism here; it is the only one.
 *
 * WHAT AN AUDIT GOT WRONG ABOUT THIS, and the correction is the reason the list
 * below is shaped by surface rather than by value. The audit counted 13 distinct
 * breakpoints and called it sprawl of the kind --r-control fixed, where 14 radii
 * were one decision made fourteen times. Reading what they DO says otherwise:
 * 1100 collapses .pp-grid, 1150 collapses .nutr-layout, 1200 collapses
 * .dash-body. Three different grids running out of room at three different
 * widths, because a nutrition rail and a 12-column dashboard genuinely stop
 * fitting at different sizes. Snapping those onto a shared scale would break
 * three layouts to satisfy a tidiness impulse.
 *
 * So this does not enforce a scale. It enforces that each boundary is a NAMED
 * decision, that no boundary is expressed twice, and that no width is used in
 * both directions.
 *
 * THE TWO REAL DEFECTS IT WAS WRITTEN FOR. 1000 and 1080 were each used as both
 * a max-width and a min-width, so at exactly 1000px (and 1080px) two
 * mutually-exclusive layouts both applied and source order decided which won.
 * The file's own correct convention is elsewhere: max-width 1023 pairs with
 * min-width 1024, max-width 767 with min-width 768 — max is always N-1.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

/** Every permitted width, with the surface it belongs to and what changes there.
 *  A new boundary means a line here, which is the point: the reason has to be
 *  written down before the build will accept it. */
export const BOUNDARIES: ReadonlyArray<{ px: number; dir: 'min' | 'max'; why: string }> = [
  /* The spec's named tiers, 06-design-system.md §10.2 webBreakpoints. */
  { px: 768, dir: 'min', why: 'spec md — the staff sidebar collapses to icons at and above this' },
  { px: 767, dir: 'max', why: 'spec md, other side — phone layout below it' },
  { px: 1023, dir: 'max', why: 'spec lg, other side — below the smallest true dashboard' },
  { px: 640, dir: 'max', why: 'spec sm — below a supported dashboard size entirely' },
  /* Per-surface collapse points. Each is one grid running out of room, named
     with the grid, so nobody merges them into a single "desktop" number. */
  { px: 1200, dir: 'max', why: '.dash-body — the dashboard timeline/rail split collapses' },
  { px: 1150, dir: 'max', why: '.nutr-layout — the nutrition workspace rail moves below' },
  { px: 1100, dir: 'max', why: '.pp-grid — the athlete profile two-column grid collapses' },
  { px: 1080, dir: 'min', why: 'the launch claim column appears; below it the sign-in form is the whole screen' },
  { px: 1079, dir: 'max', why: 'launch, other side — the claim column is display:none below this width' },
  { px: 1000, dir: 'min', why: 'schedule and report widths that need a true desktop' },
  { px: 999, dir: 'max', why: 'the same boundary, other side' },
  { px: 900, dir: 'max', why: 'the widest per-surface collapse group — tables and boards drop a column' },
  { px: 800, dir: 'max', why: 'narrow-tablet adjustments above the phone tier' },
  { px: 700, dir: 'max', why: 'large-phone tier, below which grids go single-column' },
  { px: 560, dir: 'max', why: 'small-phone tier — the tightest layout the app draws' },
];

const css = readFileSync('src/styles/base.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
const used = new Map<string, number>();
for (const q of css.matchAll(/@media([^{]+)\{/g)) {
  for (const f of q[1]!.matchAll(/(max|min)-width:\s*([0-9.]+)px/g)) {
    const key = `${f[1]}:${f[2]}`;
    used.set(key, (used.get(key) ?? 0) + 1);
  }
}

console.log('every boundary in base.css is a declared decision');
{
  const allowed = new Set(BOUNDARIES.map((b) => `${b.dir}:${b.px}`));
  const undeclared = [...used.keys()].filter((k) => !allowed.has(k));
  assert(undeclared.length === 0, undeclared.length === 0
    ? `all ${used.size} boundary/direction pairs are in BOUNDARIES`
    : `undeclared: ${undeclared.join(', ')} — add each to BOUNDARIES with the surface it serves and why`);
}

console.log('\nno width is used in both directions');
{
  /* A max-width:N and a min-width:N both match at exactly N, so both rule sets
     apply at that one width and source order decides. Correct pairing is
     max N-1 / min N, which this file already does at 767/768 and 1023/1024. */
  const mins = new Set([...used.keys()].filter((k) => k.startsWith('min:')).map((k) => k.slice(4)));
  const maxes = new Set([...used.keys()].filter((k) => k.startsWith('max:')).map((k) => k.slice(4)));
  const both = [...mins].filter((v) => maxes.has(v));
  assert(both.length === 0, both.length === 0
    ? 'no value appears as both a min-width and a max-width'
    : `${both.join(', ')} used in both directions — at exactly that width two layouts both apply. Pair max N-1 with min N.`);
}

console.log('\nno two boundaries sit within 8px of each other');
{
  /* Two boundaries a handful of pixels apart are the same intent written twice.
     max-width 760 and max-width 767 were exactly this — a 7px band in which the
     schedule popover became a bottom sheet slightly before the phone tier
     started. Normalise max N to the boundary N+1 to compare directions fairly. */
  const boundaries = [...new Set([...used.keys()].map((k) => {
    const [dir, v] = k.split(':') as [string, string];
    return dir === 'max' ? Number(v) + 1 : Number(v);
  }))].sort((a, b) => a - b);
  const tooClose: string[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    if (boundaries[i]! - boundaries[i - 1]! <= 8) tooClose.push(`${boundaries[i - 1]}/${boundaries[i]}`);
  }
  assert(tooClose.length === 0, tooClose.length === 0
    ? `${boundaries.length} boundaries, none within 8px of another`
    : `near-duplicates: ${tooClose.join(', ')} — same intent expressed twice`);
}

console.log('\nBOUNDARIES stays honest about itself');
{
  const declared = new Set(BOUNDARIES.map((b) => `${b.dir}:${b.px}`));
  const unused = [...declared].filter((k) => !used.has(k));
  assert(unused.length === 0, unused.length === 0
    ? 'every declared boundary is actually used — the list describes the code'
    : `declared but unused: ${unused.join(', ')} — remove them, or the list stops being a description`);
  assert(
    BOUNDARIES.every((b) => b.why.trim().length > 20),
    'and every entry says what changes there, not just that it exists',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
