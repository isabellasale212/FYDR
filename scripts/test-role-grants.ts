/* PATTERN-S8 C4 (2026-09-13): a role change previews what it grants and
 * what it removes before the button, from access.ts's own sets. */
import { readFileSync } from 'node:fs';
import { CAPABILITIES, ROLE_CHANGE_EFFECT, capabilitiesFor, roleChangePreview } from '@/lib/roleGrants';
import * as access from '@/lib/access';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the catalogue is access.ts, not a second opinion');
{
  const sets = Object.entries(access).filter(([, v]) => Array.isArray(v)) as [string, readonly string[]][];
  const referenced = new Set(CAPABILITIES.map((c) => c.roles));
  const missing = sets.filter(([name, v]) => !referenced.has(v as never) && !['PROGRAMME_AUTHOR', 'INJURY_PROGRAMME_PROPOSER'].includes(name)).map(([n]) => n);
  assert(missing.length === 0, `every exported role set is a capability (missing: ${missing.join(', ') || 'none'})`);
  assert(CAPABILITIES.every((c) => sets.some(([, v]) => v === c.roles) || c.roles === access.REPORT_VISIBILITY.compliance), 'and no capability carries a hand-typed role list');
  assert(new Set(CAPABILITIES.map((c) => c.key)).size === CAPABILITIES.length, 'keys are unique');
  assert(CAPABILITIES.every((c) => /^[A-Z]/.test(c.label) && !/\bTODO\b/.test(c.label)), 'every label is a sentence');
}

console.log('\n2. what a change grants and removes');
{
  const p = roleChangePreview(['nutritionist'], ['nutritionist', 'coach'])!;
  assert(p.heading === 'Adding Coach', 'heading names the role');
  assert(p.gains.some((g) => /Injury records/.test(g)) && p.gains.some((g) => /sessions and week templates/.test(g)) && p.gains.some((g) => /Editing thresholds/.test(g)) && p.gains.some((g) => /Reading the thresholds/.test(g)), 'a coach gains injury records, sessions, reading and editing thresholds (the nutritionist had neither)');
  assert(p.loses.length === 0 && /removes nothing/.test(p.sentence), 'adding a role removes nothing — roles add up');
  assert(p.warnings.some((w) => /nutritionist reads injury information/.test(w)), 'D-25: the nutritionist-plus-another warning, in the preview');
  assert(/gains \d+ things and removes nothing; \d+ things unchanged\./.test(p.sentence), `the sentence carries counts (${p.sentence})`);

  const q = roleChangePreview(['medic', 'coach'], ['coach'])!;
  assert(q.heading === 'Removing Medic', 'removing');
  assert(q.loses.some((l) => /^Clinical detail/.test(l)) && q.loses.some((l) => /Rehab programmes/.test(l)) && q.loses.some((l) => /Body mass/.test(l)), 'removing medic loses clinical detail, rehab programmes, body mass');
  assert(!q.loses.some((l) => /Injury records/.test(l)) && !q.loses.some((l) => /availability/.test(l)), 'but keeps what the coach role also grants (injury records, availability)');
  assert(q.warnings.some((w) => /Clinical records they wrote stay/.test(w)), 'says the records stay');

  const r = roleChangePreview(['coach'], ['coach', 'nutritionist'])!;
  assert(r.warnings.some((w) => /nutritionist reads injury information/.test(w)), 'D-25 fires whichever order the two roles arrive in');
  const r2 = roleChangePreview(['coach', 'nutritionist'], ['coach', 'nutritionist', 'strength_conditioning'])!;
  assert(!r2.warnings.some((w) => /nutritionist reads injury information/.test(w)), 'and not again when the combination already existed');

  const s = roleChangePreview(['coach', 'nutritionist'], ['nutritionist'])!;
  assert(s.warnings.some((w) => /Left as a nutritionist alone/.test(w)) && s.loses.some((l) => /Injury records/.test(l)), 'down to a nutritionist alone: says what closes');
  const t = roleChangePreview(['coach'], [])!;
  assert(t.warnings.some((w) => /reach nothing/.test(w)) && t.loses.length === capabilitiesFor(['coach']).length, 'no role at all: reach nothing, everything removed');
  const u = roleChangePreview(['coach'], ['athlete'])!;
  assert(u.warnings.some((w) => /only the athlete role/.test(w)), 'athlete alone: the athlete app only');
  assert(roleChangePreview(['coach'], ['coach']) === null, 'no change, no preview');
  const v = roleChangePreview(['coach'], ['medic'])!;
  assert(v.heading === 'Adding Medic, removing Coach', 'a swap names both');
  assert(/^Takes effect on their next page load/.test(ROLE_CHANGE_EFFECT) && /audit log/.test(ROLE_CHANGE_EFFECT), 'the effect line says when and where');
}

console.log('\n3. the screens');
{
  const detail = strip(read('src/components/UserDetailPanel/UserDetailPanel.tsx'));
  assert(/roleChangePreview\(roles, pending\)/.test(detail), 'the detail page previews the pending set against the held set');
  assert(/Save roles/.test(detail) && /setUserRoles\(db, orgId, currentUserId, currentActorRole, user\.id, pending\)/.test(detail), 'nothing is written until Save roles');
  assert(/BlockedButton/.test(detail) && !/title=\{refusal/.test(detail), 'a refused chip is a BlockedButton with its reason, not a title');
  assert(!/function permissionSummary/.test(detail) && /capabilitiesFor\(roles\)/.test(detail), '"What this user can see" is the same catalogue, not the old four-role list');
  assert(/ROLE_CHANGE_EFFECT/.test(detail), 'the effect line sits with the button');
  const list = strip(read('src/components/UserManagementPanel/UserManagementPanel.tsx'));
  assert(!/setUserRoles/.test(list) && /chip-static/.test(list) && /href=\{`\/settings\/users\/\$\{user\.id\}#roles`\}/.test(list) && /Change roles/.test(list), 'the list states roles as facts and sends changes to the detail page');
  assert(/preview/i.test(read('docs/screens/49-user-detail.md')) && /grants/.test(read('docs/screens/49-user-detail.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
