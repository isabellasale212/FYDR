/* Today, rebuilt from the redesign screenshots (01 and 02).
 *
 * FIVE CHANGES, and the one that matters most is what SURVIVES them.
 *
 *   1. The week card loses its accent tint and becomes a plain surface.
 *   2. "Working towards" becomes a full-width row, name and date left.
 *   3. The Modified card becomes a compact row: status dot, "Modified", one
 *      restriction line, "Speak to medical staff."
 *   4. The Diagnosis / How it happened block is removed from this screen.
 *   5. The "Today" session list and the "Something not right?" row are removed.
 *
 * TIER 1 IS KEPT, on Isabella's explicit instruction of 2026-09-08 after the
 * cost was put to her. The reference row drops it, and dropping it would have
 * taken an athlete back to knowing they are restricted without knowing which
 * injury or when they are back — and would have made that afternoon's
 * correction of six stale return dates on both databases pointless. So the
 * injury line stays: body area, recovery stage, and the expected return date
 * when it is still ahead. Asserted below, because the reference argues against
 * it and a later reader working from the screenshots would remove it.
 *
 * WHAT IS DELIBERATELY NOT BUILT: the chevrons. The reference draws one on
 * Working towards and one on Modified, and there is no athlete route either
 * could open — no injury screen, no fixture screen. A chevron with no
 * destination is a control that lies about being one, so both rows are built
 * without. When an injury detail screen exists, the chevron is the small part.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const page = strip(readFileSync('src/app/(athlete)/today/page.tsx', 'utf8'));
const banner = strip(readFileSync('src/components/AvailabilityBanner/AvailabilityBanner.tsx', 'utf8'));
const css = readFileSync('src/styles/base.css', 'utf8');

console.log('the week card is a plain surface');
{
  const rule = /\.wk-card\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(rule !== '', '.wk-card still exists');
  assert(!/--wash-accent/.test(rule), 'no accent tint');
  assert(!/background:/.test(rule), 'and no background override at all, so it inherits .card');
}

console.log('\n"Working towards" is one full-width row');
{
  assert(/wk-towards/.test(page), 'the row is still rendered');
  const rule = /\.wk-towards\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert(/display:\s*flex/.test(rule), 'laid out as a row');
  assert(/align-items/.test(rule), 'with its content aligned rather than stacked');
  assert(!/wk-towards-chev|chev/.test(/\.wk-towards[\s\S]{0,600}/.exec(page)?.[0] ?? ''),
    'and carries no chevron, because no fixture screen exists to open');
}

console.log('\nthe Modified row is compact: dot, status, one restriction line, one instruction');
{
  assert(/avail-ring/.test(banner), 'the status dot survives');
  assert(/state\.label/.test(banner), 'and the status word');
  assert(/restrictions/.test(banner), 'and the restriction line');
  assert(
    /Speak to medical staff\./.test(banner),
    'the instruction reads "Speak to medical staff."',
  );
  assert(
    !/Everything else is on\./.test(banner),
    'and no longer opens with "Everything else is on." — the reference drops it',
  );
  assert(!/\{note\}/.test(banner), 'the staff note is no longer rendered');
  /* AND THE PROP IS GONE, not merely unrendered. The first version of this
     assertion was `!/note\?:/ || !/\{note\}/`, which short-circuits on the
     second clause and passed while the prop was still declared — tsc caught the
     dead prop that this test did not. Two separate checks, both required. */
  assert(!/note\?:\s*string/.test(banner), 'the prop is removed from the component');
  assert(!/note=\{/.test(page), 'and the page no longer passes it');
}

console.log('\nTIER 1 SURVIVES, which the reference argues against');
{
  assert(/bodyAreaPhrase\(/.test(banner), 'the injury is still named');
  assert(/injury\.status/.test(banner), 'the recovery stage is still shown');
  assert(/expected_return/.test(banner), 'and the expected return date');
  assert(/upcomingDate\(/.test(banner), 'still suppressed when the date has passed');
  const guard = banner.indexOf("status === 'available'");
  const reads = [...banner.matchAll(/injury\.[a-z_]+/g)].map((m) => m.index ?? -1);
  assert(reads.length > 0 && reads.every((at) => at > guard),
    'and every read of it still sits behind the available check');
}

console.log('\nthe clinical block, the session list and the report row are gone from Today');
{
  assert(!/InjuryClinical/.test(page), 'no diagnosis block');
  assert(!/fetchAthleteInjuryClinical/.test(page), 'and its query is not left running');
  assert(!/today-title/.test(page), 'no "Today" session list');
  assert(!/report-card/.test(page), 'no "Something not right?" row');
  assert(!/report-problem/.test(page), 'and no link to it from this screen');
}

console.log('\nthe to-do list is still the page\'s actionable list');
{
  assert(/todo-title/.test(page), 'the to-do section survives');
  assert(/todoItems/.test(page), 'and its items');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
