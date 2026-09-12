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

console.log('the tab bar: five segments — ATH-ADULT-12 D1, reversed by Isabella 2026-09-12');
{
  /* Three from 2026-09-08 (Wellness, Gym, Tests, with Sessions and Nutrition
     behind a footer card) became five: the objection that drove the footer
     card — three destinations orphaned — is answered by giving two of them
     their tab back. Leaderboards keeps its footer row: it is a separate
     screen, not a view of this one. */
  const bar = /SEGMENTS[^=]*=\s*\[([^\]]*)\]/.exec(page)?.[1] ?? '';
  assert(bar.replace(/\s+/g, '').replace(/,$/, '') === "'wellness','gym','training','nutrition','testing'", 'Wellness, Gym, Sessions, Nutrition, Tests — in that order');
  assert(/training: 'Sessions'/.test(page) && /nutrition: 'Nutrition'/.test(page), 'labelled Sessions and Nutrition (the route keys stay training / nutrition)');
  assert(!/className="md-seg"[^>]*>\s*Leaderboards/.test(page),
    'and Leaderboards is not a segment');
  /* B3 + C9: five labels fit 343px at --fs-11; at Larger Text the row wraps to
     two 44px rows rather than scrolling or clipping. */
  const seg = /\.md-seg\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/font-size:\s*var\(--fs-11\)/.test(seg), 'segment labels at --fs-11');
  assert(/flex:\s*1 1 auto/.test(seg), 'each segment is as wide as its label and shares the rest — five fit one row at the default size');
  const track = /\.md-seg-track\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/flex-wrap:\s*wrap/.test(track), 'the track wraps, never scrolls or clips');
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

console.log('\nand a footer card is the route in to leaderboards');
{
  assert(/md-more/.test(page), 'the footer card exists');
  assert(/href="\/my-data\/boards"/.test(page), 'reaches leaderboards — the only route in to /my-data/boards');
  assert(!/className="me-row"[^>]*href="\/my-data\?tab=training"/.test(page) && !/href="\/my-data\?tab=training" className="me-row"/.test(page), 'Sessions left the footer card for its tab');
  assert(!/href="\/my-data\?tab=nutrition" className="me-row"/.test(page), 'and so did Weekly check-ins');
}

console.log('\nflags with no segment fall through to "Also noted for you" (gps and compliance now; training and nutrition have their tabs back)');
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

console.log('\nthe period control is BACK — it was the only one on the athlete surface');
{
  /* REVERSED, 8 September 2026. The reference draws no dropdown and no
     date-range caption, and for one afternoon this screen had neither: windows
     fixed at 14 and 28 days. That removed a real feature — an athlete could no
     longer ask any screen in the app for a season or a year — so it is back.
     Asserted on the ELEMENT, not the import. */
  assert(/<PeriodSelector/.test(page), 'the period dropdown renders');
  assert(/<WindowLine/.test(page), 'and the resolved date range beneath it');
  for (const sym of ['resolvePeriod', 'clampPeriod', 'PERIOD_ALLOWED', 'PERIOD_REASONS']) {
    assert(new RegExp(sym).test(page), `${sym} is wired again`);
  }
  /* THE COERCION MESSAGES MATTER as much as the control. `?period=day` typed by
     hand, or `?period=season` at a club with no season row, must coerce
     server-side and SAY so — a screen that silently renders a different window
     than the one asked for is the bug clampPeriod exists to prevent. */
  assert(/coercedFrom/.test(page), 'and a coerced period still tells the athlete what happened');
  /* WHAT MUST NOT COME BACK. The two fixed-window constants would now be a
     second, contradictory source for the same span. */
  assert(!/WELLNESS_WINDOW_DAYS|OTHER_WINDOW_DAYS/.test(page),
    'and the fixed-window constants are gone, so nothing states the span twice');
  /* EVERY LINK OFF THIS SCREEN CARRIES THE PERIOD, or choosing "This season"
     and tapping a tab silently returns the athlete to 28 days. The See all
     links are new since the last time this bug was fixed, so they need it too. */
  assert(/tab=\$\{next\}&\$\{PERIOD_PARAM\}=\$\{periodKey\}/.test(page),
    'the tab chips carry it');
  assert(/tab=\$\{tab\}&\$\{PERIOD_PARAM\}=\$\{periodKey\}&all=1/.test(page),
    'and so do the See all links');
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
