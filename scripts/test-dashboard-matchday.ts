/* The dashboard's matchday label.
 *
 * TWO HARDCODES, AND THE WORSE ONE IS NOT THE FALLBACK. The eyebrow read
 * `readiness.opponent ? 'MD SATURDAY · V ...' : 'MD SATURDAY'` — so a club with
 * no fixture at all was told its matchday was Saturday, which is invented. But
 * the branch WITH a fixture said Saturday too, whatever day the match was
 * actually on: Ashcombe's real Bristol Bears fixture is a Tuesday, and the
 * dashboard has been calling it Saturday. The card title below it,
 * "Ready for Saturday", had the same fault while its own subtitle correctly
 * said "No fixture scheduled". And the week strip's MD-1 alert made three:
 * "Last session before Saturday", shown on Ashcombe's MONDAY, one day before a
 * Tuesday fixture.
 *
 * Found by creating an empty organisation with create-org.ts and looking at its
 * dashboard — the fallback is only visible to a club that has no fixtures,
 * which until today no real account could be.
 *
 * The weekday now comes from the fixture's own kickoff, formatted in the org's
 * timezone. SaturdayReadiness dropped that value after using it to compute
 * daysOut, so it is carried through rather than re-fetched.
 */
import { readFileSync } from 'node:fs';
import { matchdayWeekday } from '@/lib/format';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const PAGE = 'src/app/(staff)/dashboard/page.tsx';
const QUERY = 'src/lib/queries/dashboard.ts';

console.log('the weekday comes from the fixture, not from a guess');
{
  /* The two fixtures really on scratch. The first is the one the dashboard has
     been mislabelling. */
  assert(matchdayWeekday('2026-09-08T19:30:00.000Z', 'Europe/London') === 'Tuesday', 'Bristol Bears, 20:30 BST, is a Tuesday');
  assert(matchdayWeekday('2026-09-12T13:00:00.000Z', 'Europe/London') === 'Saturday', 'ashfield rfc, 14:00 BST, is a Saturday');
  assert(matchdayWeekday(null, 'Europe/London') === null, 'no fixture yields no weekday, rather than a default one');
  assert(matchdayWeekday('nonsense', 'Europe/London') === null, 'and an unparseable instant yields none either');
}

console.log('\nthe timezone is the org\'s, not the server\'s');
{
  /* Midday UTC on a Tuesday is still Tuesday afternoon in London and already
     midnight Wednesday in Auckland (UTC+12 in September). If both returned the
     same day the label would be formatting in one fixed zone, and the whole
     point of storing timestamptz and displaying in the org's own zone would be
     lost right here.

     The first attempt used 23:30 UTC and asserted London was Tuesday — wrong,
     because London is UTC+1 in September, so 23:30 UTC is already 00:30
     Wednesday there. The test was wrong, not the code. */
  const utcInstant = '2026-09-08T12:00:00.000Z';
  assert(matchdayWeekday(utcInstant, 'Europe/London') === 'Tuesday', 'that instant is Tuesday in London');
  assert(matchdayWeekday(utcInstant, 'Pacific/Auckland') === 'Wednesday', 'and Wednesday in Auckland — the zone is applied');
}

console.log('\nthe readiness query carries the kickoff through');
{
  const q = strip(read(QUERY));
  assert(/kickoffAt: string \| null;/.test(q), 'SaturdayReadiness has kickoffAt');
  assert(
    /kickoffAt: fixture\?\.kickoff_at \?\? null/.test(q.replace(/\s+/g, ' ')),
    'populated from the fixture it already fetched, not a second read',
  );
}

console.log('\nnothing on the dashboard says Saturday any more');
{
  const p = strip(read(PAGE));
  assert(!/MD SATURDAY/.test(p), "the eyebrow's hardcoded 'MD SATURDAY' is gone");
  assert(!/Ready for Saturday/.test(p), "and so is the card's 'Ready for Saturday'");
  assert(/matchdayWeekday\(/.test(p), 'both now derive the day from the kickoff');
  assert(
    /readiness\.kickoffAt/.test(p),
    'reading the value the query carries rather than re-deriving it from daysOut',
  );
}

console.log('\nthe week strip names the same day, and there were THREE of these');
{
  const q = strip(read(QUERY));
  assert(!/Last session before Saturday/.test(q), "the strip's 'Last session before Saturday' is gone");
  assert(
    /Last session before \$\{matchdayName \?\? 'matchday'\}/.test(q),
    'it names the real day, and says "matchday" when the week has none',
  );
  assert(
    /anchoredMd\.entries\(\)[\s\S]{0,80}off === 0/.test(q),
    'the day comes from the offset-0 date the anchoring already computed, not a fourth source',
  );
}

console.log('\na club with no fixture is told nothing rather than something wrong');
{
  const p = strip(read(PAGE)).replace(/\s+/g, ' ');
  assert(
    /matchday \? ` \u00b7 MD \$\{matchday\.toUpperCase\(\)\}/.test(p),
    'the MD segment is conditional on there being a matchday at all',
  );
  assert(
    /'Squad readiness'/.test(p) || /Squad readiness/.test(p),
    'and the card falls back to a neutral title rather than naming a day it does not have',
  );
  assert(
    /No fixture scheduled/.test(p),
    'while the subtitle that already said so is left alone',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
