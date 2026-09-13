/* PATTERN-S8 C10 (2026-09-13): subject access on one pattern across the
 * staff side and the athlete side, reusing the pack's own manifest. */
import { readFileSync } from 'node:fs';
import { SAR_HOW_TO_ASK, daysUntil, sarAthleteLine, sarDueWords, sarNextStep, sarPackContents } from '@/lib/subjectAccess/words';
import { SAR_CATEGORIES } from '@/lib/subjectAccess/manifest';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const now = Date.parse('2026-09-13T12:00:00Z');
const iso = (d: number) => new Date(now + d * 86_400_000).toISOString();

console.log('1. the same words on both sides');
{
  assert(daysUntil(iso(19), now) === 19 && daysUntil(iso(-3), now) === -3, 'days until, negative once past');
  assert(sarDueWords(iso(19), 'pending_review', now)?.text === '19 days left' && sarDueWords(iso(19), 'pending_review', now)?.tone === 'neutral', 'well ahead: neutral');
  assert(sarDueWords(iso(10), 'pending_review', now)?.tone === 'warn' && sarDueWords(iso(5), 'pending_review', now)?.tone === 'bad', 'two weeks warn, one week bad');
  assert(sarDueWords(iso(0), 'reviewed', now)?.text === 'due today' && sarDueWords(iso(-3), 'reviewed', now)?.text === '3 days overdue', 'today and overdue, in words');
  assert(sarDueWords(iso(5), 'released', now) === null, 'released: no due');
  assert(sarNextStep('pending_review') === 'Waiting on the medic to review the clinical notes' && /waiting on the sport scientist to release/.test(sarNextStep('reviewed')) && sarNextStep('released') === 'Released', 'who acts next');
  const fmt = (s: string) => s.slice(0, 10);
  const open = sarAthleteLine({ status: 'pending_review', requestedAt: iso(-3), requestedBy: 'Jane Pemberton', dueAt: iso(27), releasedAt: null, formatDate: fmt, nowMs: now });
  assert(open === 'A request for a copy of your data was opened on 2026-09-10 by Jane Pemberton. It is due by 2026-10-10 (27 days left). Waiting on the medic to review the clinical notes.', `the athlete's sentence: opened, by whom, due, waiting on whom (${open.slice(0, 50)}…)`);
  const rel = sarAthleteLine({ status: 'released', requestedAt: iso(-30), requestedBy: null, dueAt: iso(0), releasedAt: iso(-2), formatDate: fmt, nowMs: now });
  assert(/^A copy of your data was released on 2026-09-11, from a request opened on 2026-08-14\. Ask the person who opened it/.test(rel), 'released: when, and where to ask');
  assert(sarPackContents().length === SAR_CATEGORIES.length && sarPackContents()[0]!.category === SAR_CATEGORIES[0]!.category, 'what the pack holds IS the manifest');
  assert(SAR_HOW_TO_ASK.length === 4 && /one-month clock/.test(SAR_HOW_TO_ASK[1]) && /serious-harm/.test(SAR_HOW_TO_ASK[2]) && /audit log/.test(SAR_HOW_TO_ASK[3]), 'how to ask: four steps, the clock, the review, the audit');
}

console.log('\n2. the migration, the test, the two screens');
{
  const mig = read('supabase/migrations/0114_sar_requests_athlete_select.sql');
  assert(/create policy sar_requests_athlete_select on public\.sar_requests for select/.test(mig) && /athlete_id = public\.auth_athlete_id\(\)/.test(mig) && !/for insert|for update/.test(mig), 'the athlete reads their own requests, and only reads');
  const t = read('supabase/tests/700_sar_requests_athlete_select_test.sql');
  assert(/an athlete cannot open a request themselves/.test(t) && /the athlete reads no clinical review decision/.test(t) && /the coach still reads none/.test(t), 'the pgTAP test covers the boundaries');
  const q = strip(read('src/lib/queries/sarPack.ts'));
  assert(/export async function fetchMySarRequests/.test(q) && /\.eq\('athlete_id', athleteId\)/.test(q), 'the athlete\'s own query');
  const page = strip(read('src/app/(athlete)/me/privacy/page.tsx'));
  assert(/fetchMySarRequests\(db, orgId, athleteId\)/.test(page) && /sarAthleteLine\(/.test(page) && /SAR_HOW_TO_ASK\.map/.test(page) && /sarPackContents\(\)\.map/.test(page), '/me/privacy: the request, how to ask, what the club holds');
  assert(/id="pv-sees-title"/.test(page) && /read by the medic alone/.test(page) && /not by the coach/.test(page), 'and who sees what, as sentences');
  assert(!/<form|fetch\(/.test(page), 'nothing on it writes');
  const me = strip(read('src/app/(athlete)/me/page.tsx'));
  assert(/href="\/me\/privacy"/.test(me) && /Privacy and my data/.test(me), 'Me links it');
  const staff = strip(read('src/app/(staff)/settings/subject-access/page.tsx'));
  assert(/sarDueWords\(r\.due_at/.test(staff) && /sarNextStep\(r\.status as SarStatus\)/.test(staff) && !/function daysUntil/.test(staff), 'the staff queue reads the same words');
  assert(/one pattern|same stage/i.test(read('docs/screens/53-subject-access.md')) && /me\/privacy/.test(read('docs/athlete/screens/12-me.md')), 'the specs say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
