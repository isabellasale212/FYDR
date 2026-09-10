/**
 * §0v: the gym correction panel promises "My data marks the day corrected and
 * shows what you first reported", and until this landed My data did neither.
 *
 * WHY A SOURCE TEST AND NOT A RENDER TEST. The promise is made in one file and
 * kept in two others, and the failure mode was exactly that drift — the copy
 * shipped, the display never did. These assertions bind the three together, so
 * removing the marker without removing the promise fails here.
 *
 * WHY THE AUTHOR LINE IS ASSERTED TO BE DIFFERENT FROM WELLNESS. Wellness and
 * RPE can only be corrected by staff, so their panel says "Corrected by a
 * member of staff" when the author is unknown. A gym set is corrected by the
 * ATHLETE THEMSELVES in the common case (ATH-ADULT-11 is an athlete flow), so
 * that fallback would be a false statement about who changed the number. The
 * gym marker therefore never claims an author it does not know.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');

/** Source with comments removed. The "never claims an author" assertion below has to
 *  test what RENDERS, not what the file mentions — the first version of it failed on
 *  the comment that explains why the fallback is absent, which is the opposite of the
 *  thing being guarded. */
const withoutComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const QUERIES = read('src/lib/queries/entryRevisions.ts');
const DETAIL  = read('src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx');
const LOGGER  = read('src/components/GymSessionLogger/GymSessionLogger.tsx');

console.log('\nthe promise that started this is still in the product');
assert(
  /My data marks the day corrected and shows what you\s*\n?\s*first reported/.test(LOGGER),
  'the logger panel still makes the promise (if this fails, check the display is not now orphaned)',
);

console.log('\nthe chain read exists and reads the BASE table, not the _current view');
assert(
  /export async function fetchGymSetRevisionChains/.test(QUERIES),
  'fetchGymSetRevisionChains is exported',
);
assert(
  /\.from\('gym_set_logs'\)/.test(QUERIES),
  "it reads gym_set_logs, the base table — the _current view cannot show a superseded row",
);
assert(
  !/from\('gym_set_logs_current'\)[\s\S]{0,200}revision_of/.test(QUERIES),
  'and does not try to walk a chain through the _current view',
);

console.log('\nthe detail page shows the marker and the original values');
assert(/Corrected/.test(DETAIL), 'the session detail renders a "Corrected" marker');
assert(
  /What you reported/.test(DETAIL),
  'and the "What you reported:" lead-in that the promise names',
);
assert(
  /fetchGymSetRevisionChains/.test(DETAIL),
  'sourced from the chain read rather than re-deriving it',
);

console.log('\nit never claims an author it does not know');
assert(
  !/a member of staff/.test(withoutComments(DETAIL)),
  'no "a member of staff" fallback — an athlete corrects their own gym sets, so that would be false',
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
