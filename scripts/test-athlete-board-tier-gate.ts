/* GPS leaderboards must not reach a Basic club's athletes.
 *
 * WHY THIS FILE EXISTS. Appendix A Q-29, answered 8 September 2026: nine
 * metrics sourced from gps_records are all leaderboard_eligible, GPS is
 * explicitly a Premium upsell (docs/12-product-tiers.md), and the STAFF
 * leaderboard screens gate on tier in two places — the create page filters
 * gps.* out of the catalogue, and the detail page refuses to render an existing
 * GPS board with a PlanGate whose own comment names the case it defends: a
 * board "created while the club was Premium, or inserted directly".
 *
 * Neither athlete board screen had any such check. No isPremium, no tier read,
 * no gps. prefix test — while requireAthlete() has been returning the tier all
 * along, failing closed to 'core'. So a Basic club's athletes would have seen a
 * GPS board in exactly the two situations the staff view already defended
 * against. Latent rather than live when found: production had one leaderboard, a
 * training metric, on the Premium club, and zero GPS boards on a Basic org.
 *
 * THE RULE IS NOW A FUNCTION, not a fourth hand-written copy of
 * `metric_key.startsWith('gps.') && !isPremium(tier)`. It already existed twice
 * in the staff tree and adding it twice more in the athlete tree is how the
 * three copies of the minor-age threshold happened. gpsMetricBlocked() is unit
 * tested below on real tier values rather than asserted by regex, and the two
 * athlete screens call it.
 *
 * TWO DIFFERENT REMEDIES, deliberately, mirroring what staff does:
 *   the LIST filters   — "boards I am on" already omits boards an athlete is not
 *                        on, with no greyed row for one, so a gated board should
 *                        simply not be listed. A whole-page gate would also hide
 *                        the non-GPS boards, which are on every plan.
 *   the DETAIL gates   — the board is real and the club owns it; it is the plan
 *                        that stopped including the metric. Same reasoning the
 *                        staff detail page states.
 */
import { readFileSync } from 'node:fs';
import { gpsMetricBlocked, isPremium } from '@/lib/tier';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const LIST = 'src/app/(athlete)/my-data/boards/page.tsx';
const DETAIL = 'src/app/(athlete)/my-data/boards/[leaderboardId]/page.tsx';
const list = strip(readFileSync(LIST, 'utf8'));
const detail = strip(readFileSync(DETAIL, 'utf8'));
const staffDetail = strip(readFileSync('src/app/(staff)/leaderboards/[leaderboardId]/page.tsx', 'utf8'));

console.log('the rule itself, on real tier values');
{
  assert(gpsMetricBlocked('gps.total_distance_m', 'core') === true,
    'a GPS board on a Basic club is blocked');
  assert(gpsMetricBlocked('gps.max_speed_ms', 'core') === true,
    'and so is every other gps. metric');
  assert(gpsMetricBlocked('gps.total_distance_m', 'performance') === false,
    'the same board on a Premium club is fine — this is a commercial gate, not a safety one');
  assert(gpsMetricBlocked('training.total_session_load', 'core') === false,
    'a training metric on Basic is untouched: the gate is about GPS, not about Basic');
  assert(gpsMetricBlocked('wellness.readiness_score', 'core') === false,
    'and wellness is refused a board by metric_definitions, not by this');

  /* FAILS CLOSED BY CONSTRUCTION. isPremium is an equality check against
     'performance' rather than a negation of 'core', so a tier value this build
     has never seen is treated as the lower plan. requireAthlete() also defaults
     a missing tier to 'core'. Two independent reasons an unknown plan does not
     leak GPS. */
  assert(gpsMetricBlocked('gps.player_load', 'enterprise' as never) === true,
    'an unrecognised tier is treated as Basic, so an unknown plan cannot leak GPS');
  assert(isPremium('enterprise' as never) === false,
    'because isPremium tests for performance rather than negating core');

  assert(gpsMetricBlocked('gpsx.something', 'core') === false,
    'the prefix is "gps." with the dot — a metric merely starting with gps is not matched');
}

console.log('\nboth athlete screens read the tier and use the shared rule');
{
  for (const [name, src] of [['list', list], ['detail', detail]] as const) {
    assert(/gpsMetricBlocked/.test(src), `the ${name} screen calls gpsMetricBlocked`);
    assert(/\btier\b/.test(src), `and destructures tier from requireAthlete on the ${name} screen`);
    assert(
      !/startsWith\('gps\.'\)/.test(src),
      `and does NOT hand-roll the prefix test again on the ${name} screen`,
    );
  }
}

console.log('\nthe list omits a gated board rather than gating the whole page');
{
  assert(
    /\.filter\(/.test(list) && /gpsMetricBlocked/.test(list),
    'the list filters its boards',
  );
  assert(
    !/PlanGate/.test(list),
    'and does not gate the page, which would hide the non-GPS boards too',
  );
}

console.log('\nthe detail screen refuses before it renders anything of the board');
{
  /* THE CALL, not the identifier. An earlier version of this assertion used
     indexOf('gpsMetricBlocked'), which finds the IMPORT line first — so the
     "returns early" check measured 400 characters after an import and failed on
     correct code. Third time today that an import has been mistaken for a use;
     the call site is `gpsMetricBlocked(` inside an if. */
  const gate = detail.search(/if \(gpsMetricBlocked\(/);
  assert(gate !== -1, 'the detail screen has the check, inside an if');
  for (const later of ['ranking.map', 'topN', 'formatNumber(']) {
    const at = detail.indexOf(later);
    assert(at === -1 || at > gate, `and it comes before ${later}`);
  }
  assert(
    /return \(/.test(detail.slice(gate, gate + 400)),
    'and returns early rather than falling through to the board',
  );

  /* THE ORDER, WHICH 0094 MADE LOAD-BEARING. Once the tier gate moved inside
     compute_leaderboard, a gated GPS board returns no ranking rows at all — so
     `own` is undefined for everybody, and if the !own check ran first it would
     answer "this leaderboard is not available" and the plan message would be
     dead code. Board existence, then plan, then membership. */
  const boardCheck = detail.search(/if \(!board \|\| board\.visibility/);
  const ownCheck = detail.search(/if \(!own\)/);
  assert(boardCheck !== -1 && ownCheck !== -1, 'the board and membership checks are separate');
  assert(boardCheck < gate, 'the board-exists check comes first');
  assert(
    gate < ownCheck,
    'the plan gate comes BEFORE the membership check, or 0094 makes the plan message unreachable',
  );
}

console.log('\nnothing about the staff gate regressed');
{
  assert(
    /isPremium\(tier\)/.test(staffDetail) || /gpsMetricBlocked/.test(staffDetail),
    'the staff detail page still gates GPS boards on tier',
  );
  assert(/PlanGate/.test(staffDetail), 'and still does it with a PlanGate');
  const create = strip(readFileSync('src/app/(staff)/leaderboards/new/page.tsx', 'utf8'));
  assert(
    /isPremium\(tier\)/.test(create) && /gps\./.test(create),
    'and the create page still filters gps. metrics out of the catalogue on Basic',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
