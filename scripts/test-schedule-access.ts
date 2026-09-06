/* The Schedule area's write gate — G-34 class.
 *
 * WHAT WAS WRONG. /schedule had no role check anywhere. ScheduleWorkspace took
 * no canEdit prop and `mode` was pure client state defaulting to 'read', so a
 * medic, a nutritionist or an S&C got the Edit toggle, + Session, + Fixture,
 * Apply template, Save this week as a template and Publish to athletes. G-33
 * decided the opposite — "Medic loses scheduling, including week templates" —
 * and 0070/0073 enforce it, so every one of those controls led to a refusal the
 * person could not have predicted from the screen.
 *
 * WHY BOTH HALVES. supabase/tests/410 asserts the database refuses them. This
 * asserts the screen does not OFFER it. Either alone is insufficient: a policy
 * without a matching UI is the loud version of the same bug, and G-34's six
 * screens were fixed in two independent halves for exactly this reason.
 *
 * THE SHAPE OF THE REFUSAL MATTERS HERE, which is why the UI half is not
 * optional. sessions_staff_insert gates in WITH CHECK, so a refused create
 * RAISES. sessions_staff_update gates in USING, so a refused edit raises
 * NOTHING and changes no rows — the screen would report a saved rename that
 * never happened. See 410 §2.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const read = (p: string) => readFileSync(p, 'utf8');

const page = read('src/app/(staff)/schedule/page.tsx');
const pageCode = strip(page);
const ws = read('src/components/ScheduleGrid/ScheduleWorkspace.tsx');
const wsCode = strip(ws);

console.log('the page resolves the gate from lib/access.ts and hands it down');
assert(/SESSION_EDIT/.test(page), 'schedule/page.tsx imports SESSION_EDIT');
assert(
  /const canEdit = hasAnyRole\(claims\.roles, SESSION_EDIT\)/.test(pageCode),
  'and resolves canEdit from it rather than a role literal',
);
assert(/canEdit=\{canEdit\}/.test(pageCode), 'and passes it to ScheduleWorkspace');

console.log('\nthe workspace offers no write control without it');
assert(/canEdit: boolean/.test(ws), 'ScheduleWorkspace declares canEdit');
for (const [needle, what] of [
  ['sg-segmented', 'the Read/Edit toggle'],
  ["mode === 'edit' ?", 'the edit toolbar'],
  ['sg-btn-publish', 'Publish to athletes'],
] as const) {
  const at = wsCode.indexOf(needle);
  assert(at > -1, `${what} is still in the component`);
  /* Each must sit inside a canEdit branch. Checked by finding the nearest
     preceding `canEdit ?` — structural rather than proximity to prose, which
     has produced false passes in this project before. */
  const before = wsCode.slice(0, at);
  assert(/canEdit\s*(\?|&&)/.test(before.slice(-2000)), `${what} renders only when canEdit`);
}

console.log('\nthe create chips are gated, all three of them');
{
  const chipRowAt = wsCode.indexOf('className="chiprow"');
  const bannerAt = wsCode.indexOf('sg-banner');
  const row = wsCode.slice(chipRowAt, bannerAt);
  /* The guard opens BEFORE the row's own div, so look just above it. */
  assert(
    /canEdit\s*(\?|&&)/.test(wsCode.slice(Math.max(0, chipRowAt - 200), chipRowAt)),
    'the chiprow is behind canEdit',
  );
  for (const chip of ['/schedule/new', '/schedule/fixtures/new', '/schedule/planner']) {
    assert(row.includes(chip), `${chip} is inside that gated row`);
  }
}

console.log('\nclicking the grid cannot start a draft without it');
{
  const fn = wsCode.slice(wsCode.indexOf('function startDraft'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert(/if \(!canEdit\) return;/.test(body),
    'startDraft returns early — the grid click is inert, not merely invisible');
}

console.log('\nthe pure-create routes refuse outright');
for (const route of [
  'src/app/(staff)/schedule/new/page.tsx',
  'src/app/(staff)/schedule/fixtures/new/page.tsx',
  'src/app/(staff)/schedule/planner/apply/page.tsx',
  /* The template LIST too, not only the create button on it. G-33 is explicit
     that the medic loses week templates, and leaving the page readable by typed
     URL while hiding the link is the "hidden button is not a gate" mistake. */
  'src/app/(staff)/schedule/planner/page.tsx',
]) {
  const src = read(route);
  assert(/SESSION_EDIT/.test(src), `${route.split('/').slice(-2).join('/')} imports SESSION_EDIT`);
  /* Either spelling is fine — the inline check, or a named boolean already
     resolved from SESSION_EDIT on the line above. What matters is that a viewer
     without it is sent away, not that the guard is written one particular way. */
  assert(
    /if \(!(hasAnyRole\(claims\.roles, SESSION_EDIT\)|canWrite|canEdit)\) redirect\(/.test(strip(src)),
    `  and redirects when the viewer does not hold it`,
  );
}

console.log('\nthe fixture detail page stays READABLE, and gates only its controls');
{
  const src = read('src/app/(staff)/schedule/fixtures/[fixtureId]/page.tsx');
  const code = strip(src);
  assert(/SESSION_EDIT/.test(src), 'it imports SESSION_EDIT');
  assert(
    !/if \(!hasAnyRole\(claims\.roles, SESSION_EDIT\)\) redirect\(/.test(code),
    'but does NOT redirect — a match in the calendar is information every staff role may read',
  );
  for (const control of ['FixtureEditForm', 'FixtureActions']) {
    const at = code.indexOf(`<${control}`);
    assert(at > -1, `${control} is still rendered`);
    assert(/canEdit\s*(\?|&&)/.test(code.slice(0, at).slice(-1200)), `  ${control} only when canEdit`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
