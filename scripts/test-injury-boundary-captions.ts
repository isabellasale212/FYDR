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
/* `row` is in the alternation because TeamAllocationBoard renders these through a
   shared <InjuryLine row={a} /> component, so the field access reads `row.body_area`
   rather than `a.body_area`. Missing that read as "the board does not render it",
   which is the wrong-instrument mistake this file has already made twice. */
const renders = (src: string, field: string): boolean =>
  new RegExp(`\\b(?:member|row|m|a)\\.${field}\\b`).test(src);

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

/* THE GAP IS CLOSED, and this assertion is the record of it. It used to say the
   opposite — that rehabGroups.ts fetched `restrictions` while the board never
   drew them — because that WAS the state, and it was pinned so it could not be
   forgotten. Isabella decided on 2026-09-09 to render them, so the assertion
   flips: fetched AND drawn. The caption side is already covered by the FIELDS
   loop above; this covers the query-to-board leg, which is where the promise
   was being dropped. */
assert(exposes(rehabQ, 'restrictions') && renders(rehabBoard, 'restrictions'),
  'rehab-groups fetches restrictions AND the board draws them (28-rehab-groups.md always promised this)');

/* TEAM ALLOCATION NOW SHOWS THE SAME FOUR FIELDS, decided 2026-09-09. This block
   asserted the exact opposite until then — that the query exposed none of them,
   the board rendered none, and the caption claimed none — because that was the
   state and it was pinned so the caption could not drift from it again. The
   decision inverted it, and inverting it is what forces query, board and caption
   to move in one change: leave any one of the three behind and this fails.
   `phase` stays out. It is the rehab board's own instrument, not part of the
   limited injury view, and no other screen shows it. */
const teamShows = showsClause(teamCap);
const TEAM_FIELDS = FIELDS.filter(([f]) => f !== 'phase');

for (const [field, prose] of TEAM_FIELDS) {
  assert(exposes(teamQ, field), `teamAllocation.ts exposes ${field}`);
  assert(renders(teamBoard, field), `TeamAllocationBoard renders ${field}`);
  assert(prose.test(teamShows), `and the team-allocation caption names ${field}`);
}
assert(!exposes(teamQ, 'phase') && !renders(teamBoard, 'phase') && !/phase/i.test(teamShows),
  'phase stays out of team allocation — it is the rehab board\'s instrument, not the shared injury view');
assert(/availability/i.test(teamShows), 'and the caption still says availability');

/* BOTH ROW SHAPES, not just the component. Deleting <InjuryLine> from the
   unallocated row did NOT fail this file until this assertion existed: the
   `renders()` check finds `row.body_area` inside the InjuryLine definition, which
   survives when a call site is removed. So it proved the component existed, not
   that the board used it — the same "does it pin the board too" gap that caught
   the query-only version. The board has two row shapes, allocated and
   unallocated, and a coach reads both. A third shape appearing should fail this
   and be looked at. */
const injuryLineUses = (teamBoard.match(/<InjuryLine\b/g) ?? []).length;
assert(injuryLineUses === 2,
  `both team-allocation row shapes render the injury line (saw ${injuryLineUses} of 2)`);

/* The clinical boundary is the one thing neither decision touched. */
for (const [name, src] of [['teamAllocation.ts', teamQ], ['rehabGroups.ts', rehabQ]] as const) {
  assert(!/injury_clinical/.test(src.replace(/injury_clinical is not|not.*injury_clinical/g, '')),
    `${name} still never selects from injury_clinical`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
