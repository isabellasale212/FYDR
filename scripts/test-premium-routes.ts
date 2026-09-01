/* Entitlement test for Premium-only ROUTE HANDLERS.
 *
 * CLAUDE.md §5: "Write the test for a permission rule before the rule. Access
 * control is the one area where tests are mandatory." This one is written
 * after the rule rather than before it, because the rule was missing and an
 * audit on 2026-09-01 is what found it.
 *
 * WHAT WENT WRONG, so the shape of this test makes sense: the training report
 * PAGE gated correctly on Basic, and its CSV and PDF buttons sit after that
 * early return. On Basic the buttons were never drawn, so every reader — me
 * included — concluded the exports were gated. They were not. Both routes
 * answered a bare GET with the complete per-athlete GPS board. The same shape
 * was live on the GPS import upload route, the import template, GPS
 * leaderboards and their two export routes.
 *
 * A hidden button is not a gate. This test is the mechanical version of that
 * sentence: it does not care what any screen renders.
 *
 * It is a SOURCE-LEVEL test, not a request-level one, and that limit is real —
 * it proves a route imports and calls the gate, not that the gate is correct.
 * The correctness of `isPremium`/`effectiveTier` is test-tier-preview.ts's job.
 * What this catches is the regression that actually happened: a route that
 * serves Premium data and never consults tier at all. Cheap, and it would have
 * failed on the day the training report exports shipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL - ${label}`);
  }
}

const ROOT = 'src/app/(staff)';

/** A route is Premium-serving if its source mentions one of these. Deliberately
 *  a crude signal: it should over-match, because every match must then be
 *  explicitly either gated or excused below, and a new route nobody thought
 *  about lands in neither list and fails. */
const PREMIUM_SIGNALS = /gps|trainingReport|healthkit/i;

/** Routes that serve Premium data and deliberately do NOT gate on tier. Each
 *  needs a reason, because an empty reason is how a hole gets normalised. */
const DELIBERATELY_UNGATED = new Map<string, string>([
  [
    'src/app/(staff)/settings/imports/[batchId]/export/route.ts',
    'Data portability: the route\'s own header argues a club that downgrades must ' +
      'still be able to export the GPS it already collected, rather than have it ' +
      'stranded behind the plan. A live GPS export on Basic, on purpose.',
  ],
]);

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === 'route.ts' || entry === 'route.tsx') out.push(full);
  }
  return out;
}

/** Imported, not merely mentioned. `[batchId]/export` names isPremium() in a
 *  comment explaining why it does not call it — a substring match would have
 *  read that as a gate and passed the one route that genuinely has none. */
function gatesOnTier(source: string): boolean {
  return /import\s*\{[^}]*\bisPremium\b[^}]*\}\s*from\s*'@\/lib\/tier'/.test(source) &&
    /\bisPremium\s*\(/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''));
}

const all = routeFiles(ROOT);
console.log(`\n── ${all.length} staff route handlers scanned ──`);

const premiumServing = all.filter((f) => PREMIUM_SIGNALS.test(readFileSync(f, 'utf8')));
console.log(`\n── ${premiumServing.length} of them touch GPS, the training report or Apple Health ──`);

for (const file of premiumServing) {
  const source = readFileSync(file, 'utf8');
  const excuse = DELIBERATELY_UNGATED.get(file);
  const short = file.replace(`${ROOT}/`, '');
  if (excuse) {
    assert(!gatesOnTier(source), `${short} is the documented exception and still has no tier gate`);
    assert(excuse.length > 40, `${short}'s exception carries a real reason`);
  } else {
    assert(gatesOnTier(source), `${short} imports and calls isPremium()`);
  }
}

console.log('\n── the exception list must not rot ──');
for (const file of DELIBERATELY_UNGATED.keys()) {
  assert(all.includes(file), `${file.replace(`${ROOT}/`, '')} still exists (a stale excuse hides nothing)`);
}

console.log('\n── the guard itself works ──');
assert(
  !gatesOnTier("/* isPremium() is deliberately not called here */\nawait requireStaff();"),
  'a comment mentioning isPremium() does not count as a gate',
);
assert(
  gatesOnTier("import { isPremium } from '@/lib/tier';\nif (!isPremium(tier)) return x;"),
  'a real import plus a real call does count',
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
