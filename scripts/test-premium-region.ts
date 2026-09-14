/* Premium contents (decision batch 2026-09-13, "Premium contents and the
 * match report", 14 September; built 15 September): the three rulings and
 * the plan page. D-20 has two halves — a wholly premium DESTINATION
 * disappears (analytics: test-analytics-panels §7), a premium REGION inside
 * a base page shows a card and never vanishes silently or reads zero. */
import { readFileSync } from 'node:fs';
import { GPS_FLAG_PLAN_NOTE, GPS_REGION_BODY, GPS_REGION_NOTE, GPS_REGION_PDF, PREMIUM_INVENTORY, PRICE_PLACEHOLDER, flagDomainWord } from '@/lib/premiumWords';
import { retentionConsequence } from '@/lib/retentionWords';
import { RETENTION_SCHEDULE } from '@/lib/retention/schedule';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

console.log('1. the athlete report\'s GPS region on Basic: a card, never silent, never zero');
{
  const page = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/<PlanGateCard\s+heading="GPS, this period"\s+body=\{GPS_REGION_BODY\}/.test(page), 'the Load page\'s GPS section is a PlanGateCard on Basic');
  assert(/\{isPremium\(tier\) \? \(\s*<div className="ath-stats"/.test(page) && /data-gps-plan-note/.test(page) && /\{GPS_REGION_NOTE\}/.test(page), 'the summary Load card\'s GPS stats row is one line on Basic — never "0 m"');
  assert(/withheld on the Basic plan/.test(GPS_REGION_BODY) && /Nothing here is zero/.test(GPS_REGION_BODY) && /Settings › Plan/.test(GPS_REGION_BODY) && /Settings › Plan/.test(GPS_REGION_NOTE), 'the words: the plan named, zero denied, the one place to learn more');
  const pdf = strip(read('src/app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx'));
  assert(/<PdfSectionTitle title="GPS, this period" caption=\{GPS_REGION_PDF\} \/>/.test(pdf) && /not included on the Basic plan/.test(GPS_REGION_PDF), 'the PDF names the section and its absence');
}

console.log('\n2. a downgraded club\'s GPS flags carry a plan note on the domain word');
{
  assert(flagDomainWord('GPS', 'gps', false) === GPS_FLAG_PLAN_NOTE && flagDomainWord('GPS', 'gps', true) === 'GPS' && flagDomainWord('Wellness', 'wellness', false) === 'Wellness', 'GPS on Basic: the note; GPS on Premium and every other domain: the word');
  assert(/dormant on the Basic plan/.test(GPS_FLAG_PLAN_NOTE) && !/kept|history/.test(GPS_FLAG_PLAN_NOTE), 'the note says the rule is dormant; the kept-history sentence belongs to the plan page, not the flag');
  const card = strip(read('src/components/FlagCard/FlagCard.tsx'));
  assert(/data-flag-domain>\{flagDomainWord\(enumLabel\(flag\.domain\), flag\.domain, premium\)\}/.test(card) && /premium = true,/.test(card), 'the Flags screen\'s card takes the plan and draws the word from it');
  const profile = strip(read('src/components/PlayerProfileFlags/PlayerProfileFlags.tsx'));
  assert(/\{flagDomainWord\(enumLabel\(flag\.domain\), flag\.domain, premium\)\}/.test(profile), 'so does the profile\'s Flags card');
  assert(/premium=\{isPremium\(tier\)\}/.test(strip(read('src/app/(staff)/flags/page.tsx'))) && /premium=\{isPremium\(tier\)\}/.test(strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'))), 'both pages pass the club\'s real plan, resolved on the server');
}

console.log('\n3. the plan page: the one place, the inventory, the price placeholder, the kept sentence');
{
  const page = strip(read('src/app/(staff)/settings/plan/page.tsx'));
  assert(/await refuse\(db, 'plan', '\/settings\/plan'\)/.test(page) && /SETTINGS_ADMIN/.test(page), 'the sport scientist\'s; everyone else is refused');
  assert(PREMIUM_INVENTORY.length === 7 && PREMIUM_INVENTORY.map((i) => i.label).join(' · ') === 'GPS import · GPS report · GPS on the athlete report · GPS leaderboards · GPS flags and thresholds · Analytics · Named support', 'the inventory: the GPS import and everything downstream, Analytics, named support');
  assert(/PREMIUM_INVENTORY\.map/.test(page) && /PREMIUM_INVENTORY\.map/.test(strip(read('src/app/(staff)/settings/club/page.tsx'))), 'the page and the club card read the one list');
  assert(/not yet decided/.test(PRICE_PLACEHOLDER) && !/£|\$|\d/.test(PRICE_PLACEHOLDER) && /data-placeholder="price"/.test(page) && /className="legal-pending"/.test(page), 'the price is a placeholder drawn as one — never a number');
  assert(/rpc\('premium_history_kept'\)/.test(page) && /are kept\. They are hidden from every screen while the club is on Basic and return with Premium/.test(page) && /This club holds no GPS records\./.test(page), 'the kept-history sentence, from the definer read, with the no-history case in words');
  assert(/Kept does not mean kept forever/.test(page) && /href="\/settings\/retention"/.test(page), 'and that kept is not forever, pointing at retention');
  assert(/action', 'org\.tier\.changed'/.test(page), 'when the plan last changed, from the audit row');
  const hub = strip(read('src/lib/settingsHub.ts'));
  assert(/href: o\.isAdmin \? '\/settings\/plan' : null/.test(hub) && /'Sport scientist only'/.test(hub), 'the hub\'s Plan row opens the page for the sport scientist and is closed with its reason for everyone else');
  assert(/href="\/settings\/plan"/.test(strip(read('src/components/PlanGate/PlanGate.tsx'))), 'the PlanGate pages send "See what Premium contains" to the page');
  assert(!/analytics bar chart|metric builder/.test(strip(read('src/app/(staff)/settings/club/page.tsx'))), 'the club card no longer describes a product that does not exist');
}

console.log('\n4. the three gaps (0126)');
{
  const mig = read('supabase/migrations/0126_premium_plan_page_and_gaps.sql').replace(/^\s*--.*$/gm, '');
  assert(/create trigger organisations_tier_audit\s+after update of tier on public\.organisations/.test(mig) && /'org\.tier\.changed'/.test(mig) && /jsonb_build_object\('from', old\.tier, 'to', new\.tier\)/.test(mig), 'a tier flip writes org.tier.changed {from, to}');
  assert(/alter table public\.gps_records add column deleted_at timestamptz/.test(mig), 'gps_records.deleted_at');
  for (const p of ['gps_records_staff_select', 'gps_records_self_select', 'gps_records_staff_update']) {
    const i = mig.indexOf(`create policy ${p}`);
    assert(i >= 0 && /deleted_at is null/.test(mig.slice(i, mig.indexOf(';', i))), `${p} filters retired rows at the row`);
  }
  assert(/and g\.deleted_at is null\s+and g\.record_date between p_from and p_to/.test(mig) && (mig.match(/and g\.deleted_at is null/g) ?? []).length >= 2, 'analytics_daily_rows and compute_leaderboard filter them themselves');
  assert(/create or replace function public\.premium_history_kept\(\)/.test(mig) && /array\['sport_scientist'\]/.test(mig) && /g\.deleted_at is null/.test(mig), 'premium_history_kept: the sport scientist, live rows, on any plan');
  const run = strip(read('src/lib/retention/compute.ts'));
  assert(/\.from\('gps_records'\)\s*\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/.test(run) && /gpsRecordsRetired/.test(run) && !/from\('gps_records'\)\.delete\(/.test(run), 'the run retires GPS rows past the cutoff — soft, never a hard delete');
  assert(RETENTION_SCHEDULE.find((r) => r.category === 'GPS records')!.automated === true, 'the schedule says GPS is automated here');
  const preview = { orgId: 'o', computedAt: '', athletes: { total: 0, current: 0, names: [] }, categories: [
    { category: 'Import batch raw files (30 days)', count: 0, cutoffDescription: '', automated: true },
    { category: 'Injury clinical detail (8 years from closure, longer if under 18)', count: 0, cutoffDescription: '', automated: true },
    { category: 'GPS records (current + 3 completed seasons)', count: 412, cutoffDescription: '', automated: true },
  ] };
  assert(retentionConsequence(preview).lead === "Running now will retire 412 GPS records older than the club's three kept seasons. This cannot be undone." && retentionConsequence(preview).runnable, 'the consequence names the GPS count and Run is armed by it');
  assert(/gps_records_retired: result\.gpsRecordsRetired/.test(strip(read('src/app/(staff)/settings/retention/run/route.ts'))), 'the retention.run audit row carries the count');
  assert(/\.is\('deleted_at', null\)\.order\('id'\)/.test(strip(read('src/lib/queries/sarPackAssembly.ts'))), 'the SAR pack skips retired rows');
  const t = read('supabase/tests/810_premium_plan_page_and_gaps_test.sql');
  assert(/keep and hide has a date/.test(t) && /cannot resurrect it/.test(t) && /the one-place sentence/.test(t) && /the service role sees both/.test(t), 'tested: the audit row, the row filter, the update refusal, the definer reads, the sentence on any plan');
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
