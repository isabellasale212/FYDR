/* "There is no visible prompt or confirmation about republishing before it
 * reaches the athlete app."
 *
 * WHAT THE BEHAVIOUR ACTUALLY IS, established before writing a word of copy:
 * there is no publish step for the schedule at all. `session_status` is
 * planned/completed/cancelled — a lifecycle, not a gate — and the only SELECT
 * policy on `sessions` is `org_id = auth_org_id()`. The athlete's own query
 * narrows by date window, `deleted_at is null`, and participation, and by
 * nothing else. A session is in the athlete app the instant the row exists.
 *
 * WHY ANYBODY WOULD THINK OTHERWISE. Fydr does have real draft/published
 * gates, on team allocation and on leaderboards, where "publish" means
 * disclose-to-athletes and withholding is the point. The schedule grid then
 * borrows the same word for something different: its Publish button flushes
 * edits staged in the browser to the database. Both are honest on their own
 * screen and the collision is only visible if you use both, which is exactly
 * what happened. So the fix is not to rename anything — it is that the four
 * surfaces which write a session or fixture DIRECTLY, with no staging, said
 * nothing at all about the athlete app.
 *
 * FIXTURES ARE THE ONE THAT IS NOT LIKE THE OTHERS, and my first answer here
 * was wrong. Grepping src/app/(athlete) for `from('fixtures')` found nothing
 * and I concluded a fixture reaches nobody. It reaches everybody: the query
 * lives in lib/queries/schedule.ts, and the athlete's Today page imports it.
 * Signing in as an athlete after creating a session showed "Working towards
 * v Bristol Bears" on the same screen, which is what caught it. A sweep of the
 * route folder cannot answer "does this screen show X" when the read is one
 * import away, so the assertion below follows the import instead.
 *
 * What is actually true: fetchNextFixture takes the single nearest scheduled
 * fixture for the org and shows it to every athlete, with no participation
 * filter. Immediate and club-wide, but nobody is named in it — so the copy has
 * to carry both halves, and cannot just repeat the session sentence.
 *
 * Each claim below is asserted twice: that the sentence is on the screen, and
 * that the code still makes the sentence true.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
/* JSX wraps prose across lines at whatever column prettier chose, so every
   comparison is against text with its whitespace collapsed. Matching the
   source layout instead is how three earlier test files in this repo ended up
   asserting the formatting rather than the sentence. */
const prose = (s: string): string => strip(s).replace(/\s+/g, ' ');

console.log('the behaviour: a session reaches the athlete app with no second step');
{
  const q = read('src/lib/queries/schedule.ts');
  const c = strip(q);
  const fn = c.slice(c.indexOf('async function fetchSessionsBetween'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(!/\.eq\('status'/.test(body), 'the shared session read applies no status filter');
  assert(!/publish/i.test(body), 'and knows nothing about publishing');
  assert(/is\('deleted_at', null\)/.test(body), 'a deleted session is the only one it withholds');

  const day = c.slice(c.indexOf('export async function fetchAthleteDaySessions'));
  const dayBody = day.slice(0, day.indexOf('\n}\n'));
  assert(
    /session_participants/.test(dayBody) && /group_memberships/.test(dayBody),
    "the athlete's own day narrows by participation, individually or through a group",
  );
  assert(
    !/status/.test(dayBody) && !/publish/i.test(dayBody),
    'and by nothing resembling a publish state — so the copy is not lying',
  );
}

console.log('\nthe behaviour: every athlete sees the next fixture, club-wide');
{
  const today = strip(read('src/app/(athlete)/today/page.tsx'));
  assert(/fetchNextFixture/.test(today), "the athlete's Today page reads the next fixture");
  assert(/Working towards/i.test(today), 'and renders it under "Working towards"');

  const c = strip(read('src/lib/queries/schedule.ts'));
  const fn = c.slice(c.indexOf('export async function fetchNextFixture'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(/\.eq\('org_id', orgId\)/.test(body), 'the fixture read is scoped to the org');
  assert(
    !/participant/i.test(body) && !/athleteId/.test(body),
    'and takes no athlete or participation argument — it is the same fixture for everyone',
  );
  assert(/\.limit\(1\)/.test(body) && /order\('kickoff_at'\)/.test(body), 'and it is the nearest one only, not a list');
  assert(!/publish/i.test(body), 'with no publish state involved, so "as soon as you create it" holds');
}

console.log('\ncreating a session says so');
{
  const p = prose(read('src/components/NewSessionForm/NewSessionForm.tsx'));
  assert(/athlete app/i.test(p), 'the form names the athlete app');
  assert(/as soon as you create it/i.test(p), 'and says when it gets there');
  assert(/no separate publish step/i.test(p), 'and rules out the step the reporter went looking for');
}

console.log('\nediting one says the same thing about saving');
{
  const p = prose(read('src/components/SessionEditForm/SessionEditForm.tsx'));
  assert(/athlete app/i.test(p), 'the edit form names the athlete app too');
  assert(/as soon as you save/i.test(p), 'and ties it to saving, not to creating');
  assert(/no separate publish step/i.test(p), 'with the same closing sentence, so the two read as one rule');
}

console.log('\ncreating a fixture says both halves, because a fixture is not a roster');
{
  const p = prose(read('src/components/NewFixtureForm/NewFixtureForm.tsx'));
  assert(/Today screen/i.test(p), 'it says where the athlete sees it');
  assert(/every athlete/i.test(p), 'and that it is club-wide, not a selection');
  assert(/as soon as you create it/i.test(p), 'and that it gets there immediately');
  assert(/no separate publish step/i.test(p), 'ruling out the same step the session form rules out');
  assert(
    /nobody is named in a fixture/i.test(p) && /create a\s+session/i.test(p),
    'while still saying nobody is named in it, and pointing at the thing that does name people',
  );
}

console.log('\napplying a week template writes real sessions, and says so');
{
  const p = prose(read('src/components/ApplyControls/ApplyControls.tsx'));
  assert(/athlete app/i.test(p), 'the apply screen names the athlete app');
  assert(/straight away|immediately|as soon as/i.test(p), 'and says the sessions land there without a further step');
  assert(/cannot be undone|can&rsquo;t be undone/i.test(p), 'without displacing the warning that was already there');
}

console.log('\nthe grid keeps its staging flow — this change adds copy, it does not rewire publishing');
{
  const w = read('src/components/ScheduleGrid/ScheduleWorkspace.tsx');
  assert(/Publish to athletes/.test(w), 'the staged-edit button still reads "Publish to athletes"');
  assert(/handlePublish/.test(w) && /handleDiscard/.test(w), 'and Publish/Discard both still exist');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
