/* The RPE package, change two (Isabella, 2026-09-13): the session rating
 * prompt is one tap on Today — a row carrying the CR-10 grid itself, no
 * sheet, no submit button. This pins the row, its words and what it does
 * not do (no radios, no auto-advance, no duration typed). */
import { readFileSync } from 'node:fs';
import { rpeRatedLine, rpeSentLine } from '@/lib/todayRows';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the row');
{
  const row = strip(read('src/components/TodayRpeRow/TodayRpeRow.tsx'));
  assert(/CR10_SCALE\.map\(/.test(row) && /className="cr10-row"/.test(row) && /className="cr10"/.test(row), 'the row draws the rating screen\'s own CR-10 cells');
  assert(/<button[\s\S]*?type="button"[\s\S]*?className="cr10-row"/.test(row) && !/type="radio"/.test(row), 'buttons, not radios — a selection here is the submission');
  assert(/onClick=\{\(\) => rate\(step\)\}/.test(row) && /submit\.mutate\(parsed\.data\)/.test(row), 'one tap sends');
  assert(!/type="submit"/.test(row) && !/Submit rating/.test(row), 'no submit button');
  assert(/duration_min: durationMin/.test(row) && !/setDuration|<input/.test(row), 'the duration is the session\'s scheduled minutes, never typed');
  assert(/enqueueTraining\(input\)/.test(row) && /dequeueTraining\(input\.id\)/.test(row), 'the same outbox path as the form');
  assert(/disabled=\{done && !selected\}/.test(row) && /if \(rated !== null \|\| durationMin === null\) return;/.test(row), 'the other cells are disabled the moment a tap lands (the double-submit guard)');
  assert(!/router\.push|router\.refresh|useRouter/.test(row), 'no auto-advance: the row becomes its own receipt and stays');
  assert(/aria-live=\{done \? 'polite' : undefined\}/.test(row), 'the receipt is announced');
  const outbox = strip(read('src/lib/outbox.ts'));
  assert(/export const OUTBOX_CHANGED_EVENT = 'fydr-outbox-changed'/.test(outbox) && /window\.dispatchEvent\(new Event\(OUTBOX_CHANGED_EVENT\)\)/.test(outbox), 'the outbox announces every write on this window');
  assert(/window\.addEventListener\(OUTBOX_CHANGED_EVENT, check\)/.test(row) && /pendingTraining\(\)\.some\(\(p\) => p\.input\.id === entryId\)/.test(row), 'and a waiting receipt turns into Sent when its entry leaves the outbox, whoever sent it');
  assert(/Rate on the next screen/.test(row) && /change or add a note/.test(row), 'a session with no scheduled length hands over; the screen stays reachable for minutes and a note');
  const ok = ['sent', 'waiting', 'sending'].map((s) => rpeSentLine(s as 'sent'));
  assert(rpeRatedLine('Team run', 7) === 'Team run rated 7 · Hard' && rpeRatedLine(null, 0) === 'Training rated 0 · Rest', 'the receipt names the session, the number and its anchor');
  assert(/^Sent\./.test(ok[0]!) && /tell your coach/.test(ok[0]!) && /Waiting to send/.test(ok[1]!) && /saved on this phone/.test(ok[1]!), 'sent and waiting are said, and the correction path');
}

console.log('\n2. on Today');
{
  const page = strip(read('src/app/(athlete)/today/page.tsx'));
  /* 16 Sept 2026 (1.1): the check-in and nutrition rows are status cards
     (TodoStatusCard, a Link while there is something to do); the rating
     rows keep the grid. */
  assert(/<TodayRpeRow/.test(page) && /rpeItems\.map\(/.test(page) && /<TodoStatusCard/.test(page), 'a rating row renders the grid; check-in and nutrition are the status cards');
  assert(/entryDate=\{dateInTz\(new Date\(item\.session\.starts_at\), timezone\)\}/.test(page), 'the entry date is the session\'s club-local day — the rating screen\'s rule');
  assert(/durationMin=\{item\.session\.duration_min\}/.test(page), 'the scheduled minutes come from the session');
  const screen = strip(read('src/app/(athlete)/rpe/[sessionId]/page.tsx'));
  assert(/<RpeForm/.test(screen), 'the screen keeps its form for minutes and a note, deep links and the closed states');
}

console.log('\n3. the specs');
{
  const today = read('docs/athlete/screens/01-today.md');
  assert(/One tap sends/.test(today) && /A number on the rating row/.test(today) && /no auto-advance/.test(today), '01-today.md: §4 and §6 carry the row');
  assert(/this screen is not the prompt/.test(read('docs/athlete/screens/03-session-rating.md')), '03-session-rating.md: the screen is the long form, not the prompt');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
