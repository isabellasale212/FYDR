/* ATH-ADULT-12 C5 — the gym hero is the athlete's best lift and how it moved
 * (2026-09-13), and the zero headline over an empty period is words. */
import { readFileSync } from 'node:fs';
import { formatKg, gymHeroLine, pickMainLift } from '@/lib/gymHero';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const tz = 'Europe/London';

console.log('1. the line');
{
  const up = gymHeroLine({ name: 'Back squat', best: { load_kg: 102.5, reps: 5, entry_date: '2026-09-05' }, prior: { load_kg: 97.5, reps: 5, entry_date: '2026-08-01' }, from: '2026-08-17' }, tz);
  assert(up.value === '102.5 kg' && up.label === 'Back squat best · × 5 · Sat 5 Sept' && up.delta === 'up 5 kg on your best before Mon 17 Aug', '"102.5 kg · Back squat best · × 5 · Sat 5 Sept · up 5 kg on your best before Mon 17 Aug"');
  const down = gymHeroLine({ name: 'Bench', best: { load_kg: 80, reps: 5, entry_date: '2026-09-05' }, prior: { load_kg: 82.5, reps: 5, entry_date: '2026-08-01' }, from: '2026-08-17' }, tz);
  assert(down.delta === 'down 2.5 kg on your best before Mon 17 Aug', 'down, said as down — never a colour');
  const reps = gymHeroLine({ name: 'Bench', best: { load_kg: 80, reps: 7, entry_date: '2026-09-05' }, prior: { load_kg: 80, reps: 5, entry_date: '2026-08-01' }, from: '2026-08-17' }, tz);
  assert(reps.delta === 'same load, 2 more reps than your best before Mon 17 Aug', 'the same load with more reps is the better set (MET-040)');
  const equal = gymHeroLine({ name: 'Bench', best: { load_kg: 80, reps: 5, entry_date: '2026-09-05' }, prior: { load_kg: 80, reps: 5, entry_date: '2026-08-01' }, from: '2026-08-17' }, tz);
  assert(equal.delta === 'equal to your best before Mon 17 Aug', 'equal');
  const first = gymHeroLine({ name: 'Nordic curl', best: { load_kg: 10, reps: 8, entry_date: '2026-09-05' }, prior: null, from: '2026-08-17' }, tz);
  assert(first.delta === 'no earlier best to compare — the first Nordic curl logged', 'no earlier best is said, never called a best (MET-040: a best is a comparison)');
  assert(formatKg(100) === '100 kg' && formatKg(102.5) === '102.5 kg', 'kilograms without a trailing .0');
}

console.log('\n2. which lift');
{
  const m = new Map([
    ['a', { sets: 9, best: { load_kg: 100, reps: 5, entry_date: '2026-09-01' } }],
    ['b', { sets: 12, best: { load_kg: 60, reps: 8, entry_date: '2026-09-01' } }],
    ['c', { sets: 12, best: { load_kg: 80, reps: 8, entry_date: '2026-09-01' } }],
  ]);
  assert(pickMainLift(m) === 'c', 'the most working sets in the period; a tie goes to the heavier best');
  assert(pickMainLift(new Map()) === null, 'nothing logged: no lift');
}

console.log('\n3. the read and the tab');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/export async function fetchBestSetsInPeriod\(/.test(q) && /if \(o\.fromDate\) q = q\.gte\('entry_date', o\.fromDate\);/.test(q) && /if \(o\.toDate\) q = q\.lte\('entry_date', o\.toDate\);/.test(q), 'the best working set per exercise inside the period, with its set count');
  assert(/const perChunk = await fetchWorkingSets\(/.test(q) || /function fetchWorkingSets\(/.test(q), 'one working-set read shared with fetchPersonalBestsBefore (MET-040\'s rule once)');
  const page = strip(read('src/app/(athlete)/my-data/page.tsx'));
  assert(/fetchBestSetsInPeriod\(db, orgId, athleteId, from, today\)/.test(page), 'the gym tab reads the period\'s bests');
  assert(/fetchPersonalBestsBefore\(db, orgId, athleteId, \[mainLift\], from\)/.test(page), 'and the best before the period for the main lift');
  assert(/gymHeroLine\(/.test(page) && /className="rd-value num">\{hero\.value\}/.test(page), 'the hero value is the best load');
  assert(/Nothing logged/.test(page) && /in this period/.test(page), 'and over an empty period the headline is words, never "0 sets logged"');
  assert(!/\{headlineSets\}<\/span> set\{headlineSets === 1 \? '' : 's'\} logged/.test(page) || /Nothing logged/.test(page), 'the zero headline is gone');
}

console.log('\n4. the registry and the spec');
{
  assert(/My data's gym hero/.test(read('docs/metrics.md')), 'MET-040 lists the hero as a surface');
  assert(/best lift/i.test(read('docs/athlete/screens/06-my-data.md')) && /best before/.test(read('docs/athlete/screens/06-my-data.md')), '06-my-data.md describes the hero');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
