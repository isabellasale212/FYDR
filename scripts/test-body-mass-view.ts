/* STAFF-SS-02-05 C9 — decided by Isabella 2026-09-12 (Q27 of the
 * data-architecture briefing): the coach does not see body mass at all —
 * the section as well as the three buttons. One set in lib/access.ts,
 * BODY_MASS_VIEW, resolved from the session's roles (never a client value),
 * and every staff surface that renders a body mass reads it:
 *
 *   the athlete profile's Body weight card (section, sparkline, buttons)
 *   the athlete nutrition page's Body mass card
 *   the wellness export's body-mass column, and the body composition export
 *
 * Hiding UI is the courtesy; the coach can still read wellness rows at the
 * database (the athlete's own check-in carries the field), which is
 * recorded on the decision sheet as the remaining half if the club wants
 * the column gated at RLS.
 */
import { readFileSync } from 'node:fs';
import { BODY_MASS_VIEW, WEIGH_IN_EDIT, hasAnyRole } from '@/lib/access';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the set');
{
  assert(!hasAnyRole(['coach'], BODY_MASS_VIEW), 'a single-role coach may not view body mass');
  assert(hasAnyRole(['coach', 'sport_scientist'], BODY_MASS_VIEW), 'a coach who is also a sport scientist may — roles are unions');
  for (const r of ['sport_scientist', 'strength_conditioning', 'nutritionist', 'medic'] as const) {
    assert(hasAnyRole([r], BODY_MASS_VIEW), `${r} may view body mass`);
  }
  assert(WEIGH_IN_EDIT.every((r) => (BODY_MASS_VIEW as readonly string[]).includes(r)), 'everyone who may log a weigh-in may see one');
}

console.log('\nthe surfaces');
{
  const profile = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
  assert(/const canSeeBodyMass = hasAnyRole\(claims\.roles, BODY_MASS_VIEW\);/.test(profile), 'the profile resolves it from the session');
  assert(/\{canSeeBodyMass \? \(\s*<section className="card pp-card" aria-labelledby="pp-weight-title">/.test(profile), 'the whole Body weight section is absent for the coach — no heading, no lock, no buttons');
  assert(/weightDisplay=\{\s*!canSeeBodyMass \? null :/.test(profile) && /weightDisplay !== null \? \(/.test(strip(read('src/components/PlayerProfileBio/PlayerProfileBio.tsx'))), "the bio's Weight cell is absent for the coach too");
  const nutrition = strip(read('src/app/(staff)/squad/[athleteId]/nutrition/page.tsx'));
  assert(/\.\.\.\(canSeeBodyMass\s*\? \[\s*summarisePositional\(athleteId, massInWindow/.test(nutrition), "and the positional Body mass row");
  assert(/hasAnyRole\(ctx\.claims\.roles, BODY_MASS_VIEW\)/.test(nutrition) && /\{canSeeBodyMass \? \(\s*<section className="card pp-card" aria-labelledby="n-mass-title">/.test(nutrition), 'the athlete nutrition page\'s Body mass card likewise');
  const exp = strip(read('src/app/(staff)/settings/exports/generate/route.ts'));
  assert(/const canSeeBodyMass = hasAnyRole\(claims\.roles, BODY_MASS_VIEW\);/.test(exp), 'the export route resolves it too');
  assert(/\.\.\.\(canSeeBodyMass \? \(\[\['body_mass_kg', 'Body mass \(kg\)'\]\]/.test(exp) && /body_mass_kg: canSeeBodyMass \? \(r\.body_mass_kg \?\? ''\) : ''/.test(exp), 'the wellness export drops the body-mass column for a coach');
  assert(/key === 'body_composition' && !canSeeBodyMass/.test(exp) || /body_composition[\s\S]{0,300}canSeeBodyMass/.test(exp), 'and the body composition export is refused to a coach');
}

console.log('\nthe specs');
{
  const matrix = read('docs/access-matrix.md');
  assert(/Body mass \(weigh-ins/.test(matrix) && /BODY_MASS_VIEW/.test(matrix), 'access-matrix.md carries the row and the set');
  const spec = read('docs/screens/03-athlete-profile.md');
  assert(/coach does not see body mass/i.test(spec) || /coach sees no body mass/i.test(spec), '03-athlete-profile.md says the coach sees no body mass');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
