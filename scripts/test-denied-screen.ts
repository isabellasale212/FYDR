/* PATTERN-S6 C7, the copy half (2026-09-13): permission denied says what is
 * true without saying what exists. One screen, /denied: "This is not
 * available to you. It may not exist, or your role may not include it.
 * Nothing more can be said about it here." — then who they are signed in as
 * and what their role covers, and one primary back to the dashboard. The
 * reference code waits for a denial log (the sheet, ⚠ migration). Every
 * role-gate redirect that used to land on a page with a ?e= nobody rendered
 * now lands here. */
import { readFileSync } from 'node:fs';
import { deniedCopy } from '@/lib/denied';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the words');
{
  const c = deniedCopy({ fullName: 'Peter Ackland', roles: ['coach'], covers: ['Dashboard', 'Squad overview', 'Schedule', 'Reports', 'Nutrition', 'Gym programme', 'Leaderboard', 'Settings'] });
  assert(c.title === 'This is not available to you.', 'the title');
  assert(c.body === 'It may not exist, or your role may not include it. Nothing more can be said about it here.', 'true without saying what exists');
  assert(c.identity === 'Signed in as Peter Ackland · coach.', 'who they are signed in as, with the role in words');
  assert(c.covers === 'Your role covers Dashboard, Squad overview, Schedule, Reports, Nutrition, Gym programme, Leaderboard and Settings.', 'what the role covers, from the destinations it can open');
  assert(c.action.href === '/dashboard' && c.action.label === 'Back to dashboard', 'one primary, back to the dashboard');
  assert(c.reference === null, 'no reference when the refusal carried none — nothing pretends');
  const withRef = deniedCopy({ fullName: 'Peter Ackland', roles: ['coach'], covers: ['Dashboard'], reference: 'D-1Z9K' });
  assert(withRef.reference === "Reference D-1Z9K. Quote it to your club's administrator — it is in Settings › Audit log.", 'the denial log\'s reference (0112), with where an administrator finds it');
  assert(deniedCopy({ fullName: 'P', roles: ['coach'], covers: [], reference: 'javascript:alert(1)' }).reference === null && deniedCopy({ fullName: 'P', roles: ['coach'], covers: [], reference: 'D-zz' }).reference === null, 'only a well-formed reference is echoed');
  const two = deniedCopy({ fullName: 'Ruth Callaghan', roles: ['medic', 'coach'], covers: ['Dashboard'] });
  assert(two.identity === 'Signed in as Ruth Callaghan · medic and coach.' && two.covers === 'Your role covers Dashboard.', 'two roles, one destination');
  const nameless = deniedCopy({ fullName: '', roles: ['coach'], covers: [] });
  assert(nameless.identity === 'Signed in as coach.' && nameless.covers === 'Your role covers nothing on this app yet.', 'no name, nothing covered: still true');
}

console.log('\n2. the screen and the redirects');
{
  const page = strip(read('src/app/(staff)/denied/page.tsx'));
  assert(/requireStaff\(\)/.test(page) && /deniedCopy\(\{ fullName, roles: claims\.roles, covers/.test(page), 'the screen is staff-only and builds its words from the session');
  /* 14 September 2026 (D-20 confirmed, analytics premium): the plan filter
     joins the role filter, the same pair the sidebar applies. */
  assert(/SIDEBAR_ROWS\.filter\(\(row\) => row\.roles\.some\(\(r\) => claims\.roles\.includes\(r\)\) && \(isPremium\(tier\) \|\| !PREMIUM_ONLY\.has\(row\.id\)\)\)/.test(page), 'what the role covers is the sidebar\'s own rule, on the club\'s own plan — nothing invented, nothing leaked');
  assert(/className="btn-primary"/.test(page) && /href=\{copy\.action\.href\}/.test(page), 'the one primary');
  assert(/const reference = typeof sp\.r === 'string' \? sp\.r : null;/.test(page) && !/from=|reason|path/.test(page.replace(/Reads no reason and echoes no path[^*]*\*\//, '')), 'the screen reads only the reference from the address — no reason, no path');
  const sessionSrc = strip(read('src/lib/session.ts'));
  assert(/export async function refuse\(db: Db, gate: string, path: string \| null\): Promise<never>/.test(sessionSrc) && /db\.rpc\('log_access_denial', \{ p_gate: gate, p_path: path \?\? '' \}\)/.test(sessionSrc) && /redirect\(reference \? `\/denied\?r=\$\{reference\}` : '\/denied'\)/.test(sessionSrc), 'every refusal logs first (0112) and carries the reference to the screen; a failed log still refuses');
  assert((sessionSrc.match(/await refuse\(ctx\.db, /g) ?? []).length === 5 && !/redirect\('\/denied'\)/.test(sessionSrc), 'the five gates in session.ts go through it');
  for (const f of ['src/app/(staff)/analytics/page.tsx', 'src/app/(staff)/settings/subject-access/[requestId]/release/route.ts', 'src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx', 'src/app/(staff)/squad/[athleteId]/subject-access/route.ts']) {
    const src = strip(read(f));
    assert(/await refuse\(db, '/.test(src) && !/redirect\('\/denied'\)/.test(src), `${f.split('/').slice(-2).join('/')}: through refuse()`);
  }
  const audit = strip(read('src/lib/queries/auditLog.ts'));
  assert(/`metadata->>reference\.ilike\.%\$\{likeTerm\}%`/.test(audit), 'Settings › Audit log finds a row by the reference quoted');
  const auditPage = strip(read('src/app/(staff)/settings/audit/page.tsx'));
  assert(/r\.action === 'access\.denied' && typeof r\.metadata\?\.reference === 'string'/.test(auditPage), 'and shows the reference and the path on the denial row');
  const mig = read('supabase/migrations/0112_access_denial_log.sql');
  assert(/create or replace function public\.log_access_denial\(p_gate text, p_path text\)/.test(mig) && /'access\.denied'/.test(mig) && /v_id := nextval\('public\.audit_log_id_seq'\)/.test(mig) && /'reference', v_ref/.test(mig), 'the migration: one audit row, the reference derived from its id and stored on it');
  assert(/access\.denied/.test(read('docs/screens/51-audit-log.md')) && /reference/i.test(read('docs/access-matrix.md')), 'the audit spec and the access matrix say so');
  const session = strip(read('src/lib/session.ts'));
  assert(!/redirect\('\/settings\?e=no-report-access'\)/.test(session) && !/redirect\('\/reports\?e=no-report-access'\)/.test(session) && !/redirect\('\/\?e=no-injury-access'\)/.test(session) && !/redirect\('\/settings\?e=no-sar-access'\)/.test(session) && !/redirect\('\/\?e=not-platform-staff'\)/.test(session), 'the five ?e= denials nobody rendered are gone');
  assert((session.match(/await refuse\(ctx\.db, /g) ?? []).length === 5, 'and each lands on /denied, through the log');
  assert(/redirect\('\/login'\)/.test(session) && /redirect\('\/login\?e=no-roles'\)/.test(session) && /redirect\('\/today'\)/.test(session) && /redirect\('\/dashboard'\)/.test(session), 'sign-in and shell redirects are not denials and are untouched');
  const analytics = strip(read('src/app/(staff)/analytics/page.tsx'));
  assert(/await refuse\(db, 'analytics', '\/analytics'\)/.test(analytics) && !/no-analytics/.test(analytics), 'analytics too');
  assert(/\/denied/.test(read('docs/20-route-map.md')) && /This is not available to you/.test(read('docs/access-matrix.md')), 'the route map and the access matrix say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
