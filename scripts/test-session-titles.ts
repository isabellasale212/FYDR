/* Session titles: suggested while typing, normalised when compared.
 *
 * WHAT THE INVESTIGATION FOUND, since the fix only makes sense against it.
 * `session_type` was never the problem — it is a NOT NULL Postgres enum with
 * seven values and has always been separate from the title. But the Training
 * report does not group by it. "A typical session of this type" is exact string
 * equality on the free-text TITLE, so `title` is simultaneously a display name
 * a coach types and a silent join key.
 *
 * The failure is silent by construction: a typo becomes a kind of session with
 * no history, and the report renders "No other <typo> session yet — this is the
 * first on record". A misspelling reads as a finding.
 *
 * ORDER MATTERS AND IS ASSERTED. Suggestion is the primary fix because drift
 * happens at typing time. Normalisation is the net behind it and could not be
 * primary: the test below pins that "capatins" is NOT repaired by normalising,
 * which is the whole argument for doing both.
 */
import { readFileSync } from 'node:fs';
import { MIN_USES_TO_SUGGEST, normaliseTitle } from '@/lib/queries/sessionTitles';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const flat = (p: string): string => strip(read(p)).replace(/\s+/g, ' ');

const REPORT = 'src/lib/queries/trainingReport.ts';
const TITLES = 'src/lib/queries/sessionTitles.ts';

console.log('the comparison key: trim, collapse, case-fold — and nothing cleverer');
{
  assert(normaliseTitle('Conditioning') === 'conditioning', 'case-folded');
  assert(normaliseTitle('  Conditioning  ') === 'conditioning', 'trimmed');
  assert(normaliseTitle('Unit  skills') === 'unit skills', 'internal runs of whitespace collapsed');
  assert(normaliseTitle('CONDITIONING') === normaliseTitle('conditioning '), 'so these three are one key');
  assert(normaliseTitle('') === '', 'an empty title normalises to empty rather than throwing');
  assert(
    normaliseTitle("Captain's run") !== normaliseTitle('Captains run'),
    'punctuation is NOT stripped — that would also merge "Unit skills - backs" with "Unit skills backs"',
  );
  assert(
    normaliseTitle('capatins run') !== normaliseTitle("Captain's run"),
    'and a real typo is NOT repaired by normalising, which is why suggestion is the primary fix and this is the net',
  );
}

console.log('\nthe suggestion list is the club\'s vocabulary, not every string ever typed');
{
  const s = flat(TITLES);
  assert(MIN_USES_TO_SUGGEST >= 2, `a title needs ${MIN_USES_TO_SUGGEST} uses before it is offered back`);
  assert(
    /uses >= MIN_USES_TO_SUGGEST/.test(s),
    'and the threshold is applied, so a one-off typo can never be suggested as an established name',
  );
  assert(/session_type/.test(s) && /\$\{row\.session_type\}/.test(s), 'suggestions are keyed per session type');
  assert(/order\('starts_at', \{ ascending: false \}\)/.test(s), 'read newest-first, so a renamed session offers the current name');
  assert(/limit\(VOCABULARY_WINDOW\)/.test(s), 'and the org-wide read is bounded rather than unbounded');
  assert(
    /seen\.set\(key, \{ title,/.test(s),
    'the DISPLAYED spelling is the real one, not the normalised lowercase key',
  );
}

console.log('\nvariant resolution widens the filter, it does not transform the column');
{
  const s = flat(TITLES);
  assert(/\.ilike\('title', pattern\)/.test(s), 'candidates are narrowed in the database');
  assert(
    /replace\(\/\[\\\\%_\]\/g/.test(s),
    'with %, _ and \\ escaped, so a session called "50% effort" searches for itself and not for everything',
  );
  assert(
    /normaliseTitle\(row\.title\) === target/.test(s),
    'and the match is then made exactly in memory — ilike alone would be a wildcard, not a comparison',
  );
  assert(/variants\.add\(title\)/.test(s), "the caller's own spelling is always included, so an .in() is never empty");
}

console.log('\nevery place the report keyed off a title now keys off its variants');
{
  const r = flat(REPORT);
  assert(!/\.eq\('sessions\.title'/.test(r), "no .eq('sessions.title') remains");
  assert(!/\.eq\('title', trainingTitle\)/.test(r), "and no .eq('title', trainingTitle) remains");
  const ins = (r.match(/\.in\('sessions\.title'|\.in\('title'/g) ?? []).length;
  assert(ins === 7, `all seven call sites use .in() with the resolved variants (found ${ins})`);
  assert(/resolveTitleVariants/.test(r), 'and they resolve through the shared helper rather than each normalising differently');
}

console.log('\nthe title inputs offer the suggestions');
{
  for (const p of ['src/components/NewSessionForm/NewSessionForm.tsx', 'src/components/SessionEditForm/SessionEditForm.tsx']) {
    const s = flat(p);
    const name = p.split('/').pop();
    assert(/<datalist/.test(s), `${name} renders a datalist`);
    assert(/list=\{/.test(s) || /list="/.test(s), `${name} points its input at it`);
    assert(
      /titleSuggestions/.test(s),
      `${name} takes the suggestions as a prop rather than fetching them itself`,
    );
    assert(
      /\.filter\(\(t\) => t\.type === sessionType\)/.test(s),
      `${name} shows only the selected type's names — offering "Team run" for a Gym session is what gets an autocomplete ignored`,
    );
    /* Guarded on the datalist existing: slicing from indexOf(-1) yields the
       whole file and this passed on a component that had no datalist at all. */
    const at = s.indexOf('<datalist');
    assert(at !== -1 && !/readOnly|disabled=\{true\}/.test(s.slice(at)), `${name} still allows free text`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
