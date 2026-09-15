/* A flag's rule sentence tells "gone" from "not yours to read" —
 * decision-batch-2026-09-15.md #2 (Isabella, 15 Sept 2026).
 *
 * The nutritionist cannot read thresholds (X on the matrix's Thresholds row;
 * thresholds_staff_select, migration 0068, admits the other four staff
 * roles). fetchThresholds therefore returns nothing to them under RLS, and
 * the profile's flag panel read an empty result as deletion: every flag on
 * every athlete told the nutritionist "The threshold this flag was raised
 * under is no longer on record." The rule was on record. Same class as the
 * audit log claiming it was blind when it was not.
 *
 * Pinned: THRESHOLD_VIEW in access.ts mirrors the policy's four roles; the
 * profile query takes the viewer's ability to read thresholds and says
 * "gone" only to a role that could have read it; the page passes the real
 * answer; the evidence line follows the same split. */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const access = read('src/lib/access.ts');
const profile = strip(read('src/lib/queries/playerProfile.ts'));
const page = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
const policy = read('supabase/migrations/0068_single_role_policies.sql');

console.log('THRESHOLD_VIEW is the database\'s own list');
{
  const m = access.match(/export const THRESHOLD_VIEW = \[([^\]]*)\] as const;/);
  const roles = [...(m?.[1] ?? '').matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
  const pol = policy.slice(policy.indexOf('create policy thresholds_staff_select'));
  const polRoles = [...(pol.slice(0, pol.indexOf(';')).match(/ARRAY\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
  assert(roles.length === 4 && roles.join(',') === polRoles.join(','), `THRESHOLD_VIEW = thresholds_staff_select's roles (${roles.join(', ')})`);
  assert(!roles.includes('nutritionist'), 'and the nutritionist is not among them');
}

console.log('\nthe profile says "gone" only to a role that could have read it');
{
  assert(/viewerReadsThresholds: boolean,\s*\): Promise<PlayerProfile \| null>/.test(profile), 'fetchPlayerProfile takes viewerReadsThresholds');
  assert(/threshold\s*\?\s*describeThreshold\(threshold\)\s*:\s*viewerReadsThresholds\s*\?\s*'The threshold this flag was raised under is no longer on record\.'\s*:\s*'The rule this flag was raised under is not shown to your role\.'/.test(profile),
    'the rule sentence: the real sentence, else "no longer on record" for a reader, else "not shown to your role"');
  assert(/evidenceLine\(threshold, f\.flag_date, timezone, viewerReadsThresholds\)/.test(profile), 'the evidence line is told the same');
  assert(/if \(!threshold\) return viewerReadsThresholds \? `No threshold on record · \$\{flagged\}\.` : /.test(profile), 'and says "No threshold on record" only to a reader');
  assert(!/'The threshold this flag was raised under is no longer on record\.'[\s\S]*'The threshold this flag was raised under is no longer on record\.'/.test(profile), 'the "gone" sentence appears once, behind the check');
}

console.log('\nthe page passes the real answer');
{
  assert(/hasAnyRole\(claims\.roles, THRESHOLD_VIEW\),?\s*\);/.test(page) && /fetchPlayerProfile\(/.test(page), 'the athlete page passes hasAnyRole(claims.roles, THRESHOLD_VIEW)');
  assert(/THRESHOLD_VIEW/.test(page.match(/import \{[^}]*\} from '@\/lib\/access';/)?.[0] ?? ''), 'imported from access.ts, not restated');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
