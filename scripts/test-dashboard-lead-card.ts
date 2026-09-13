/* STAFF-SS-01 C2 — the matchday lead card (2026-09-13). The board's pattern:
 * "The matchday card is the one emphasised card. The lead keeps 'Ready for
 * {matchday}' with doubtful and ruled out. No other dashboard card may take
 * the emphasised treatment. With no fixture inside 14 days the week card
 * takes the emphasis and the matchday card is absent, not empty." And data
 * rule 6, literally: status and restriction for everyone; the reason only
 * for the medic, non-clinical reasons without the Medical label.
 *
 * The sentence rules are pure (lib/dashboardLead.ts) and exercised here with
 * rows; the read, the page and the CSS are read from source. */
import { readFileSync } from 'node:fs';
import { HEAVY_MORNING_ATHLETES, leadSubLine, leadTitle, restrictionStatusLine, selectionReasonLine, weekStripYields } from '@/lib/dashboardLead';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const css = strip(read('src/styles/base.css'));
const card_ = (): string => strip(read('src/components/DashboardLeadCard/DashboardLeadCard.tsx'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('1. the title and the sub line');
{
  assert(leadTitle({ opponent: 'Colthorne RFC', kickoffAt: '2026-09-12T14:00:00Z', homeAway: 'home' }, 'Europe/London') === 'v Colthorne RFC · Sat 12 Sept, 15:00 · home', '"v Colthorne RFC · Sat 12 Sept, 15:00 · home" — club time');
  assert(leadTitle({ opponent: 'Colthorne RFC', kickoffAt: '2026-09-12T14:00:00Z', homeAway: null }, 'Europe/London') === 'v Colthorne RFC · Sat 12 Sept, 15:00', 'without a venue when none is recorded');
  assert(leadSubLine({ withStatus: 27, squadTotal: 30, daysOut: 5 }) === '27 of 30 have a current status · 3 not recorded · MD in 5 days', 'the denominator says who is counted: "27 of 30 have a current status · 3 not recorded · MD in 5 days"');
  assert(leadSubLine({ withStatus: 30, squadTotal: 30, daysOut: 0 }) === '30 of 30 have a current status · matchday', 'everyone recorded, and matchday itself is "matchday"');
  assert(leadSubLine({ withStatus: 29, squadTotal: 30, daysOut: 1 }) === '29 of 30 have a current status · 1 not recorded · MD tomorrow', 'one not recorded; MD tomorrow');
  assert(leadSubLine({ withStatus: 0, squadTotal: 0, daysOut: 3 }) === 'No athletes in this filter · MD in 3 days', 'an empty filter says so, never 0 of 0');
}

console.log('\n2. one line per athlete: the status word and the restriction, never the reason');
{
  assert(restrictionStatusLine('modified', ['running and gym only', 'no contact']) === 'Modified · running and gym only, no contact', '"Modified · running and gym only, no contact"');
  assert(restrictionStatusLine('unavailable', []) === 'Unavailable · not available for selection', 'ruled out with no restriction line: "not available for selection"');
  assert(restrictionStatusLine('modified', []) === 'Modified · no restriction recorded', 'modified with none recorded says so');
}

console.log('\n3. the reason line is the medic\'s, and non-clinical reasons carry no Medical label');
{
  const clinical = selectionReasonLine({ reason: 'injury', note: null, diagnosis: 'Grade 1 left hamstring strain', bodyArea: 'hamstring', side: 'left' });
  assert(clinical.text === 'Grade 1 left hamstring strain' && clinical.clinical === true, 'an injury with a diagnosis: the diagnosis, marked clinical');
  const noDx = selectionReasonLine({ reason: 'injury', note: null, diagnosis: null, bodyArea: 'calf', side: 'right' });
  assert(noDx.text === 'Right calf · no diagnosis recorded' && noDx.clinical === true, 'an injury without one: the site, and that none is recorded — still clinical');
  const academic = selectionReasonLine({ reason: 'academic', note: 'away on placement until Mon 14 Sept', diagnosis: null, bodyArea: null, side: null });
  assert(academic.text === 'Academic — away on placement until Mon 14 Sept' && academic.clinical === false, '"Academic — away on placement…" without the Medical label');
  const bare = selectionReasonLine({ reason: 'personal', note: null, diagnosis: null, bodyArea: null, side: null });
  assert(bare.text === 'Personal' && bare.clinical === false, 'a bare non-clinical category');
  const none = selectionReasonLine({ reason: null, note: null, diagnosis: null, bodyArea: null, side: null });
  assert(none.text === 'No reason recorded' && none.clinical === false, 'no reason at all is said, not blank');
}

console.log('\n4. the read carries what the card needs');
{
  const q = strip(read('src/lib/queries/dashboard.ts'));
  assert(/squadTotal: number;/.test(q) && /withStatus: number;/.test(q) && /notRecorded: number;/.test(q), 'the readiness read counts athletes with a status, the squad, and the difference');
  assert(/const notRecorded = notFully\.filter\(\(r\) => r\.status === 'unknown'\)\.length;/.test(q), '"not recorded" is the unknown rows, counted, not subtracted');
  assert(/export type SquadStateEntry = \{[^}]*athleteId: string;[^}]*line: string;[^}]*injuryId: string \| null;[^}]*note: string \| null;[^}]*bodyArea: string \| null;[^}]*side: string \| null;/s.test(q), 'each listed athlete carries the status line and what the medic\'s reason needs');
  assert(/export async function fetchSelectionReasons\(/.test(q) && /\.from\('injury_clinical'\)/.test(q) && /\.select\('injury_id, diagnosis'\)/.test(q), 'the medic\'s reasons are a separate read of injury_clinical — diagnosis only');
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/const canSeeReasons = hasAnyRole\(claims\.roles, CLINICAL_ONLY\);/.test(page) && /matchday && canSeeReasons \? await fetchSelectionReasons\(/.test(page), 'the page runs it only for the medic — a coach never calls it (an empty clinical read still looks like a broken page)');
}

console.log('\n5. the page: the lead card first, the week card taking the emphasis when the matchday card is absent');
{
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  const lead = page.indexOf('<DashboardLeadCard');
  const panel = page.indexOf('<DashboardFlagsPanel');
  const tiles = page.indexOf('<DashboardHeadlineStats');
  const strip_ = page.indexOf('className="dash-week" data-lead');
  assert(lead > 0 && lead < strip_ && strip_ < tiles && tiles < panel, 'the order is the board\'s ten-second read: lead, week, the cards, then the attention panel');
  assert(/\{matchday \? \(\s*<DashboardLeadCard/.test(page), 'the matchday card is absent, not empty, with no fixture inside 14 days');
  assert(/names=\{leadCardNames\(version\)\}/.test(page) && /\{names \? \(\s*<div className="dash-lead-lists">/.test(card_()), 'the nutritionist reads the three counts and no names (board frame 7; the censored view of 0074)');
  assert(/className="dash-week"\s+data-lead=\{!matchday\}/.test(page), 'the week strip takes the emphasis only when the matchday card is gone');
  assert(/No match in the next \{FIXTURE_RANGE_DAYS\} days/.test(page), 'and says why: "No match in the next 14 days"');
  assert(/Next fixture \$\{formatDate\(stats\.nextKickoffAt, timezone\)\} v \$\{stats\.opponent\} · \$\{stats\.toMatchdayDays\} days/.test(page), 'the next fixture and its distance are stated so the absence is legible');
  assert(!/dash-ready-card/.test(page) && !/<Dial /.test(page), 'the old readiness card and its ring are gone from the page');
  const card = card_();
  assert(/Ready for \{matchday\}/.test(card) && /Doubtful · \{doubtful\.length\}/.test(card) && /Ruled out · \{out\.length\}/.test(card), 'eyebrow "Ready for Saturday"; "Doubtful · 4" / "Ruled out · 3"');
  assert(/, with reason/.test(card) && /Medical · visible to medical staff/.test(card), 'the medic\'s lists say "with reason" and the clinical lines sit under the Medical eyebrow');
  assert(/Full<\/|>Full</.test(card) || /label: 'Full'/.test(card), 'the three stats: Full, Doubtful, Ruled out');
  assert(/Week load so far/.test(card) && /Flags affecting selection/.test(card) && /Sessions left to run/.test(card), 'MET-015, the flags and the sessions left are kept as the card\'s tail line — dropping a registry surface is a decision, on the sheet');
}

console.log('\n6. the treatment is the existing wash family, and one emphasised card per screen');
{
  const lead = rule('.dash-lead');
  assert(/background:\s*var\(--wash-accent-soft\)/.test(lead) && /border:\s*1px solid rgb\(var\(--accent-rgb\) \/ 0\.3\)/.test(lead), 'the lead card: the wash and the accent border the readiness card already had (B1 mapped to the wash family)');
  assert(/box-shadow:\s*var\(--shadow\)/.test(lead), 'with the one shadow');
  const week = rule(".dash-week[data-lead='true']");
  assert(/background:\s*var\(--wash-accent-soft\)/.test(week) && /border:\s*1px solid rgb\(var\(--accent-rgb\) \/ 0\.3\)/.test(week), 'the week card takes exactly the same treatment when it leads');
  const stat = rule('.dash-lead-stat-n');
  assert(/font-size:\s*var\(--fs-32\)/.test(stat) && /tabular-nums/.test(stat), 'the three counts at the stat size, tabular');
  assert(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/.test(rule('.dash-lead-lists')), 'the two lists side by side on desktop');
  assert(/@media \(max-width: 767px\)[\s\S]{0,600}\.dash-lead-lists\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(css), 'stacked on a phone');
  assert(!/\.dash-ready-card\s*\{/.test(css), 'the old readiness card rules are retired with it');
}

console.log('\n8. the week strip yields on a heavy morning — the only element that gives way');
{
  assert(HEAVY_MORNING_ATHLETES === 5, 'a heavy morning is five athletes needing attention — the panel\'s own cut');
  assert(weekStripYields({ attentionAthletes: 5, hasMatchday: true }) && weekStripYields({ attentionAthletes: 12, hasMatchday: true }), 'five or more, with the matchday card leading: the strip is not drawn');
  assert(!weekStripYields({ attentionAthletes: 4, hasMatchday: true }), 'four is not heavy');
  assert(!weekStripYields({ attentionAthletes: 30, hasMatchday: false }), 'when the week IS the lead it never gives way — the lead card keeps its place');
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/\{showsWeekStrip\(version\) && !weekStripYields\(\{ attentionAthletes: stats\.attentionAthletes, hasMatchday: matchday !== null \}\) \? \(/.test(page), 'the page asks it beside the role rule');
}

console.log('\n7. the spec');
{
  const spec = read('docs/screens/01-dashboard.md');
  assert(/have a current status/.test(spec) && /Medical · visible to medical staff/.test(spec) && /No match in the next 14 days/.test(spec), '01-dashboard.md describes the lead card, the medic\'s reasons and the week taking the emphasis');
  assert(/heavy morning/.test(spec) && /five or more athletes/.test(spec), 'and the strip yielding on a heavy morning');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
