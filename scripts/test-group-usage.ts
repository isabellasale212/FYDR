/* PATTERN-S8 C5 (2026-09-13): a warning when a group in use by a session or
 * programme is renamed or archived, with what happens. */
import { readFileSync } from 'node:fs';
import { archiveConsequence, groupUseParts, isGroupInUse, renameConsequence, type GroupUsage } from '@/lib/groupUsage';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const none: GroupUsage = { members: 0, sessionsUpcoming: 0, sessionsPast: 0, programmesActive: 0, nutritionTargets: 0, nutritionRules: 0, leaderboards: 0, thresholds: 0 };
const forwards: GroupUsage = { members: 12, sessionsUpcoming: 2, sessionsPast: 45, programmesActive: 2, nutritionTargets: 1, nutritionRules: 1, leaderboards: 0, thresholds: 0 };

console.log('1. in use, in words');
{
  assert(!isGroupInUse(none) && isGroupInUse(forwards), 'in use is any current use, not membership');
  assert(groupUseParts(forwards).join('; ') === '2 upcoming sessions; 2 active programme assignments; 1 nutrition target; 1 nutrition rule', 'the parts, with their nouns, zeros omitted');
  assert(groupUseParts({ ...none, sessionsUpcoming: 1, leaderboards: 1, thresholds: 2 }).join('; ') === '1 upcoming session; 1 leaderboard; 2 thresholds', 'singular and plural');
}

console.log('\n2. renaming');
{
  const r = renameConsequence('Forwards', forwards);
  assert(/^Forwards is in use\. Renaming it changes the name on 2 upcoming sessions, 2 active programme assignments, 1 nutrition target and 1 nutrition rule and 45 past sessions, the schedule and the filter/.test(r), `names every use (${r.slice(0, 80)}…)`);
  assert(/including in the past/.test(r) && /Nothing else changes: who is in it, what they are expected at and what they are prescribed all stay\./.test(r), 'says the past changes too and what does not');
  assert(renameConsequence('New', none) === 'Nothing uses New yet, so the new name appears only in the group filter and on its members.', 'nothing in use: says so');
  assert(/changes the name on 3 past sessions too/.test(renameConsequence('Old', { ...none, sessionsPast: 3 })), 'only the past: still a sentence');
}

console.log('\n3. archiving');
{
  const a = archiveConsequence('Forwards', forwards);
  assert(/^Archiving Forwards removes it from the group filter, from every picker and from the groups list\. Anyone filtering by it sees Whole squad and is told why\. Its 12 members stay in the squad; nothing about them is deleted\.$/.test(a.lead), 'the lead: what stops, and that nobody is deleted');
  assert(a.keeps.length === 4 && /^2 upcoming sessions still expect its members\. Expectations follow membership/.test(a.keeps[0]!) && /^2 active programme assignments keep running/.test(a.keeps[1]!) && /^1 nutrition target keeps applying/.test(a.keeps[2]!) && /^1 nutrition rule keeps applying/.test(a.keeps[3]!), 'what does NOT stop: sessions, programmes, targets, rules — the surprise, stated');
  assert(/^45 past sessions keep the group in their record\. Restore brings the group back exactly as it was\.$/.test(a.note), 'the past and the way back');
  const b = archiveConsequence('Spare', { ...none, members: 1 });
  assert(b.keeps.length === 0 && /Its 1 member stays/.test(b.lead) && b.note === 'Restore brings the group back exactly as it was.', 'nothing in use: no keeps, still the way back');
}

console.log('\n4. the screen');
{
  const page = strip(read('src/app/(staff)/settings/groups/[groupId]/page.tsx'));
  assert(/fetchGroupUsage\(db, orgId, groupId\)/.test(page), 'the page reads the usage once');
  assert(/<GroupArchiveCard/.test(page) && /usage=\{usage\}/.test(page), 'the archive is a card, handed the usage');
  const card = strip(read('src/components/GroupArchiveCard/GroupArchiveCard.tsx'));
  assert(/archiveConsequence\(name, usage\)/.test(card) && /`Archive \$\{name\}`/.test(card) && /Keep it/.test(card), 'the consequence sits in the same card as the button, with the way out');
  assert(/groupType === 'rehab'/.test(card) && /BlockedButton/.test(card), 'a rehab group is not archived here — a blocked control with its reason');
  const edit = strip(read('src/components/GroupEditForm/GroupEditForm.tsx'));
  assert(/renameConsequence\(initialName, usage\)/.test(edit) && /name\.trim\(\) !== initialName/.test(edit), 'the rename form says the consequence once the name differs');
  const q = read('src/lib/queries/groups.ts');
  assert(/export async function fetchGroupUsage/.test(q) && /session_participants/.test(q) && /programme_assignments/.test(q) && /nutrition_targets/.test(q) && /nutrition_rules/.test(q) && /leaderboards/.test(q) && /thresholds/.test(q), 'the count reads every table that references a group');
  assert(/in use/i.test(read('docs/screens/57-group-detail.md')) && /archiv/i.test(read('docs/screens/57-group-detail.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
