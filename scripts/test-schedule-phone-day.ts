/* PATTERN-S4 C6 / B4 — the phone schedule is day-first (2026-09-13). The
 * board: "No grid at 375px. The dashboard's strip carries the week at 74px a
 * tile: day, date, MD offset, minutes. Five fit, seven scroll, and today is
 * the selected tile. Below it the day is a list, and each session row is
 * the tap target at 44px or more. There is no Read/Edit control on the
 * phone — the day list is read until you tap into something." B4 maps the
 * board's bar tokens onto what the shell already uses. Forms stay pages
 * (protected): the day heading's + opens /schedule/new for that day.
 *
 * The day's sentences are pure (lib/schedulePhoneDay.ts); the component,
 * the workspace and the CSS are read from source. */
import { readFileSync } from 'node:fs';
import { dayHeadMeta, dayStep, nextSessionLine, phoneDayDefault, rowMeta } from '@/lib/schedulePhoneDay';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const css = strip(read('src/styles/base.css'));
const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'];

console.log('1. the selected day: today when the week holds it, else the first day');
{
  assert(phoneDayDefault(days, '2026-09-10') === '2026-09-10', 'today is the selected tile');
  assert(phoneDayDefault(days, '2026-09-20') === '2026-09-07', 'a past or future week opens on Monday');
}

console.log('\n2. the day heading\'s meta and a row\'s meta');
{
  assert(dayHeadMeta({ mdOffset: -2, sessions: 1, minutes: 80 }) === 'MD-2 · 1 session · 80 minutes', '"MD-2 · 1 session · 80 minutes"');
  assert(dayHeadMeta({ mdOffset: null, sessions: 0, minutes: 0 }) === 'Nothing scheduled', 'an empty day says so — never "0 sessions · 0 minutes"');
  assert(dayHeadMeta({ mdOffset: 0, sessions: 2, minutes: 160 }) === 'MD · 2 sessions · 160 minutes', 'matchday, plural');
  assert(rowMeta({ location: 'Main pitch', mins: 80, groupNames: ['Backs', 'Forwards'], expected: 27 }) === 'Main pitch · 80 min · Backs and Forwards · 27 expected', '"Main pitch · 80 min · Backs and Forwards · 27 expected"');
  assert(rowMeta({ location: null, mins: 60, groupNames: [], expected: 0 }) === 'Location not set · 60 min · Staff only', 'no location, no group: said');
  assert(rowMeta({ location: 'Gym', mins: 45, groupNames: ['Rehab'], expected: 1 }) === 'Gym · 45 min · Rehab · 1 expected', 'one group');
}

console.log('\n3. the next session after the selected day');
{
  const sessions = [
    { id: 'a', dow: '2026-09-10', start: 9.5, title: 'Contact prep' },
    { id: 'b', dow: '2026-09-11', start: 10, title: "Captain's run" },
    { id: 'c', dow: '2026-09-12', start: 15, title: 'v Colthorne RFC' },
  ];
  const next = nextSessionLine(sessions, '2026-09-10', 'Europe/London');
  assert(next !== null && next.id === 'b' && next.text === "Fri 11 Sept · Captain's run · 10:00", '"Fri 11 Sept · Captain\'s run · 10:00" — the first session on a later day of the week');
  assert(nextSessionLine(sessions, '2026-09-12', 'Europe/London') === null, 'nothing later in the week: no line');
  assert(nextSessionLine([{ id: 'x', dow: '2026-09-11', start: 8 }, { id: 'y', dow: '2026-09-11', start: 7.5, title: 'Early' }], '2026-09-10', 'Europe/London')?.id === 'y', 'the earliest on that day, not the first in the list');
}

console.log('\n4. the component and the workspace');
{
  const c = strip(read('src/components/ScheduleGrid/SchedulePhoneDay.tsx'));
  /* THE DAY ONLY since 16 Sept 2026 (Isabella's overnight queue, 2.1): the
     seven-tile strip is gone — no week view at phone width — and the day
     heading is a stepper, inside the loaded week as state and across its
     edge as a navigation with the day in the address. */
  assert(!/className="sg-phone-strip"/.test(c) && !/role="tablist"/.test(c), 'no week strip on the phone (16 Sept 2026)');
  assert(/dayStep\(dates, day, -1\)/.test(c) && /dayStep\(dates, day, 1\)/.test(c) && /aria-label=\{label\}/.test(c), 'the day heading steps a day at a time');
  assert(/step\.inWeek \? \(/.test(c) && /href=\{`\$\{dayHrefPrefix\}\$\{step\.date\}\$\{dayHrefSuffix\}`\}/.test(c), 'inside the week a step is state; across its edge it is a link to that week with ?date=');
  assert(dayStep(days, '2026-09-08', -1).inWeek && dayStep(days, '2026-09-08', -1).date === '2026-09-07', 'Tuesday back is Monday, in the week');
  assert(!dayStep(days, '2026-09-07', -1).inWeek && dayStep(days, '2026-09-07', -1).date === '2026-09-06', 'Monday back is the Sunday before, another week');
  assert(!dayStep(days, '2026-09-13', 1).inWeek && dayStep(days, '2026-09-13', 1).date === '2026-09-14', 'Sunday forward is the Monday after');
  assert(phoneDayDefault(days, '2026-09-10', '2026-09-12') === '2026-09-12', 'a day asked for in the address opens on that day');
  assert(/className="sg-phone-row"/.test(c) && /href=\{`\/schedule\/\$\{s\.id\}`\}/.test(c), 'a saved session row is a link to its page');
  assert(/s\.isNew \|\| s\.edited/.test(c) && /Held on this screen/.test(c), 'a held (unpublished) row says so instead of linking — the phone has no editor');
  assert(/href=\{`\/schedule\/new\?date=\$\{day\}`\}/.test(c) && /aria-label=\{`Add a session on/.test(c), 'the + on the day heading opens the new-session PAGE for that day (forms stay pages)');
  assert(/href=\{`\/schedule\/fixtures\/\$\{f\.id\}`\}/.test(c), 'a fixture is a row too');
  assert(/Nothing else on \{/.test(c) || /Nothing on \{/.test(c), '"Nothing on Thursday." when the day is empty');
  assert(/<span className="sg-phone-next-k">Next<\/span>/.test(c), 'the Next line');
  const ws = strip(read('src/components/ScheduleGrid/ScheduleWorkspace.tsx'));
  assert(/<SchedulePhoneDay/.test(ws) && /days=\{dayColumns\}/.test(ws) && /sessions=\{effective\}/.test(ws), 'the workspace draws it from the same day columns and effective sessions the grid uses');
  assert(/<div className="sg-desktop">\s*<TimeGrid/.test(ws) || /className="sg-desktop"/.test(ws), 'the grid and its panels are the desktop half');
}

console.log('\n5. the CSS: no grid at 375, 74px tiles, 44px rows');
{
  const phone = css.slice(css.indexOf('.sg-phone {'), css.indexOf('.sg-phone {') + 4000);
  assert(/@media \(max-width: 767px\)\s*\{\s*\.sg-desktop,\s*\.sg-segmented\s*\{[^}]*display:\s*none/.test(css), 'below 768px the grid, its panels and the Read/Edit control are not drawn');
  assert(/@media \(min-width: 768px\)[\s\S]{0,300}\.sg-phone\s*\{[^}]*display:\s*none/.test(css), 'and the day view is phone-only');
  assert(!/\.sg-phone-strip\s*\{/.test(css) && !/\.sg-phone-tile\s*\{/.test(css), 'the strip and its tiles are gone from the stylesheet (16 Sept 2026)');
  assert(/\.sg-phone-daynav-btn\s*\{[^}]*width:\s*(?:44px|var\(--tap-min\))[^}]*min-height:\s*(?:44px|var\(--tap-min\))/.test(css), 'the day arrows are 44px');
  const pb = css.slice(css.indexOf(".main .rhead-chips[aria-label='Filter by squad group']"));
  assert(/\.main \.sg-weeknav,[\s\S]{0,200}\.main \.sg-viewtabs,\s*\.main \.sg-toolbar\s*\{\s*display:\s*none/.test(pb.slice(0, 600)), 'below 768 the chip row, the week arrows, the view tabs and the toolbar are not drawn (2.1)');
  assert(/\.sg-phone-row\s*\{[^}]*min-height:\s*(?:44px|var\(--tap-min\))/.test(phone), 'a row is at least 44px');
  assert(/\.sg-phone-add\s*\{[^}]*min-height:\s*(?:44px|var\(--tap-min\))[^}]*min-width:\s*(?:44px|var\(--tap-min\))/.test(phone) || /\.sg-phone-add\s*\{[^}]*min-width:\s*(?:44px|var\(--tap-min\))[^}]*min-height:\s*(?:44px|var\(--tap-min\))/.test(phone), 'the + is 44px');
}

console.log('\n6. the spec');
{
  const spec = read('docs/screens/07-schedule.md');
  assert(/day-first/.test(spec) && /no grid/i.test(spec) && /day only/i.test(spec), '07-schedule.md describes the phone day view, the day only since 16 Sept 2026');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
