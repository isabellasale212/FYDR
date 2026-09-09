/* The two injury boards' captions must describe what their own screen shows.
 *
 * WHAT WAS WRONG. Both boards printed a caption claiming "the same boundary as
 * every other screen", and then listed DIFFERENT fields:
 *
 *   rehab-groups     "Availability, restrictions, body area and phase only"
 *   team-allocation  "Availability, restrictions and body area only"
 *
 * Both cannot be the same boundary. Checking the queries rather than the prose:
 * rehabGroups.ts really does expose all four (availability, restrictions,
 * body_area, phase — and the board edits phase), so its list was right.
 * teamAllocation.ts exposes AVAILABILITY ONLY; its own header says so in terms,
 * "medical's own read access here is availability only". So team-allocation's
 * caption claimed two fields the screen never shows, and the shared "same
 * boundary" clause was false on both.
 *
 * WHY THIS IS NOT A COPY NIT. It over-claimed in the DISCLOSURE direction: it
 * told a coach that restrictions and body area were on that screen. Nothing
 * leaked — the data was never fetched — but a caption about the medical boundary
 * is exactly the text people have to be able to trust, and docs/screens/
 * 29-team-allocation.md sanctions no field list for it at all.
 *
 * SO THIS GUARD TIES THE CAPTION TO THE QUERY, not to a remembered sentence. If
 * someone adds body_area to teamAllocation.ts, the assertion that its caption
 * stays availability-only fails and forces the decision to be made deliberately.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/** The boundary caption: the `.cap` paragraph that carries the no-diagnosis promise. */
function caption(file: string): string {
  const src = blank(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/<p className="cap">([\s\S]*?)<\/p>/g)) {
    const t = (m[1] ?? '').replace(/&mdash;/g, '—').replace(/&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
    if (/No diagnosis/i.test(t)) return t;
  }
  return '';
}

const rehabCap = caption('src/app/(staff)/injuries/rehab-groups/page.tsx');
const teamCap = caption('src/app/(staff)/injuries/team-allocation/page.tsx');
assert(rehabCap.length > 0, 'rehab-groups still carries a boundary caption');
assert(teamCap.length > 0, 'team-allocation still carries a boundary caption');

/* The shared falsehood. The boundary is demonstrably NOT the same on both. */
for (const [name, cap] of [['rehab-groups', rehabCap], ['team-allocation', teamCap]] as const) {
  assert(!/same boundary as every other screen/i.test(cap),
    `${name} no longer claims "the same boundary as every other screen"`);
  assert(/no diagnosis/i.test(cap) && /clinical note/i.test(cap),
    `${name} still promises no diagnosis and no clinical notes`);
}

/* ---- caption against query, in both directions ---- */
const rehabQ = blank(readFileSync('src/lib/queries/rehabGroups.ts', 'utf8'));
const teamQ = blank(readFileSync('src/lib/queries/teamAllocation.ts', 'utf8'));

/* A field name appearing in the query's own exported row shapes. */
const exposes = (src: string, field: string): boolean =>
  new RegExp(`^\\s*${field}\\??:`, 'm').test(src);

/* THE CLAIM, NOT THE WORD. A caption that correctly says "No body area" contains
   the words "body area", so a bare substring test on the whole caption fails on
   copy that is right — the same trap as counting a tombstone comment as a live
   rule. The house pattern is "<what it shows> — <why>. No <what it does not>",
   so split at the denial and test the two halves for what each is claiming. */
const showsClause = (cap: string): string => cap.split(/\bNo\b/)[0] ?? cap;

/* ---- and against the BOARD, which is what a coach actually reads ----
   The query is the wrong sole authority: rehabGroups.ts returns `restrictions`
   and RehabGroupBoard never draws them, so a caption checked only against the
   query passed while promising a field nobody sees. FETCHED IS NOT SHOWN. Both
   sides are asserted now: a field may be named only if the board renders it, and
   a field the board renders must not be omitted. */
const board = (file: string): string => blank(readFileSync(file, 'utf8'));
const rehabBoard = board('src/components/RehabGroupBoard/RehabGroupBoard.tsx');
const teamBoard = board('src/components/TeamAllocationBoard/TeamAllocationBoard.tsx');
const renders = (src: string, field: string): boolean =>
  new RegExp(`\\b(?:member|m|a)\\.${field}\\b`).test(src);

/** Field name in code -> how the caption says it in prose. */
const FIELDS: readonly [string, RegExp][] = [
  ['restrictions', /restriction/i],
  ['body_area', /body area/i],
  ['side', /\bside\b/i],
  ['expected_return', /expected return/i],
  ['phase', /phase/i],
];

const rehabShows = showsClause(rehabCap);
for (const [field, prose] of FIELDS) {
  const drawn = renders(rehabBoard, field);
  const named = prose.test(rehabShows);
  assert(drawn === named,
    `rehab-groups: ${field} is ${drawn ? 'rendered' : 'not rendered'} by the board and ${named ? 'named' : 'not named'} in the caption`);
}
assert(/availability/i.test(rehabShows), 'and the rehab-groups caption says availability, which it shows');

/* THE KNOWN GAP, asserted so it stays visible instead of being quietly dropped
   when the query assertions moved to the board. rehabGroups.ts fetches
   `restrictions` and the board never draws them, while
   docs/screens/28-rehab-groups.md says the coach sees them. Filed as a display
   decision. If someone renders them, THIS fails — which is the point: the
   caption and the spec both need updating in the same change. */
assert(exposes(rehabQ, 'restrictions') && !renders(rehabBoard, 'restrictions'),
  'known gap holds: rehabGroups.ts fetches restrictions, the board does not draw them (28-rehab-groups.md says it should — filed)');

const teamShows = showsClause(teamCap);
for (const [field, prose] of FIELDS) {
  assert(!exposes(teamQ, field), `teamAllocation.ts does not expose ${field}`);
  assert(!renders(teamBoard, field), `TeamAllocationBoard does not render ${field}`);
  assert(!prose.test(teamShows), `and the team-allocation caption does not claim ${field}`);
}
assert(/availability/i.test(teamShows), 'and does say availability, which is what it shows');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
