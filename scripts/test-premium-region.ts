/* Premium contents (decision batch 2026-09-13, "Premium contents and the
 * match report", 14 September; built 15 September): the three rulings and
 * the plan page. D-20 has two halves — a wholly premium DESTINATION
 * disappears (analytics: test-analytics-panels §7), a premium REGION inside
 * a base page shows a card and never vanishes silently or reads zero. */
import { readFileSync } from 'node:fs';
import { GPS_FLAG_PLAN_NOTE, GPS_REGION_BODY, GPS_REGION_NOTE, GPS_REGION_PDF, flagDomainWord } from '@/lib/premiumWords';

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

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
