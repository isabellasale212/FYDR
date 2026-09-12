/* ATH-ADULT-13 — one gym session from history, the A items of the "My data
 * and history" board (2026-09-12). The record is
 * docs/overnight-records-2026-09-12.md; the row-tap correction, the eyebrow,
 * the per-row "Corrected · was …" marker and the list's pill are C there.
 *
 *   A1 one way back, full width, named for its destination: a .subm footer
 *      with "Back to gym history" as a .btn-ghost Link (the primary is
 *      reserved for Save correction); the shell's Back stands down on this
 *      route so there is one control, not two (§0w's third item)
 *   A2 the summary line is the hero: "Total volume" and "Session RPE" as
 *      .rd-value figures in a two-up card, with "N sets across M exercises"
 *      beneath; the original one-line summary kept under it
 *   A3 the totals admit a correction: "N sets · recomputed after a
 *      correction" when any set has a prior revision
 *   A4 an absent set value is "Not logged", never a dash — in the cells and
 *      in the "What you reported" list
 *   A5 the footer note is the board's two sentences
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const page = strip(read('src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx'));
const list = strip(read('src/components/GymSessionSetsList/GymSessionSetsList.tsx'));
const back = read('src/components/BackButton/BackButton.tsx');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('A1. one way back, full width, named for its destination');
{
  assert(/<div className="subm">\s*<Link\s+href="\/my-data\?tab=gym"\s+className="btn-ghost"/.test(page),
    'a .subm footer holds the Back to gym history Link as a .btn-ghost');
  assert(/className="btn-ghost"[^>]*>\s*Back to gym history\s*<\/Link>/.test(page), 'with the pinned label');
  assert(/justifyContent: 'center'/.test(page) && /display: 'flex'/.test(page), 'full width, centred');
  assert(!/className="tiny">\s*<Link/.test(page), 'the 15px text link is gone');
  assert(/SELF_DISMISSING = \[[^\]]*'\/my-data\/gym\/'/.test(back), "the shell's Back stands down on /my-data/gym/");
}

console.log('\nA2. the summary line is the hero');
{
  assert(/className="card sd-hero"/.test(page), 'a two-up hero card');
  assert(/<p className="eyebrow">Total volume<\/p>/.test(page), '"Total volume"');
  assert(/<p className="eyebrow">Session RPE<\/p>/.test(page), '"Session RPE"');
  assert((page.match(/className="rd-value num"/g) ?? []).length === 3,
    'three .rd-value renders — the tonnage figure, its "Not logged" twin, and the RPE (the size 12 settled)');
  assert(/<span className="rd-unit">kg<\/span>/.test(page), 'the unit as .rd-unit');
  assert(/across \$\{exerciseCount\} \$\{exerciseCount === 1 \? 'exercise' : 'exercises'\}/.test(page), '"N sets across M exercises"');
  assert(/const hasLoad = sets\.some\(\(s\) => s\.load_kg !== null\)/.test(page) && /\{hasLoad \? \([\s\S]{0,300}data-missing=""[\s\S]{0,40}Not logged/.test(page),
    'no loads at all reads "Not logged"');
  assert(/session\.session_rpe !== null \? formatNumber\(session\.session_rpe, 1\) : 'Not rated'/.test(page), 'no rating reads "Not rated"');
  const missing = rule('.rd-value[data-missing]');
  assert(/color:\s*var\(--faint\)/.test(missing) && /font-size:\s*var\(--fs-16\)/.test(missing) && /font-weight:\s*600/.test(missing),
    'a hero word is --faint, --fs-16, 600 — not a 48px word');
  const hero = rule('.sd-hero');
  assert(/grid-template-columns:\s*1fr 1fr/.test(hero) && /gap:\s*var\(--sp-14\)/.test(hero), '.sd-hero is a 1fr 1fr grid on --sp-14');
  assert(/ logged\s*\{session\.session_rpe !== null \? ` · session RPE/.test(page) && /kg total`/.test(page), 'the original summary line is kept beneath');
}

console.log('\nA3. the totals admit a correction');
{
  assert(/corrected\.length > 0\s*\?\s*`\$\{sets\.length\} sets · recomputed after a correction`/.test(page)
    || /corrected\.length > 0[\s\S]{0,120}recomputed after a correction/.test(page),
    '"N sets · recomputed after a correction" when a set has a prior revision');
  assert(/sets\.reduce\(\(sum, s\) => sum \+ \(s\.reps_completed \?\? 0\) \* \(s\.load_kg \?\? 0\), 0\)/.test(page),
    'and the page sums live sets, so it is true (0045 recomputes the stored total the same way)');
}

console.log('\nA4. an absent set value is words');
{
  assert(!/'—'/.test(list) && !/\\u2014/.test(list), 'no em dash in the sets list');
  assert(/data-missing=\{s\.reps_completed === null \? '' : undefined\}/.test(list), 'a null reps cell is marked');
  assert(/data-missing=\{s\.load_kg === null \? '' : undefined\}/.test(list), 'a null load cell is marked');
  assert((list.match(/'Not logged'/g) ?? []).length === 2, 'both say "Not logged"');
  const cell = rule('table.tbl td[data-missing]');
  assert(/color:\s*var\(--faint\)/.test(cell) && /font-weight:\s*600/.test(cell), 'in --faint, 600');
  assert(!/const dash = /.test(page) && !/dash\(/.test(page), 'the detail page has no dash() any more');
  assert(/load not logged/.test(page) && /reps not logged/.test(page), 'the "What you reported" list says which value was not logged');
}

console.log('\nA5. the footer note');
{
  assert(/A correction keeps the original\. Corrections stay open on a finished\s*\n?\s*session\./.test(list), "the board's two sentences");
  assert(!/nothing is overwritten/.test(list), 'the old sentence is gone');
}

console.log('\nwhat this flow did NOT change');
{
  assert(/What you reported/.test(page), "§0v's card stays (D1)");
  assert(/>\s*Correct\s*<\/button>/.test(list), 'the per-row Correct button stays until the row-tap panel (C2)');
  assert(/Corrected/.test(page), 'the Corrected pill stays');
}

console.log('\nC1. the eyebrow "Gym · Lower A · complete" (2026-09-12)');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  const fn = q.slice(q.indexOf('export async function fetchGymSessionLog('), q.indexOf('\nexport ', q.indexOf('export async function fetchGymSessionLog(') + 10));
  assert(/select\('id, entry_date, session_rpe, comment, status, programme_session_id'\)/.test(fn), 'fetchGymSessionLog selects status and the programme session');
  assert(/fetchMyProgrammeSessions\(db, athleteId\)/.test(page), 'the page names the session through the athlete-safe RPC, as the list does');
  assert(/<p className="eyebrow">\s*Gym(\s|&middot;|·|\{)/.test(page) && /statusWord/.test(page), 'the eyebrow reads "Gym · {session} · complete" above the date');
}

console.log('\nC3. Corrected on the history list, and "Set 1 was corrected on Fri 14 Aug. Both values are kept on record." on the detail');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  const fn = q.slice(q.indexOf('export async function fetchRecentGymSessions('), q.indexOf('\nexport ', q.indexOf('export async function fetchRecentGymSessions(') + 10));
  assert(/select\('gym_session_log_id, revision_of'\)/.test(fn) && /corrected: correctedLogs\.has\(r\.id\)/.test(fn), 'the list read carries a per-session corrected flag off the live sets\' revision_of');
  const md = strip(read('src/app/(athlete)/my-data/page.tsx'));
  assert(/s\.corrected \? \(\s*<span className="pill pill-neutral"[^>]*>\s*Corrected/.test(md), 'the gym history row carries the neutral Corrected pill');
  assert(/was corrected\$\{c\.current\.logged_at \? ` on \$\{formatDate\(/.test(page) && /Both values are kept on record\./.test(page), 'the detail says when each set was corrected and that both values are kept');
  assert(!/corrected after being logged\. The original is kept and is shown here\./.test(page), 'the old caption is gone');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/09-one-gym-session-logged.md');
  assert(/Both values are kept on record/.test(spec) && /eyebrow/.test(spec), 'and the eyebrow and the corrected sentence');
  assert(/Back to gym history/.test(spec) && /Total volume/.test(spec) && /Not logged/.test(spec), '09-one-gym-session-logged.md describes the hero, the words and the footer');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
