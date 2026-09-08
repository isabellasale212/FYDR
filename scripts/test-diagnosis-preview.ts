/* The diagnosis preview: a local-only look at one clinical field, before Tier 2.
 *
 * WHAT THIS IS. Isabella wants to see diagnosis-only on her own screen, against
 * Adam Selby's real record, before deciding whether that is the right level of
 * detail to put in front of a player. It is deliberately NOT Tier 2: no age
 * gate, no mechanism, and no route of its own. It is a temporary window with
 * four independent locks on it.
 *
 * WHY FOUR LOCKS AND NOT ONE. This is the first code in the repository that
 * puts a clinical field on an athlete's screen, and the thing being previewed is
 * precisely the thing not yet approved. One flag read the wrong way in a
 * deployed environment is a disclosure, so the gate refuses unless ALL of:
 *
 *   1. NODE_ENV is not production   — a Vercel build sets it, so this alone
 *                                     stops it there
 *   2. FYDR_PREVIEW_DIAGNOSIS is 1  — explicit opt-in, off even locally
 *   3. the Supabase URL names scratch
 *   4. and does not name production — separately, because "names scratch" would
 *                                     pass a string carrying both, and "not
 *                                     production" passes a typo naming neither
 *
 * Locks 3 and 4 are the ones that matter if the others are ever wrong: a local
 * build pointed at the production database refuses regardless of NODE_ENV.
 *
 * AND THE QUERY SELECTS ONE COLUMN. injury_clinical_athlete_view exposes seven.
 * Isabella's decision is that imaging and the detailed treatment plan are held
 * back, so the test asserts the columns NOT selected — asserting that diagnosis
 * appears would pass just as well if all seven were fetched.
 */
import { readFileSync } from 'node:fs';
import { diagnosisPreviewEnabled } from '@/lib/diagnosisPreview';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const SCRATCH = 'https://stfgzkuvczbpxyevxkak.supabase.co';
const PROD = 'https://asbxorjytxsvrzefwzqp.supabase.co';
const on = {
  NODE_ENV: 'development',
  FYDR_PREVIEW_DIAGNOSIS: '1',
  NEXT_PUBLIC_SUPABASE_URL: SCRATCH,
};

console.log('every lock holds on its own');
{
  assert(diagnosisPreviewEnabled(on) === true, 'all four conditions met: the preview is on');

  assert(
    diagnosisPreviewEnabled({ ...on, NODE_ENV: 'production' }) === false,
    'a production build refuses it, whatever the flag says',
  );
  assert(
    diagnosisPreviewEnabled({ ...on, FYDR_PREVIEW_DIAGNOSIS: undefined }) === false,
    'and it is off unless explicitly asked for',
  );
  assert(
    diagnosisPreviewEnabled({ ...on, FYDR_PREVIEW_DIAGNOSIS: 'true' }) === false,
    "'true' is not '1' — the value is exact, so a stray truthy string does not open it",
  );
  assert(
    diagnosisPreviewEnabled({ ...on, NEXT_PUBLIC_SUPABASE_URL: PROD }) === false,
    'THE ONE THAT MATTERS: a local dev build pointed at production refuses',
  );
  assert(
    diagnosisPreviewEnabled({ ...on, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }) === false,
    'and a URL naming neither project refuses too, rather than defaulting to allowed',
  );
  assert(
    diagnosisPreviewEnabled({ ...on, NEXT_PUBLIC_SUPABASE_URL: undefined }) === false,
    'as does no URL at all',
  );
  assert(diagnosisPreviewEnabled({}) === false, 'an empty environment is closed');
}

console.log('\nthe refs match the ones the scratch guard already enforces');
{
  /* Duplicated constants drift. The shell scripts guard themselves with
     scripts/lib/scratch-guard.mjs, which a Next server module cannot import, so
     the values are repeated in src — and pinned here, the same way the SQL and
     TypeScript role orderings are pinned to each other. */
  const guard = readFileSync('scripts/lib/scratch-guard.mjs', 'utf8');
  const src = readFileSync('src/lib/diagnosisPreview.ts', 'utf8');
  for (const ref of ['stfgzkuvczbpxyevxkak', 'asbxorjytxsvrzefwzqp']) {
    assert(guard.includes(ref) && src.includes(ref), `${ref} is the same string in both files`);
  }
}

console.log('\none column, and the six that are held back are named as held back');
{
  const src = strip(readFileSync('src/lib/diagnosisPreview.ts', 'utf8'));
  const select = /\.select\(\s*'([^']*)'\s*\)/.exec(src)?.[1] ?? '';
  assert(select !== '', `the query has a select (saw "${select}")`);
  assert(/\bdiagnosis\b/.test(select), 'diagnosis is fetched');
  for (const held of ['mechanism', 'severity', 'tissue_type', 'imaging', 'referral', 'treatment_plan']) {
    assert(!select.includes(held), `${held} is NOT fetched`);
  }
  assert(!src.includes('*'), 'and there is no select star anywhere in the module');
  assert(
    !src.includes('clinical_notes'),
    'clinical_notes is not even reachable — the view withholds it, and this does not ask',
  );
}

console.log('\nthe query cannot be called past the gate by a future caller');
{
  const src = strip(readFileSync('src/lib/diagnosisPreview.ts', 'utf8'));
  const fnAt = src.indexOf('export async function fetchDiagnosisPreview');
  assert(fnAt !== -1, 'the fetch exists');
  const body = src.slice(fnAt);
  assert(
    /diagnosisPreviewEnabled\(/.test(body.slice(0, 400)),
    'and re-checks the gate itself rather than trusting its caller',
  );
}

console.log('\nthe banner stays clinical-free, so Tier 2 has a boundary to move');
{
  const banner = strip(readFileSync('src/components/AvailabilityBanner/AvailabilityBanner.tsx', 'utf8'));
  for (const field of ['diagnosis', 'mechanism', 'imaging', 'treatment_plan']) {
    assert(!banner.includes(field), `AvailabilityBanner still never mentions ${field}`);
  }
  const today = strip(readFileSync('src/app/(athlete)/today/page.tsx', 'utf8'));
  const gateAt = today.indexOf('diagnosisPreviewEnabled');
  const fetchAt = today.indexOf('fetchDiagnosisPreview');
  assert(gateAt !== -1 && fetchAt !== -1, 'Today reaches the preview through the gate and the fetch');
  assert(gateAt < fetchAt, 'and asks the gate before it asks the database');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
