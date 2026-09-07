/* Fixtures render as blocks on the schedule grid.
 *
 * WHAT WAS WRONG. The grid drew sessions and nothing else, so a match existed
 * on the schedule only as eyebrow text above the calendar — you could read that
 * Saturday was matchday and not see when kick-off was. Three separate pieces of
 * the grid were already built for fixtures and all three were dead:
 *
 *   - the legend lists a red "Fixture" swatch, for a category never drawn;
 *   - .sg-day-head[data-match='true'] paints a matchday header red, and its
 *     isMatch was `daySessions.some(s => s.type === 'match')` — sessions only,
 *     never the fixtures table, so it had never once fired;
 *   - session_type 'match' has a full red treatment in TYPE_STYLE.
 *
 * THE SHAPE OF THE PROBLEM. A fixture has a kick-off and no duration, and the
 * grid's vertical axis means duration. Every design question here comes from
 * that one fact, and the answers are asserted below rather than described:
 * fixed height, solid top edge on the kick-off, dashed bottom edge, and enough
 * room reserved in the hour range that the block is never clipped.
 *
 * TWO REPRESENTATIONS, ONE MATCH. `sessions.fixture_id` exists, and the seeded
 * 'Fixture' sessions are type 'match'. If a fixture ever gains a linked match
 * session, the fixture must stop drawing its own block or the same match
 * appears twice in the same red. That rule is asserted with a positive control
 * so a passing test cannot mean "nothing was drawn at all".
 */
import { readFileSync } from 'node:fs';
import {
  FIXTURE_BLOCK_H,
  FIXTURE_NOMINAL_MINS,
  PXH,
  computeHourRange,
  fixtureTop,
  fixturesToDraw,
} from '@/lib/scheduleGeometry';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const flat = (s: string): string => strip(s).replace(/\s+/g, ' ');

const GEOM = 'src/lib/scheduleGeometry.ts';
const GRID = 'src/components/ScheduleGrid/TimeGrid.tsx';
const WORK = 'src/components/ScheduleGrid/ScheduleWorkspace.tsx';
const PAGE = 'src/app/(staff)/schedule/page.tsx';
const CSS = 'src/styles/base.css';

console.log('the block is a fixed size, because there is no duration to scale');
{
  assert(FIXTURE_BLOCK_H > 0, 'there is a fixed height');
  assert(
    !/FIXTURE_BLOCK_H\s*=[^;]*mins/.test(strip(read(GEOM))),
    'and it is not computed from any duration',
  );
  assert(
    !/blockHeight\([^)]*fixture/i.test(strip(read(WORK)) + strip(read(GRID))),
    'blockHeight() — whose whole job is minutes-to-pixels — is never called for a fixture',
  );
}

console.log('\nthe top edge lands exactly on the kick-off');
{
  assert(fixtureTop(20.5, 7) === (20.5 - 7) * PXH, '20:30 on a grid starting at 07:00 is 13.5 hours down');
  assert(fixtureTop(20.5, 7) === 891, 'which is 891px at this grid scale');
  assert(fixtureTop(7, 7) === 0, 'a kick-off on the first hour line sits at the very top');
  assert(fixtureTop(14, 7) < fixtureTop(20.5, 7), 'and later kick-offs sit lower, which is the only ordering claim worth making');
}

console.log('\nthe hour range reserves room, so a late kick-off is never clipped');
{
  assert(
    (FIXTURE_NOMINAL_MINS / 60) * PXH >= FIXTURE_BLOCK_H,
    'the nominal duration covers at least the height actually drawn',
  );
  const late = computeHourRange([{ start: 20.5, mins: FIXTURE_NOMINAL_MINS }]);
  assert(late.h1 > 21, `a 20:30 kick-off pushes the grid past the 21:00 default (h1=${late.h1})`);
  assert(
    fixtureTop(20.5, late.h0) + FIXTURE_BLOCK_H <= (late.h1 - late.h0) * PXH,
    'and the whole block fits inside the grid it produced',
  );
  const none = computeHourRange([]);
  assert(none.h0 === 7 && none.h1 === 21, 'a week with nothing in it still gets the plain 07:00–21:00 default');
}

console.log('\na fixture already represented by a match session does not draw twice');
{
  const fx = [{ id: 'fx-1' }, { id: 'fx-2' }];
  assert(fixturesToDraw(fx, []).length === 2, 'positive control: with no sessions at all, both fixtures draw');
  assert(
    fixturesToDraw(fx, [{ type: 'match', fixtureId: 'fx-1' }]).map((f) => f.id).join() === 'fx-2',
    'a match session carrying the id suppresses that fixture and only that one',
  );
  assert(
    fixturesToDraw(fx, [{ type: 'training', fixtureId: 'fx-1' }]).length === 2,
    'a NON-match session carrying the id suppresses nothing — it does not represent the match',
  );
  assert(
    fixturesToDraw(fx, [{ type: 'match', fixtureId: null }]).length === 2,
    'and an unlinked match session suppresses nothing, which is every seeded one on scratch',
  );
  assert(
    fixturesToDraw(fx, [{ type: 'match', fixtureId: 'fx-9' }]).length === 2,
    'a match session for a different fixture is not a reason to hide either of these',
  );
}

console.log('\nthe day header finally lights up for a fixture');
{
  const w = flat(read(WORK));
  assert(
    !/isMatch:\s*daySessions\.some\(\(s\) => s\.type === 'match'\)\s*,/.test(w),
    "isMatch is no longer sessions-only — that predicate had never fired, because a fixture writes no session",
  );
  /* Asserted as a chain rather than a single regex: the day column calls a
     helper, and the helper is where fixtures enter. Matching only the call site
     would pass on a helper that ignored them. */
  assert(/isMatch: isMatchDay\(/.test(w), 'the day column asks a named helper rather than inlining the rule twice');
  const helper = (/const isMatchDay =([^;]*);/.exec(w) ?? [])[1] ?? '';
  assert(
    /fixtureDays/.test(helper),
    `and that helper consults the week's fixtures (saw: ${helper.trim() || 'nothing'})`,
  );
  assert(
    /type === 'match'/.test(helper),
    'while still counting a match session, which is the only evidence left once its fixture is suppressed',
  );
  assert(
    /data-match=/.test(flat(read(GRID))),
    'the header attribute the CSS already styles is still what gets set',
  );
}

console.log('\nthe fixture is a link out, not a block you can edit in place');
{
  const g = flat(read(GRID));
  assert(/\/schedule\/fixtures\/\$\{/.test(g), 'it links to the fixture record');
  assert(/sg-fixture/.test(g), 'and carries its own class rather than borrowing .sg-block');
  /* Sliced only when the marker exists. Without this guard indexOf(-1) makes
     the slice empty and both negative assertions pass on a feature that was
     never built — which is how they read on the first run of this file. */
  const at = g.indexOf('sg-fixture');
  const seg = at === -1 ? null : g.slice(at, at + 700);
  assert(seg !== null && !/onMouseDown|draggable|onDragStart/.test(seg), 'it is not draggable — fixtures are not part of the staging model');
  assert(seg !== null && !/onClick=\{\(\) => (select|setSel)/.test(seg), 'and clicking it does not open the session panel, which is session-shaped');
}

console.log('\nthe drawing says "no end time" rather than implying one');
{
  const css = read(CSS);
  const i = css.indexOf('.sg-fixture');
  assert(i !== -1, '.sg-fixture is styled in base.css');
  const block = css.slice(i, i + 900);
  assert(/border-top:\s*3px solid/.test(block), 'a solid top edge, heavier than a session border, sits on the kick-off');
  assert(/dashed/.test(block), 'and the bottom edge is dashed, where a session would be solid');
  assert(
    i !== -1 && !/#[0-9a-fA-F]{3,6}/.test(block),
    'every colour is a token — base.css’s own rule, and the reason the blue re-ground did not break this',
  );
  assert(/var\(--bad/.test(block), 'and it is the match red the legend swatch already advertises');
}

console.log('\nthe fixture id reaches the grid at all');
{
  const q = flat(read('src/lib/queries/schedule.ts'));
  assert(/WeekFixture = \{[^}]*id: string/.test(q), 'WeekFixture carries an id');
  const fn = q.slice(q.indexOf('export async function fetchWeekFixtures'));
  assert(/\.select\('id,/.test(fn.slice(0, 600)), 'and the query actually selects it');
  assert(/fixtures=\{/.test(flat(read(PAGE))), 'the page passes the week’s fixtures into the workspace');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
