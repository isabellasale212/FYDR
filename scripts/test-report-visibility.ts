/* G-30, closed 2026-09-06: who may open which report.
 *
 * TWO INDEPENDENT ASSERTIONS PER REPORT, the same shape test-silent-saves uses
 * and for the same reason — either alone leaves the bug reachable:
 *
 *   1. The HUB gates each card from REPORT_VISIBILITY. This is the visible half.
 *   2. The PAGE and every one of its export/pdf routes gate on the same key.
 *      This is the half that matters, because the hub is a list of links and
 *      the URLs are guessable. The bug being fixed here is precisely a hub that
 *      disagreed with the pages it linked to.
 *
 * Source-level, and it says so: it proves the gates name the right set and that
 * no door is left ungated. That RLS agrees is settled in supabase/tests, and
 * for the nutritionist's injury view specifically in 330_nutritionist_injury_
 * view_test.sql, which is the assertion that actually matters for D-01. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_VISIBILITY, type ReportKey } from '@/lib/access';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const BASE = 'src/app/(staff)/reports';
const EXPECTED: Record<ReportKey, string[]> = {
  compliance: ['sport_scientist', 'coach', 'medic', 'strength_conditioning', 'nutritionist'],
  injuries:   ['sport_scientist', 'coach', 'medic', 'strength_conditioning', 'nutritionist'],
  training:   ['sport_scientist', 'coach', 'medic', 'strength_conditioning'],
  athlete:    ['sport_scientist', 'coach', 'medic', 'strength_conditioning'],
  squad:      ['sport_scientist', 'coach', 'medic', 'strength_conditioning'],
  testing:    ['sport_scientist', 'coach', 'medic', 'strength_conditioning'],
};

console.log('the grid says what the decision says');
for (const key of Object.keys(EXPECTED) as ReportKey[]) {
  const got = [...REPORT_VISIBILITY[key]].sort().join(',');
  const want = [...EXPECTED[key]].sort().join(',');
  assert(got === want, `${key}: ${EXPECTED[key].join(', ')}`);
}

console.log('\nthe nutritionist sees two reports and not the other four');
const nutritionistSees = (Object.keys(EXPECTED) as ReportKey[]).filter((k) => REPORT_VISIBILITY[k].includes('nutritionist'));
assert(nutritionistSees.sort().join(',') === 'compliance,injuries', `exactly compliance and injuries, got ${nutritionistSees.join(', ') || 'none'}`);

console.log('\nthe S&C sees every report, same set as the coach');
for (const key of Object.keys(EXPECTED) as ReportKey[]) {
  const sc = REPORT_VISIBILITY[key].includes('strength_conditioning');
  const coach = REPORT_VISIBILITY[key].includes('coach');
  assert(sc === coach, `${key}: S&C matches coach (${coach ? 'both open' : 'both closed'})`);
}

/* Every door, not just the page. An ungated export route is the whole bug in a
   different file. */
console.log('\nevery report page and every export/pdf route gates on its own key');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(BASE).filter((f) => /\.(tsx?|ts)$/.test(f) && f !== join(BASE, 'page.tsx'));
const routeFiles = files.filter((f) => /\/(page\.tsx|route\.tsx?|route\.ts)$/.test(f));
for (const f of routeFiles) {
  const rel = f.slice(BASE.length + 1);
  const key = rel.split('/')[0] as ReportKey;
  const src = readFileSync(f, 'utf8');
  assert(src.includes(`requireReport('${key}')`), `${rel} gates on '${key}'`);
  assert(!/requireReportAccess\(\)/.test(src), `${rel} no longer uses the blanket gate`);
}

console.log('\nthe hub resolves from the grid, not from a hand-written role list');
const hub = readFileSync(join(BASE, 'page.tsx'), 'utf8');
/* Comments stripped before the negative assertions. The file's header now
   describes the check it replaced, quoting it, and a scan that cannot tell code
   from prose reads that description as the bug still being present. Getting
   this wrong in the other direction would be worse than a failing test: it
   would pressure the next person to delete the explanation to make the suite
   go green. */
const hubCode = hub.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert(hub.includes('REPORT_VISIBILITY'), 'the hub reads REPORT_VISIBILITY');
assert(!/roles\.includes\('coach'\)/.test(hubCode), "the hand-written coach||medic check is gone");
assert(!/Not available to admin/.test(hubCode), 'the card text no longer names a role that does not exist');
assert(!/aggregate compliance and usage/i.test(hubCode), 'the stale admin note is gone');
assert(/aggregate compliance and usage|coach.*medic/is.test(hub), 'and the header still records what it replaced');

/* The load-bearing claim of the whole change: the injury report cannot reach a
   diagnosis, so admitting a role to it is not a redaction decision. If this ever
   becomes false, the nutritionist's access becomes a leak in the same commit. */
console.log('\nthe injury report still cannot reach a diagnosis');
for (const f of walk('src/app/(staff)/reports/injuries').concat(['src/lib/queries/reports.ts', 'src/lib/queries/availability.ts'])) {
  if (!/\.(tsx?|ts)$/.test(f)) continue;
  const src = readFileSync(f, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/from\('injury_clinical'\)/.test(code), `${f} does not select injury_clinical`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
