/* The dashboard's open-flags card, redesigned 2026-09-07.
 *
 * THREE THINGS THIS FILE EXISTS TO HOLD STILL, all of them decided before the
 * build rather than discovered during it.
 *
 * 1. THE ESCALATED PILL DOES NOT SAY "Sent to medical staff". The spec asked
 *    for that wording and it is not what the state means: docs/screens/30-flags.md
 *    §55 says "A flag is escalated after 24 hours unacknowledged". It is a
 *    timer, not a routing action — nothing sends anything to anybody. On a card
 *    a medic reads first, a pill claiming a handover that never happened is the
 *    worst kind of wrong. Agreed wording: "Unacknowledged 24h+".
 *
 * 2. THE PER-ATHLETE DROPDOWN IS UNTOUCHED. It lives inside this same
 *    component, and its first button was changed on 2026-09-06 to open the
 *    PLAYER rather than the flag queue — someone opening a flag from the
 *    dashboard is working out who this is, and the profile carries that. A
 *    redesign of the rows around it must not quietly undo that.
 *
 * 3. NO RAW HEX. The spec gave literal colours (#fce8e5, #8a2f22, #fdf1dc,
 *    #8a6a12, #f6d9d5). CLAUDE.md: "Style through the tokens defined there,
 *    never a raw hex" — and .pill-bad/.pill-warn already express exactly those
 *    pairs through --bad-rgb / --bad-pill-text / --pill-fill-alpha-bad. The
 *    literals were that system re-specified, not a new palette.
 */
import { readFileSync } from 'node:fs';
import { unreviewedLabel } from '@/lib/queries/flags';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const TSX = 'src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx';
const CSS = 'src/styles/base.css';
/* COMMENTS STRIPPED BEFORE EVERY ASSERTION ABOUT WHAT IS BUILT. This is the
   third time in one session the same trap has fired: a comment that quotes the
   wrong thing in order to explain why it is wrong reads, to a naive search, as
   the wrong thing still being present. Both files here do exactly that — the
   component's comment names "Sent to medical staff" to say it is not used, and
   the stylesheet's names all six spec hexes to say they are mapped onto tokens
   instead. What a file SAYS and what it DOES are different questions, and only
   the second one is behaviour. `raw` is kept for the few assertions that are
   deliberately about the prose. */
const strip = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const tsx = read(TSX);
const code = strip(tsx);
const cssRaw = read(CSS);
const css = strip(cssRaw);
const rule = (sel: string): string => {
  const i = css.indexOf(`${sel} {`);
  if (i === -1) return '';
  const end = css.indexOf('}', i);
  return end === -1 ? '' : css.slice(i, end);
};

console.log('"unreviewed for N days" — and the three cases it does not fit');
{
  /* durationLabel() already guards these and the guard is load-bearing: audit
     finding S2 caught flags dated the 6th labelled "raised this morning" on a
     dashboard whose today was the 5th. Future-dated rows are real in this data.
     A naive `unreviewed for ${age} days` would say "unreviewed for -3 days". */
  assert(unreviewedLabel('2026-09-01', '2026-09-22') === 'unreviewed for 21 days', '21 days');
  assert(unreviewedLabel('2026-09-21', '2026-09-22') === 'unreviewed for 1 day', 'one day is singular, not "1 days"');
  assert(unreviewedLabel('2026-09-22', '2026-09-22') === 'raised today', 'today is not "unreviewed for 0 days"');
  assert(
    unreviewedLabel('2026-10-05', '2026-09-22') === 'dated 2026-10-05',
    'a FUTURE-dated flag names its date and never claims to have been unreviewed',
  );
  assert(
    !/-\d+ day/.test(unreviewedLabel('2026-10-05', '2026-09-22')),
    'and never a negative day count (the date it prints has hyphens of its own, which is not that)',
  );
}

console.log('\nthe pill says what the state means');
{
  assert(/Unacknowledged 24h\+/.test(code), 'the escalated pill reads "Unacknowledged 24h+"');
  assert(!/Sent to medical staff/.test(code), 'and never renders "Sent to medical staff" — nothing routes it anywhere');
  assert(
    /Sent to medical staff/.test(tsx),
    'while the component still explains in prose why that wording was refused',
  );
  assert(!/>Escalated</.test(code), 'the bare "Escalated" label is gone');
}

console.log('\nthe copy the spec asked for');
{
  assert(/high priority/.test(code), 'the high pill reads "N high priority"');
  assert(/medium priority/.test(code), 'and the medium pill "N medium priority"');
  assert(/haven.t been reviewed by anyone yet/.test(code), 'the awaiting-acknowledgement line is the new sentence');
  assert(/top \$\{?rows\.length\}? athletes|top \${rows\.length} athletes/.test(code) || /top .*athletes/.test(code),
    '"top N athletes" is still rendered');
  assert(/unreviewed/.test(code), 'and the row duration is the unreviewed phrasing');
}

console.log('\nthe per-athlete dropdown is untouched');
{
  assert(/setOpenId/.test(code) && /openId/.test(code), 'the per-athlete open state survives');
  assert(/dash-flags-detail/.test(code), 'and the detail block');
  assert(/View player profile/.test(code), 'the first button still opens the PLAYER');
  assert(/\/squad\/\$\{r\.athlete_id\}/.test(code), 'at /squad/[athleteId] — the 2026-09-06 fix');
  assert(/Open athlete report/.test(code) && /\/reports\/athlete\//.test(code), 'and the second button is unchanged');
  assert(
    /2026-09-06/.test(tsx),
    'the comment recording why the first click goes to the person is still there',
  );
  assert(/dash-flags-evidence/.test(code) && /f\.rule/.test(code), 'the evidence lines inside it are unchanged');
}

console.log('\ndefault collapsed, and the empty state kept');
{
  assert(/useState\(false\)/.test(code), 'the list is collapsed on load');
  assert(/listOpen \?/.test(code), 'and conditionally rendered, so it is not merely hidden');
  assert(/data-empty="true"/.test(code), 'the zero-flags empty state survives');
  assert(/No open flags right now/.test(code), 'with its copy');
}

console.log('\nthree severity tiers on the accent bar, low included');
{
  for (const [tier, token] of [['high', '--bad'], ['medium', '--warn'], ['low', '--domain-recovery']] as const) {
    const r = rule(`.dash-flags-item[data-severity='${tier}']`);
    assert(r !== '', `${tier} has an accent-bar rule`);
    assert(r.includes(`var(${token})`), `  and uses ${token}`);
  }
  assert(/data-severity=\{r\.severity\}/.test(code), 'the row carries its severity');
}

console.log('\nno raw hex, and no variables that do not exist');
{
  const card = ['.dash-flags-panel', '.dash-flags-head', '.dash-flags-item', '.dash-flags-row']
    .map(rule).join('\n');
  for (const hex of ['#fce8e5', '#8a2f22', '#fdf1dc', '#8a6a12', '#f6d9d5', '#f2c1ba', '#c23f2e']) {
    assert(!css.includes(hex), `${hex} is not a declared value anywhere — the pill tokens express it`);
  }
  assert(
    cssRaw.includes('#f2c1ba') && cssRaw.includes('#fce8e5'),
    'while the stylesheet still records which literals were mapped, so the choice is auditable',
  );
  for (const v of ['--cd2', '--tx', '--fa2', '--fa)', '--mu)']) {
    assert(!card.includes(`var(${v}`), `var(${v}…) is not used — it does not exist in this codebase`);
  }
}

console.log('\nthe structural values from the spec');
{
  const panel = rule('.dash-flags-panel');
  assert(/border-radius: 10px/.test(panel), 'card radius 10px');
  const badge = rule('.dash-flags-badge');
  assert(/width: 38px/.test(badge) && /height: 38px/.test(badge), 'icon badge is 38x38');
  assert(/border-radius: 9px/.test(badge), 'with a 9px radius');
  const item = rule('.dash-flags-item');
  assert(/border-left: 3px solid/.test(item), 'each row carries a 3px severity bar');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
