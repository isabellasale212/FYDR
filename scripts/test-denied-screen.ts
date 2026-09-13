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
  assert(!('reference' in c), 'no reference code until denials are logged (the sheet)');
  const two = deniedCopy({ fullName: 'Ruth Callaghan', roles: ['medic', 'coach'], covers: ['Dashboard'] });
  assert(two.identity === 'Signed in as Ruth Callaghan · medic and coach.' && two.covers === 'Your role covers Dashboard.', 'two roles, one destination');
  const nameless = deniedCopy({ fullName: '', roles: ['coach'], covers: [] });
  assert(nameless.identity === 'Signed in as coach.' && nameless.covers === 'Your role covers nothing on this app yet.', 'no name, nothing covered: still true');
}

console.log('\n2. the screen and the redirects');
{
  const page = strip(read('src/app/(staff)/denied/page.tsx'));
  assert(/requireStaff\(\)/.test(page) && /deniedCopy\(\{ fullName, roles: claims\.roles, covers/.test(page), 'the screen is staff-only and builds its words from the session');
  assert(/SIDEBAR_ROWS\.filter\(\(row\) => row\.roles\.some\(\(r\) => claims\.roles\.includes\(r\)\)\)/.test(page), 'what the role covers is the sidebar\'s own rule — nothing invented, nothing leaked');
  assert(/className="btn-primary"/.test(page) && /href=\{copy\.action\.href\}/.test(page), 'the one primary');
  assert(!/searchParams|from=|reason/.test(page), 'the screen reads no reason and echoes no path — it says nothing about what was asked for');
  const session = strip(read('src/lib/session.ts'));
  assert(!/redirect\('\/settings\?e=no-report-access'\)/.test(session) && !/redirect\('\/reports\?e=no-report-access'\)/.test(session) && !/redirect\('\/\?e=no-injury-access'\)/.test(session) && !/redirect\('\/settings\?e=no-sar-access'\)/.test(session) && !/redirect\('\/\?e=not-platform-staff'\)/.test(session), 'the five ?e= denials nobody rendered are gone');
  assert((session.match(/redirect\('\/denied'\)/g) ?? []).length === 5, 'and each lands on /denied');
  assert(/redirect\('\/login'\)/.test(session) && /redirect\('\/login\?e=no-roles'\)/.test(session) && /redirect\('\/today'\)/.test(session) && /redirect\('\/dashboard'\)/.test(session), 'sign-in and shell redirects are not denials and are untouched');
  const analytics = strip(read('src/app/(staff)/analytics/page.tsx'));
  assert(/redirect\('\/denied'\)/.test(analytics) && !/no-analytics/.test(analytics), 'analytics too');
  const sarRelease = strip(read('src/app/(staff)/settings/subject-access/[requestId]/release/route.ts'));
  const sarReview = strip(read('src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx'));
  const sarCreate = strip(read('src/app/(staff)/squad/[athleteId]/subject-access/route.ts'));
  assert(/redirect\('\/denied'\)/.test(sarRelease) && /redirect\('\/denied'\)/.test(sarReview) && /redirect\('\/denied'\)/.test(sarCreate), 'and the three subject-access gates');
  assert(/\/denied/.test(read('docs/20-route-map.md')) && /This is not available to you/.test(read('docs/access-matrix.md')), 'the route map and the access matrix say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
