/* The calendar names are pinned, not asked for — 15 September 2026 (Isabella,
 * the pre-deploy fixes, #1).
 *
 * WHAT ACTUALLY BROKE, corrected from the first diagnosis. The hydration
 * mismatch on /reports/athlete/[id] was not "Sept" against "Sep": Node 24 and
 * Chrome both write "Sept". It was React's server renderer writing an EMPTY
 * <title> for a title whose children are an array of more than one node
 * (react-dom's pushTitleImpl: `Array.isArray(children) ? (children.length <
 * 2 ? children[0] : null)`), SVG or not, while the client rendered the three
 * nodes — every bar of WellnessChart, every render. Fixed as one string.
 *
 * THE CLASS, fixed anyway as ruled, because it is real: a server and a
 * browser can run different ICUs and spell a month or weekday differently
 * (en-GB short September was "Sep" before CLDR 42), and a client component
 * that asks Intl for a name during render hydrates against HTML it disagrees
 * with. So lib/format.ts owns every name from four fixed tables, uses Intl
 * for the arithmetic only (numeric formatToParts, identical everywhere), and
 * no other file may call an Intl date formatter at all. Numbers too: every
 * toLocaleString names its locale, or the server's default and the
 * browser's differ on the thousands separator.
 *
 * Pinned here: the tables; every Intl call in format.ts numeric-only; no
 * Intl date formatter elsewhere (one validation-only use allowlisted by its
 * exact form); every toLocaleString with 'en-GB'; no <title> with an
 * expression beside other children. Counted: the source files walked. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatDate, formatDateTime, formatLongDate, formatTime, weekdayLongDayMonthLong } from '@/lib/format';
import { COUNTS, expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const format = read('src/lib/format.ts');

console.log('the names are tables, and the tables are British');
{
  assert(/const MONTH_SHORT = \['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'\] as const;/.test(format), 'MONTH_SHORT, with "Sept"');
  assert(/const MONTH_LONG = \['January'/.test(format) && /const WEEKDAY_SHORT = \['Sun', 'Mon'/.test(format) && /const WEEKDAY_LONG = \['Sunday'/.test(format), 'MONTH_LONG, WEEKDAY_SHORT, WEEKDAY_LONG — Sunday first, getUTCDay() order');
  const intl = strip(format).match(/new Intl\.DateTimeFormat\([^)]*\)/g) ?? [];
  expectCount('Intl.DateTimeFormat calls in format.ts (civilParts, dateInTz, zonedTimeToUtcIso, timeInTz)', intl, 4);
  const calls = strip(format).match(/new Intl\.DateTimeFormat\([\s\S]*?\}\)/g) ?? [];
  assert(calls.length === 4 && calls.every((c) => !/weekday:|month: '(short|long)'/.test(c)), 'every one of them is numeric — no Intl call asks for a name');
  assert(/weekday: new Date\(Date\.UTC\(year, month - 1, day\)\)\.getUTCDay\(\)/.test(format), 'the weekday is computed from the civil date, not looked up');
}

console.log('\nthe formatters say what the docs say');
{
  assert(formatDate('2026-09-15', 'Europe/London') === 'Tue 15 Sept', 'formatDate: "Tue 15 Sept"');
  assert(formatLongDate('2026-09-01', 'Europe/London') === 'Tue 1 Sept 2026', 'formatLongDate: "Tue 1 Sept 2026"');
  assert(formatDateTime('2026-08-08T08:14:00Z', 'Europe/London') === '8 Aug 2026 09:14', 'formatDateTime: "8 Aug 2026 09:14"');
  assert(formatTime('2026-01-15T00:10:00Z', 'Europe/London') === '00:10', 'formatTime: midnight is 00, never 24');
  assert(formatDate('2026-09-15T23:30:00Z', 'Pacific/Auckland') === 'Wed 16 Sept', 'the zone is applied: 23:30 UTC on Tuesday is Wednesday in Auckland');
  assert(weekdayLongDayMonthLong('2026-09-15', 'UTC') === 'Tuesday 15 September', 'weekdayLongDayMonthLong: "Tuesday 15 September"');
}

const files: string[] = [];
const walk = (d: string): void => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e)) files.push(p); } };
walk('src');
expectCount('source files walked', files, COUNTS.srcTs);

console.log('\nno Intl date formatter outside lib/format.ts');
{
  const ALLOWED = 'Intl.DateTimeFormat(undefined, { timeZone: tz });'; // ClubDetailsEditForm: validates a zone name, formats nothing
  const offenders: string[] = [];
  for (const f of files) {
    if (f === 'src/lib/format.ts' || f.endsWith('database.ts')) continue;
    const src = strip(read(f));
    if (/Intl\.DateTimeFormat\(|toLocaleDateString\(|toLocaleTimeString\(/.test(src.replace(ALLOWED, ''))) offenders.push(f);
  }
  assert(offenders.length === 0, `no file but format.ts calls Intl.DateTimeFormat, toLocaleDateString or toLocaleTimeString (${offenders.join(', ') || 'none'})`);
  const validation = strip(read('src/components/ClubDetailsEditForm/ClubDetailsEditForm.tsx'));
  assert(validation.includes(ALLOWED), 'the one allowed use is the club settings form validating a zone name, in its exact form');
}

console.log('\nnumbers name their locale');
{
  const offenders = files.filter((f) => /\.toLocaleString\(\)/.test(strip(read(f))));
  assert(offenders.length === 0, `every toLocaleString passes 'en-GB' (${offenders.join(', ') || 'none'})`);
}

console.log('\na <title> is one child');
{
  const offenders: string[] = [];
  for (const f of files) {
    const src = strip(read(f));
    for (const m of src.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
      const inner = m[1]!.trim();
      // One expression (braces balanced, so a template literal with ${…}
      // inside is one), or one literal: fine. An expression beside text or
      // another expression: the server writes nothing.
      let depth = 0, exprs = 0, rest = '';
      for (const ch of inner) {
        if (ch === '{') { if (depth === 0) exprs += 1; depth += 1; }
        else if (ch === '}') depth -= 1;
        else if (depth === 0) rest += ch;
      }
      if (exprs > 1 || (exprs === 1 && rest.trim().length > 0)) offenders.push(`${f}: <title>${inner.slice(0, 60)}`);
    }
  }
  assert(offenders.length === 0, `no <title> mixes an expression with other children — React's server renderer would write it empty (${offenders.join('; ') || 'none'})`);
  assert(/<title>\{`\$\{formatDate\(b\.date, timezone\)\}: \$\{b\.value\.toFixed\(decimals\)\}`\}<\/title>/.test(read('src/components/WellnessChart/WellnessChart.tsx')), 'WellnessChart\'s bar title is one template string');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
