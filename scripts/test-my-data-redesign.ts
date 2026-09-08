/* My data, rebuilt from the redesign reference (screens 03-08).
 *
 * THE HEADLINE CHANGE IS THE TAB BAR: six segments become three, drawn as a
 * segmented pill track. Everything else in the changelog's My data section
 * describes cards this build already had — the Gym headline with its "of 14
 * assigned / last 4 weeks" block and four-week bars, and the whole Tests hero
 * with its amber off-PB delta and gold/blue sparkline, were already on screen.
 * What is genuinely new is the truncation-plus-"See all" pattern the reference
 * uses on all three tabs, the loss of the period control, and the pill track.
 *
 * THREE DESTINATIONS LEAVE THE TAB BAR AND MUST NOT LEAVE THE APP. The
 * changelog says Training, Nutrition and Leaderboards are "dropped from the tab
 * bar (data still exists in the app, just not surfaced as separate tabs here)".
 * That sentence is only true if something still reaches them, and as drawn
 * nothing does:
 *
 *   - `/my-data/boards` had exactly ONE route in from anywhere in the athlete
 *     app: the Leaderboards segment. (LeaveLeaderboardButton's router.push is a
 *     redirect AFTER leaving a board, not a way to reach one.) Dropping the
 *     segment orphans both board routes outright — including the GPS tier gate
 *     added on 2026-09-08.
 *   - The nutrition check-in history has exactly one reader in the athlete app,
 *     this page. NutritionCheckinForm also redirects to `/my-data?tab=nutrition`
 *     on success, so dropping the route sends an athlete who just answered to a
 *     tab that no longer exists.
 *   - The training tab is the only screen showing session and RPE history;
 *     Today's session list went in the same redesign.
 *
 * So the two dropped TABS stay live as routes, and a footer card reaches all
 * three. Asserted below, because a "See all"-shaped screen makes it very easy
 * to lose a destination and never notice.
 */
import { readFileSync } from 'node:fs';
import { ATHLETE_PILL_EXEMPT, findViolations } from './check-control-radius';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const page = strip(readFileSync('src/app/(athlete)/my-data/page.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');
const nutritionForm = readFileSync('src/components/NutritionCheckinForm/NutritionCheckinForm.tsx', 'utf8');

console.log('the tab bar: three segments, as drawn');
{
  const bar = /SEGMENTS[^=]*=\s*\[([^\]]*)\]/.exec(page)?.[1] ?? '';
  assert(/'wellness'/.test(bar) && /'gym'/.test(bar) && /'testing'/.test(bar),
    'Wellness, Gym and Tests are the three segments');
  assert(!/'training'/.test(bar) && !/'nutrition'/.test(bar),
    'Training and Nutrition are not among them');
  assert(!/className="md-seg"[^>]*>\s*Leaderboards/.test(page),
    'and Leaderboards is not a segment either');
}

console.log('\n...but the two dropped tabs are still ROUTES, so their URLs keep working');
{
  const tabs = /const TABS = \[([^\]]*)\]/.exec(page)?.[1] ?? '';
  for (const t of ['wellness', 'training', 'nutrition', 'testing', 'gym']) {
    assert(new RegExp(`'${t}'`).test(tabs), `?tab=${t} is still a legal route`);
  }
  assert(/tab === 'training'/.test(page), 'and the training tab still renders');
  assert(/tab === 'nutrition'/.test(page), 'and the nutrition tab still renders');
  /* If this ever fails, an athlete who submits the weekly check-in lands on a
     tab that no longer exists. */
  assert(/\/my-data\?tab=nutrition/.test(nutritionForm),
    "NutritionCheckinForm's success redirect still has somewhere to land");
}

console.log('\nand a footer card is the route in to all three');
{
  assert(/md-more/.test(page), 'the footer card exists');
  for (const [href, what] of [
    ['/my-data\\?tab=training', 'training sessions and RPE'],
    ['/my-data\\?tab=nutrition', 'nutrition check-ins'],
    ['/my-data/boards', 'leaderboards'],
  ] as const) {
    assert(new RegExp(`href="${href}"`).test(page), `reaches ${what}`);
  }
}

console.log('\nflags from the two dropped tabs fall through to "Also noted for you"');
{
  /* SEGMENT_DOMAINS decides which flags land inside a tab and which are shown
     above the tab content as orphans. Leave training/nutrition in it and their
     flags are routed into tabs that are no longer in the bar — a flag raised
     about an athlete, addressed to them, that they are never shown. */
  /* DERIVED FROM SEGMENTS, not re-listed. A second literal list would be a
     second thing to remember: drop a tab from the bar, forget the set, and
     that tab's flags are delivered to a tab nobody can open. Asserting the
     derivation is stronger than asserting today's contents, because it holds
     for the next tab that moves too. */
  assert(/SEGMENT_DOMAINS = new Set\(SEGMENTS/.test(page),
    'SEGMENT_DOMAINS is derived from SEGMENTS, so the bar and the flag routing cannot disagree');
  assert(!/SEGMENT_DOMAINS = new Set\(\[/.test(page),
    'and is not a second hand-maintained list');
  assert(/orphanFlags/.test(page), 'and the orphan notice still renders');
}

console.log('\nthe period control is gone, and the windows it drove are now fixed and stated');
{
  assert(!/PeriodSelector/.test(page), 'no period dropdown');
  assert(!/WindowLine/.test(page), 'no date-range caption');
  assert(!/resolvePeriod|clampPeriod|PERIOD_ALLOWED|PERIOD_REASONS/.test(page),
    'and none of its plumbing is left resolving something nothing renders');
  assert(/WELLNESS_WINDOW_DAYS/.test(page), 'wellness has a named fixed window');
  assert(/OTHER_WINDOW_DAYS/.test(page), 'and so do the tabs that are not all-time');
  /* The old note told the athlete to "narrow the period" to see a list in
     full. With no control to narrow, that sentence sends them looking for a
     dropdown that is not there. */
  assert(!/narrow the period/.test(page), 'and no copy still tells them to narrow a period');
}

console.log('\nthe "See all" pattern: truncated by default, and every link goes somewhere real');
{
  assert(/HISTORY_PREVIEW_ROWS/.test(page) && /LIST_PREVIEW_ROWS/.test(page),
    'the previews are named counts, not magic numbers');
  assert(/showAll/.test(page), 'and ?all=1 expands them on the same route');
  assert(/all=1/.test(page), 'which is what the See all links point at');
  /* The Tests tab's own footer note already refused to draw a link to a page
     that does not exist. Expanding in place is how the reference's link gets
     built without inventing three new routes. */
  assert(!/See all[^<]*<\/a>/.test(page) || /href=\{[^}]*all=1/.test(page),
    'no See all link points at a page that was never built');
}

console.log('\nthe pill track, exempted by name like the others');
{
  assert(ATHLETE_PILL_EXEMPT.includes('md-seg'), "'md-seg' is exempt by name");
  assert(/className="md-seg-track"/.test(page), 'the track is renamed so the exemption cannot over-match');
  /* `.seg` as an exempt NAME would have matched .theme-seg, .lbw-segmented,
     .sg-segment and .dash-stat-bar-seg by substring — handing three staff
     controls a pill nobody asked for. */
  assert(!/className="seg"/.test(page), 'and the old bare .seg class is gone');
  for (const sel of ['.md-seg-track', '.md-seg']) {
    const rule = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    assert(/var\(--r-full\)/.test(rule), `${sel} reads --r-full`);
  }
  assert(/\.md-seg\[aria-selected='true'\]\s*\{[^}]*var\(--accent\)/.test(css),
    'the live segment is an accent-filled pill');
}

console.log('\nthe guard still guards');
{
  assert(findViolations(css).length === 0, 'no interactive rule sets its own radius');
  assert(findViolations('.md-seg { border-radius: 999px; }').length === 1,
    'and a raw 999px on the exempt name still fails');
  assert(findViolations('.lbw-segmented { border-radius: var(--r-full); }').length === 1,
    'and a staff segmented control cannot borrow the athlete pill');
}

console.log('\nthe readiness delta follows the new reference into green');
{
  const up = /\.rd-delta\[data-dir='up'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/--good/.test(up), "▲ on last week is green now, not the accent");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
