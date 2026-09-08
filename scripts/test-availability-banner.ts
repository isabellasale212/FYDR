/* What an injured athlete is told about their own injury, on Today.
 *
 * WHAT THIS FILE IS FOR. The athlete already saw their availability status and
 * restrictions — that part has worked since the banner was written, and a
 * report claiming otherwise was wrong. What they were not told is WHICH injury,
 * WHAT STAGE of recovery, and WHEN they are expected back. The first two were
 * being fetched on every Today load and discarded; the third was one column
 * short of being fetched at all.
 *
 * THE RISK RUNS IN TWO DIRECTIONS HERE, unlike the staff injury card whose only
 * risk is disclosure:
 *
 *   1. Telling an AVAILABLE athlete about an injury they are not restricted by.
 *      Availability and injury are separate records — somebody can be fully
 *      available with an old injury still open on file — so the injury line has
 *      to sit inside the same `status !== 'available'` guard the rest of the
 *      banner already respects. Asserted below.
 *   2. Telling them NOTHING, which is the failure this change exists to fix.
 *      Also asserted, because a guard that is too tight passes every test that
 *      only checks for absence.
 *
 * NO CLINICAL DETAIL IS IN SCOPE. body_area, side, onset, expected_return and
 * the injury's own status come from `injuries`, which the athlete may read in
 * full (`injuries_self_select`). Diagnosis and mechanism are Tier 2 and are
 * asserted ABSENT here, so this change cannot quietly become that one.
 */
import { readFileSync } from 'node:fs';
import { bodyAreaPhrase, upcomingDate } from '@/lib/format';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const banner = readFileSync('src/components/AvailabilityBanner/AvailabilityBanner.tsx', 'utf8');
const bannerCode = strip(banner);
const today = strip(readFileSync('src/app/(athlete)/today/page.tsx', 'utf8'));
const availability = strip(readFileSync('src/lib/queries/availability.ts', 'utf8'));

console.log('the injury is named the way a physio says it, and the same way their coach reads it');
{
  /* Shared with the staff injury card rather than copied. Two spellings of
     "Left hamstring" is the softest kind of parity break: no number is wrong,
     and an athlete asking a coach about a different phrase to the one on the
     coach's screen is exactly the confusion this app exists to remove. */
  assert(bodyAreaPhrase({ body_area: 'shoulder', side: 'right' }) === 'Right shoulder',
    'a sided injury reads "Right shoulder"');
  assert(bodyAreaPhrase({ body_area: 'hamstring', side: 'left' }) === 'Left hamstring',
    'and "Left hamstring"');
  assert(bodyAreaPhrase({ body_area: 'hamstring', side: 'bilateral' }) === 'Bilateral hamstring',
    'bilateral is a side like any other');
  assert(bodyAreaPhrase({ body_area: 'head', side: null }) === 'Head',
    'an unsided injury is just "Head" — no empty word where the side would go');
  assert(bodyAreaPhrase({ body_area: 'lower_back', side: null }) === 'Lower back',
    'and the enum underscore never reaches the screen');
  assert(
    readFileSync('src/components/InjuryCard/InjuryCard.tsx', 'utf8').includes('bodyAreaPhrase')
      && !/function bodyAreaPhrase/.test(readFileSync('src/components/InjuryCard/InjuryCard.tsx', 'utf8')),
    'the staff card uses the shared one rather than keeping its own copy',
  );
}

console.log('\nan AVAILABLE athlete is told about no injury at all');
{
  /* The banner already returns "Everything is on." for an available athlete
     before it reads restrictions or reason. The injury has to live under the
     same guard: availability and injury are separate records, and somebody can
     be training fully with an injury still open on file. */
  const guard = bannerCode.indexOf("status === 'available'");
  assert(guard !== -1, 'the available check is still the first thing the banner does');

  /* READS, not identifiers. An earlier version of this test searched for the
     bare words and failed on the import line and the props destructure — both
     of which necessarily come first and neither of which renders anything. What
     matters is where the injury's DATA is touched: `injury.` property accesses
     and `bodyAreaPhrase(` calls. Measuring the name instead of the use is the
     same mistake as grepping a folder instead of following the import. */
  const reads = [
    ...bannerCode.matchAll(/injury\.[a-z_]+/g),
    ...bannerCode.matchAll(/bodyAreaPhrase\(/g),
  ].map((m) => m.index ?? -1);
  assert(reads.length >= 4, `the injury's data is actually read (saw ${reads.length} reads)`);
  assert(
    reads.every((at) => at > guard),
    'and every read of it happens after the available check, so a cleared player sees none of it',
  );
  assert(
    /status !== 'available'[\s\S]{0,900}bodyAreaPhrase/.test(bannerCode),
    'and the injury block sits inside the not-available branch',
  );
}

console.log('\nnor anything else left over from when they were not available');
{
  /* THE NOTE HAS THE SAME PROBLEM reason_category already had, and the banner
     already guards that one. A note is written against the availability row it
     belongs to, and an athlete who is cleared gets a NEW row — but nothing
     forces whoever writes it to clear the text, and on scratch one of the 34
     available rows reads "Live-verification: flu, off this week." A player who
     is training fully should not read that directly under "Everything is on.",
     and three more available rows carry a leftover reason_category, which is
     the same shape and is why the existing guard exists.

     Measured as READS, for the reason given above: the prop name appears in the
     type and the destructure long before any guard, and neither renders. */
  const guard = bannerCode.indexOf("status === 'available'");
  /* `{note}` — the render itself. An earlier pattern here also matched `note?`
     in the Props type, which is an optional-property marker and not a read, so
     it reported a use before the guard that does not exist. Declarations are
     not uses; this is the same distinction as the injury reads above. */
  const noteReads = [...bannerCode.matchAll(/\{note\}/g)].map((m) => m.index ?? -1);
  assert(noteReads.length > 0, 'the note is still rendered for somebody');
  assert(
    noteReads.every((at) => at > guard),
    'but never before the available check',
  );
  assert(
    /status !== 'available'[\s\S]{0,400}\{note\b|note\s*&&[\s\S]{0,80}status !== 'available'|status !== 'available' && note/.test(bannerCode),
    'and only inside the not-available branch, the same guard reason_category already has',
  );
}

console.log('\nbut an unavailable one is told which injury, what stage, and when they are back');
{
  assert(/bodyAreaPhrase\(/.test(bannerCode), 'the body area is rendered');
  assert(/injury\.status|injuryStatus/.test(bannerCode), 'the recovery stage is rendered');
  assert(/expected_return/.test(bannerCode), 'and the expected return date');
  assert(
    /enumLabel\(injury\.status\)|enumLabel\(\s*injury\.status\s*\)/.test(bannerCode),
    'the stage goes through enumLabel, so "return_to_play" never reaches a player as an enum',
  );
}

console.log('\nthe edges, which is where a banner like this actually breaks');
{
  /* The date is now guarded by upcomingDate rather than a bare truthiness
     check, and upcomingDate returns null for a null date as well as a past one
     — so the same one guard covers both edges. Asserted as "the raw column is
     never handed to formatDate outside that check", which is the property that
     actually stops "Invalid Date" reaching a phone. */
  assert(
    /upcomingDate\(injury\.expected_return[\s\S]{0,120}\?[\s\S]{0,120}formatDate\(injury\.expected_return/.test(bannerCode),
    'the date is only formatted inside the upcomingDate check, which also covers null',
  );
  assert(
    /injury\s*\?|injury\s*&&|injury\s*!=\s*null|injury\s*!==\s*null/.test(bannerCode),
    'and the whole block is guarded, because an athlete can be unavailable for a non-injury reason',
  );
}

console.log('\nan expected return date is shown only while it is still ahead');
{
  /* FOUND BY RENDERING IT. Every one of the six open injuries carrying an
     expected_return on scratch has a date in the PAST — between 9 and 31 days
     ago. Adam Selby's head injury reads "Expected return Sun 9 Aug" on the 8th
     of September.

     A date a month gone is not information, it is either a club that has not
     updated the record or an app that looks broken, and on a concussion it
     reads as pressure to be back already. So a past date is not shown: the line
     degrades to "Head · Return to play", which is exactly what it would have
     been had the date never been fetched. The STAFF card still shows it
     unconditionally, so the club can still see the record is stale — the person
     who cannot act on it is the one who stops being told. */
  assert(upcomingDate('2026-09-20', '2026-09-08') === '2026-09-20', 'a future date survives');
  assert(upcomingDate('2026-09-08', '2026-09-08') === '2026-09-08', 'and today counts as ahead — they are due back today');
  assert(upcomingDate('2026-08-09', '2026-09-08') === null, 'a past date is dropped');
  assert(upcomingDate(null, '2026-09-08') === null, 'and null stays null');
  assert(
    upcomingDate('2026-10-01', '2026-09-30') === '2026-10-01'
      && upcomingDate('2026-09-30', '2026-10-01') === null,
    'the comparison is on the ISO string, which orders correctly across a month boundary',
  );
  assert(/upcomingDate\(/.test(bannerCode), 'and the banner uses it rather than rendering the raw column');
}

console.log('\nno clinical detail, which is Tier 2 and a separate decision');
{
  for (const field of ['diagnosis', 'mechanism', 'severity', 'imaging', 'referral', 'treatment_plan', 'clinical_notes']) {
    assert(!bannerCode.includes(field), `the banner never renders ${field}`);
  }
  assert(
    !today.includes('injury_clinical_athlete_view'),
    'and Today does not read the clinical view',
  );
}

console.log('\nthe data actually reaches the component');
{
  assert(
    /<AvailabilityBanner[\s\S]{0,400}injury=\{/.test(today),
    'today/page.tsx passes the injury it was already fetching and throwing away',
  );
  assert(
    /\.select\(\s*'[^']*\bstatus\b[^']*'\s*\)/.test(
      availability.slice(availability.indexOf('fetchOpenInjuries')),
    ),
    'and fetchOpenInjuries selects status, without which there is no stage to show',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
