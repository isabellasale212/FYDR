/* STAFF-SS-01's dashboard series, approved 2026-09-12 in this order: A1, A2,
 * A4 first, then the thresholds line, then the role versions. Each section
 * below is one commit; the record is docs/overnight-records-2026-09-12.md.
 *
 *   A1 Doubtful and Ruled out are tone-family cards, not dot rows — the
 *      treatment ATH-ADULT-02 approved for the athlete's availability line
 *      (warn / bad fill and border, the tone's own ink). Fit and available
 *      stays a plain row.
 */
import { readFileSync } from 'node:fs';
import { missingRuns, runLabel } from '@/lib/missingRuns';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('A1. Doubtful and Ruled out as tone cards');
{
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/data-tone=\{r\.key === 'modified' \? 'warn' : r\.key === 'unavailable' \? 'bad' : undefined\}/.test(page), 'the two rows carry their tone; Fit and available carries none');
  const block = css.slice(css.indexOf(".dash-ready-row[data-tone='warn'],"), css.indexOf('.dash-load-track {'));
  assert(/\.dash-ready-row\[data-tone='warn'\]\s*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--warn-rgb\)\) 12%, var\(--surf\)\)/.test(block), 'warn: the availability line\'s own 12% fill');
  assert(/\.dash-ready-row\[data-tone='warn'\]\s*\{[^}]*border:\s*1px solid rgb\(var\(--warn-rgb\) \/ 0\.4\)/.test(block), 'and its 0.4 border');
  assert(/border-radius:\s*var\(--r-control\)/.test(block), 'on the control radius');
  assert(/\.dash-ready-row\[data-tone='bad'\]\s*\{[^}]*rgb\(var\(--bad-rgb\)\) 12%[^}]*rgb\(var\(--bad-rgb\) \/ 0\.4\)/.test(block), 'bad: the same treatment in the bad family');
  assert(/color:\s*var\(--text\)/.test(block) && !/--warn-text|--bad-text/.test(block), 'the card reads in --text, as the availability line does (the count keeps its tone ink); --warn-text is 3.6:1 on --surf and lower on the fill');
  assert(!/ROW_DOT/.test(page) || /className=\{ROW_DOT\[r\.key\]/.test(page), 'the dot column is unchanged for the plain row');
}

console.log('\nA2. a summary card is a button and says which state it is in');
{
  const src = strip(read('src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx'));
  assert((src.match(/<StatState open=\{expanded === '(wellness|available)'\} \/>/g) ?? []).length === 2, 'both toggle cards render the written state');
  assert(/open \? 'Open · showing the list' : 'Closed · opens a list'/.test(src), '"Closed · opens a list" / "Open · showing the list" — what aria-expanded announces, written');
  assert(/open \? '▾' : '▸'/.test(src), 'the glyph swaps ▸ / ▾ — nothing rotates');
  assert(!/dash-flags-chevron/.test(src), 'the rotating chevron is gone from these two cards');
  assert(/aria-expanded=\{expanded === 'wellness'\}/.test(src) && /aria-expanded=\{expanded === 'available'\}/.test(src), 'aria-expanded stays on both');
  const closed = rule('button.dash-stat');
  assert(/background:\s*var\(--surf2\)/.test(closed), 'closed: a --surf2 well (the stat is the button text)');
  const open = rule("button.dash-stat[aria-expanded='true']");
  assert(/background:\s*var\(--surf\)/.test(open) && /box-shadow:\s*inset 0 0 0 1px var\(--accent\)/.test(open), 'open: the surface with an accent border');
  assert(/font-size:\s*var\(--fs-11\)/.test(rule('.dash-stat-state')) && /font-weight:\s*600/.test(rule('.dash-stat-state')), 'the state line at --fs-11 / 600');
}

console.log('\nA4. missing check-ins by run length, and "Not submitted"');
{
  const today = '2026-09-12';
  const missing = [{ id: 'a', name: 'Sam Wren' }, { id: 'b', name: 'Alex Grant' }, { id: 'c', name: 'Kai Mercer' }];
  const exp = (id: string, dates: string[]) => dates.map((d) => ({ athlete_id: id, expectation_date: d }));
  const expectations = [
    ...exp('a', ['2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09']),
    ...exp('b', ['2026-09-12', '2026-09-11', '2026-09-09']), // the 10th was a rest day
    ...exp('c', ['2026-09-12']),
  ];
  const entries = [
    { athlete_id: 'a', entry_date: '2026-09-09' },
    { athlete_id: 'b', entry_date: '2026-09-01' },
    { athlete_id: 'a', entry_date: '2026-09-13' }, // the future never counts
  ];
  const runs = missingRuns(missing, expectations, entries, today);
  assert(runs.map((r) => r.name).join(', ') === 'Alex Grant, Sam Wren, Kai Mercer', 'longest run first, then by name');
  assert(runs[0]!.runDays === 3 && runs[0]!.lastEntry === '2026-09-01', 'Alex: three expected mornings missed (the rest day neither counts nor breaks), last entry 1 Sept');
  assert(runs[1]!.runDays === 3 && runs[1]!.lastEntry === '2026-09-09', 'Sam: three, and the run ends at the morning that has an entry');
  assert(runs[2]!.runDays === 1 && runs[2]!.lastEntry === null, 'Kai: this morning only, no entry on record');
  assert(runLabel(1) === '1 morning' && runLabel(3) === '3 mornings in a row', 'the words');
  const q = strip(read('src/lib/queries/dashboard.ts'));
  assert(/wellnessMissing: MissingRun\[\]/.test(q) && !/wellnessMissingNames/.test(q), 'the headline stats carry the runs, not a name list');
  assert(/missingRuns\(/.test(q), 'computed by the pure function');
  assert(/const ids = wellnessExp\.missingIds;[\s\S]{0,600}\.from\('compliance_expectations'\)[\s\S]{0,300}\.eq\('domain', 'wellness'\)[\s\S]{0,200}\.in\('athlete_id', ids\)/.test(q), 'from the missing athletes\' own expectations');
  const c = strip(read('src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx'));
  assert(/Not submitted · \{runLabel\(row\.runDays\)\}/.test(c), 'each row: "Not submitted · N mornings in a row"');
  assert(/last entry \$\{formatDate\(row\.lastEntry, timezone\)\}/.test(c) && /no entry in the last 90 days/.test(c), 'and the last entry date, or that there is none in the window');
  assert(!/0%/.test(c.slice(c.indexOf("expanded === 'wellness'"), c.indexOf("expanded === 'available'"))), 'never 0%');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
