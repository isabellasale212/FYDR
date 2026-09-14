/* PATTERN-S8 C2 (2026-09-13): the settings hub in four groups on one screen
 * — Club, People, Data, You — cards of destination rows with counts, four
 * across at desktop and stacked at 375; the long forms one level down
 * (/settings/profile, /settings/club). Log out stays the A1 button. */
import { readFileSync } from 'node:fs';
import { settingsGroups } from '@/lib/settingsHub';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the four groups, as data');
{
  const ss = settingsGroups({ roles: ['sport_scientist'], isAdmin: true, canExport: true, canImport: true, onPremium: true, previewingTier: false, tierWord: 'Premium', counts: { groups: 5, thresholds: 12, users: 6, sarOpen: 1, importBatches: 3, auditRecent: 1988 }, mfa: 'on' });
  assert(ss.map((c) => c.key).join(',') === 'club,people,data,you' && ss.map((c) => c.title).join(',') === 'Club,People,Data,You', 'Club, People, Data, You');
  const rows = ss.flatMap((c) => c.rows);
  assert(rows.map((r) => r.href).filter(Boolean).length === rows.length, 'the sport scientist opens every row');
  const by = (k: string) => rows.find((r) => r.key === k)!;
  assert(by('groups').count === '5 groups' && by('thresholds').count === '12 active' && by('users').count === '6 active accounts' && by('sar').count === '1 open' && by('imports').count === '3 files' && by('audit').count === '1,988 in 90 days' && by('plan').count === 'Premium' && by('account').count === 'Two-factor on', 'every row that has a count carries it with its noun');
  const coach = settingsGroups({ roles: ['coach'], isAdmin: false, canExport: true, canImport: false, onPremium: false, previewingTier: false, tierWord: 'Basic', counts: { groups: 5, thresholds: 12, users: null, sarOpen: null, importBatches: null, auditRecent: null }, mfa: 'off' });
  const crow = (k: string) => coach.flatMap((c) => c.rows).find((r) => r.key === k)!;
  /* The coach's club here is Basic, so the imports row is absent (D-20); a
     Premium club's coach sees it closed with its reason (asserted below). */
  assert(crow('users').href === null && /Sport scientist only/.test(crow('users').sub) && crow('retention').href === null && crow('audit').href === null, 'a coach\'s closed rows state their reason in the row, no dead link');
  const premiumCoach = settingsGroups({ roles: ['coach'], isAdmin: false, canExport: true, canImport: false, onPremium: true, previewingTier: false, tierWord: 'Premium', counts: { groups: 5, thresholds: 12, users: null, sarOpen: null, importBatches: null, auditRecent: null }, mfa: 'off' });
  const pcrow = premiumCoach.flatMap((c) => c.rows).find((r) => r.key === 'imports')!;
  assert(pcrow.href === null && /Sport scientist only/.test(pcrow.sub), 'a Premium club\'s coach sees the imports row closed with its reason');
  assert(crow('exports').href === '/settings/exports' && crow('groups').href === '/settings/groups' && crow('thresholds').href === '/settings/thresholds', 'and opens what a coach may');
  const medic = settingsGroups({ roles: ['medic'], isAdmin: false, canExport: true, canImport: false, onPremium: true, previewingTier: false, tierWord: 'Premium', counts: { groups: 5, thresholds: 12, users: null, sarOpen: 2, importBatches: null, auditRecent: null }, mfa: 'required' });
  const mrow = (k: string) => medic.flatMap((c) => c.rows).find((r) => r.key === k)!;
  assert(mrow('sar').href === '/settings/subject-access' && mrow('sar').count === '2 open' && mrow('account').count === 'Two-factor required' && mrow('account').countTone === 'warn', 'the medic opens subject access; two-factor required reads as a warning');
  const basicImporter = settingsGroups({ roles: ['sport_scientist'], isAdmin: false, canExport: true, canImport: true, onPremium: false, previewingTier: false, tierWord: 'Basic', counts: { groups: 5, thresholds: 12, users: null, sarOpen: null, importBatches: null, auditRecent: null }, mfa: 'off' });
  /* D-20 without exception (15 Sept 2026): the imports area is a wholly
     premium destination, so the row is ABSENT for a Basic club — not badged.
     The plan page is where the club learns what Premium contains. */
  const brow = basicImporter.flatMap((c) => c.rows).find((r) => r.key === 'imports');
  assert(brow === undefined, 'a Basic importer sees no Vendor imports row at all (D-20: a wholly premium destination is absent from navigation)');
  const premiumImporter = settingsGroups({ roles: ['sport_scientist'], isAdmin: false, canExport: true, canImport: true, onPremium: true, previewingTier: false, tierWord: 'Premium', counts: { groups: 5, thresholds: 12, users: null, sarOpen: null, importBatches: 3, auditRecent: null }, mfa: 'off' });
  const prow = premiumImporter.flatMap((c) => c.rows).find((r) => r.key === 'imports')!;
  assert(prow.href === '/settings/imports' && prow.count === '3 files', 'a Premium importer opens it');
  const preview = settingsGroups({ roles: ['sport_scientist'], isAdmin: true, canExport: true, canImport: true, onPremium: false, previewingTier: true, tierWord: 'Basic', counts: { groups: 0, thresholds: 0, users: 0, sarOpen: 0, importBatches: null, auditRecent: 0 }, mfa: 'off' });
  assert(/Previewing Basic — the real plan is Premium/.test(preview[0]!.rows[0]!.sub) && preview[0]!.rows[0]!.countTone === 'warn', 'a preview is never mistaken for the real plan');
}

console.log('\n2. the hub, the two levels down, and the links');
{
  const hub = strip(read('src/app/(staff)/settings/page.tsx'));
  assert(/settingsGroups\(\{/.test(hub) && /className="set-groups"/.test(hub) && /className="card set-card set-group"/.test(hub), 'the hub draws the four groups from the data');
  assert(/className="btn-ghost set-logout"/.test(hub) && /card\.key === 'you'/.test(hub), 'Log out stays the A1 button, in the You card');
  assert(!/<PlanPreviewSwitch|<ClubDetailsEditForm|<StaffProfileEditForm|<MfaEnrollment|<ChangePasswordForm|<AvatarUploadForm/.test(hub), 'no form on the hub — the long lists are one level down');
  const club = strip(read('src/app/(staff)/settings/club/page.tsx'));
  assert(/<PlanPreviewSwitch/.test(club) && /<ClubDetailsEditForm/.test(club) && /Import files/.test(club) && /id="plan"/.test(club), '/settings/club: the plan card, the integrations, the club details');
  const account = strip(read('src/app/(staff)/settings/profile/page.tsx'));
  assert(/<AvatarUploadForm/.test(account) && /<StaffProfileEditForm/.test(account) && /<ChangePasswordForm/.test(account) && /<MfaEnrollment/.test(account) && /id="password"/.test(account), '/settings/profile: profile, avatar, password, two-factor, with the #password anchor');
  assert(/href="\/settings\/profile#password"/.test(hub), 'the two-factor notice points at the account level');
  /* 15 Sept 2026: the "Previewing Basic" links keep pointing at the plan card
     (the switch lives there); the PlanGate pages send discovery to the plan
     page, the one place. */
  for (const f of ['src/components/Sidebar/Sidebar.tsx', 'src/components/StaffPhoneShell/StaffPhoneShell.tsx']) {
    assert(/\/settings\/club#plan/.test(read(f)) && !/"\/settings#plan"/.test(read(f)), `${f.split('/').slice(-1)[0]} links the preview at the plan card`);
  }
  assert(/href="\/settings\/plan"/.test(read('src/components/PlanGate/PlanGate.tsx')), 'PlanGate links the plan page');
  const css = strip(read('src/styles/base.css'));
  assert(/\.set-groups\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/.test(css) && /@media \(max-width: 767px\) \{\s*\.set-groups \{\s*grid-template-columns: minmax\(0, 1fr\);/.test(css), 'four across at desktop, one column at a phone');
  assert(/four groups/i.test(read('docs/screens/47-settings.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
