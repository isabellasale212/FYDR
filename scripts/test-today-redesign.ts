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
  /* THE NOTE IS BACK, 8 September 2026. These three assertions pinned its
     removal for one afternoon; Isabella's instruction was that no features
     should have been lost, and the staff note was one — it is the only place an
     athlete reads what medical staff actually wrote about their own
     availability, and the reference's calmer Modified row is not worth that.
     Still three separate checks, for the reason the old comment gave: an
     earlier version short-circuited and passed while the prop was declared but
     unrendered, so rendering, declaration and hand-off are checked apart. */
  assert(/\{note\}/.test(banner), 'the staff note is rendered again');
  assert(/note\?:\s*string/.test(banner), 'the prop is declared');
  assert(/note=\{/.test(page), 'and Today passes it');
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

console.log('\nthe clinical block and the session list are BACK; only the report row stayed out');
{
  /* THE CLINICAL BLOCK was the worst of the redesign's losses. Diagnosis and
     mechanism were scoped, built, age-gated by migration 0093, and confirmed
     live on production for a real athlete — and then this screen's redesign
     removed their only route, leaving component, query and database view all
     alive and unreachable. Asserted on the RENDER and the CALL, not the import,
     because an import satisfies neither. */
  assert(/<InjuryClinical/.test(page), 'the diagnosis and mechanism block renders again');
  assert(/fetchAthleteInjuryClinical\(/.test(page), 'and its query is called, not merely imported');
  /* THE SESSION LIST. The redesign's argument was that "the to-do list is the
     page's only actionable list now" — but the to-do list holds what an athlete
     owes the club, not what the club has asked of them today, and without this
     section there was no screen in the app showing when or where they train. */
  assert(/today-title/.test(page), 'and the day\'s session list is back');
  assert(/fetchAthleteDaySessions\(/.test(page), 'with the query that feeds it');
  /* The report-problem row is the one removal that stands, and it is not a lost
     feature: /report-problem is reachable from Me's settings card. */
  assert(!/report-problem/.test(page), 'the report row stays out, its route reachable from Me');
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
