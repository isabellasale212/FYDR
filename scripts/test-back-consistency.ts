/* One word, one behaviour: "Back" returns to the previous page.
 *
 * THE SWEEP. Every Back-like control in the app was enumerated — 57 of them —
 * and fetched 34 staff routes to see which actually render their own. Exactly
 * one does: /reports/athlete carried `<Link href="/reports">Back</Link>` inside
 * its search row, while the layout's own history Back renders above it on the
 * same screen. Both read "Back". One returns where you came from; the other
 * always goes to /reports. Confirmed in the browser, not inferred: the page
 * shows button.back-btn and a.btn-ghost[href="/reports"], both labelled Back.
 *
 * WHAT IS NOT A DEFECT, and is asserted here so a later tidy-up does not
 * "fix" it: a control that NAMES its destination — "Back to today", "Back to
 * leaderboards", "Back to sign in", "Back to the squad" — is a promise about
 * where it goes, and history-back would make the label lie the moment somebody
 * arrived from anywhere else. Those stay links. The check-in sheets compute
 * their own destination from the entry date and BackButton stands down on them
 * entirely, so they are not two controls either.
 *
 * WHAT IS NOT COVERED. The queue describes a Back that, mid-edit, exits the
 * edit instead of returning to the previous page. Nothing in the app does that:
 * the only router.back() is BackButton's, edit modes are component state rather
 * than URL state, so Back leaves the page rather than the edit, and the one
 * step-back inside the schedule draft wizard is a wizard step, which is what it
 * should be. Raised as a question rather than guessed at.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });

/** A control whose visible label is exactly "Back" — not "Back to somewhere". */
const BARE_BACK = />\s*Back\s*</;

console.log('one history control, and it is the shared one');
{
  const b = read('src/components/BackButton/BackButton.tsx');
  assert(/router\.back\(\)/.test(b), 'BackButton goes back in history');
  assert(/window\.history\.length > 1/.test(b), 'and hides itself when there is nothing behind this page');

  const all = [...walk('src/components'), ...walk('src/app')];
  const others = all.filter((p) => !p.includes('BackButton') && /router\.back\(\)/.test(strip(read(p))));
  assert(others.length === 0, `nothing else calls router.back() (${others.join(', ') || 'none'})`);
}

console.log('\nno staff page ships a second control called just "Back"');
{
  const offenders = walk('src/app/(staff)').filter((p) => BARE_BACK.test(strip(read(p))));
  assert(
    offenders.length === 0,
    `no staff route renders its own bare Back (${offenders.join(', ') || 'none'})`,
  );
  const athleteReport = strip(read('src/app/(staff)/reports/athlete/page.tsx'));
  assert(
    !/href="\/reports"[^>]*>\s*Back/.test(athleteReport),
    'the athlete report specifically no longer links Back to /reports beside the layout button',
  );
  assert(
    /GroupFilter|type="search"/.test(athleteReport),
    'and the rest of that search row is still there — this removed one control, not the row',
  );
}

console.log('\na Back that names its destination keeps going there');
{
  const named: [string, string][] = [
    ['src/app/(athlete)/my-data/boards/[leaderboardId]/page.tsx', 'Back to leaderboards'],
    ['src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx', 'Back to gym history'],
    /* "Back to Today" since ATH-ADULT-06 and -08 (2026-09-12): the board
       writes the destination as the screen is named — Today — and the exit
       is a footer button. Still a Link to a stated place, which is what this
       pins. */
    ['src/app/(athlete)/nutrition-check-in/page.tsx', 'Back to Today'],
    ['src/app/(athlete)/rpe/[sessionId]/page.tsx', 'Back to Today'],
  ];
  for (const [p, label] of named) {
    const s = strip(read(p));
    assert(s.includes(label), `${label} is still on ${p.split('/').slice(-2).join('/')}`);
    assert(/<Link/.test(s), 'and is still a link to a stated place, not a history call');
  }
}

console.log('\nthe check-in sheets are one control, not two');
{
  const b = read('src/components/BackButton/BackButton.tsx');
  assert(/SELF_DISMISSING/.test(b), 'BackButton knows which screens carry their own way out');
  for (const p of ['/check-in', '/nutrition-check-in', '/rpe/', '/gym/']) {
    assert(b.includes(`'${p}'`), `${p} is on that list, so the layout does not add a second Back`);
  }
  const ci = strip(read('src/app/(athlete)/check-in/page.tsx'));
  assert(
    /entryDate === today \? '\/today' : '\/my-data\?tab=wellness'/.test(ci),
    'and the check-in works its own destination out from the entry date rather than hard-coding one',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
