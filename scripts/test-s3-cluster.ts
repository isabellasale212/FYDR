/* PATTERN-S3 C1, C2, C3, C6, C8 (Isabella, 2026-09-13): the injury and
 * rehab cluster. Pins the rules the migrations and the screens carry —
 * the read flag, the site setting and its masking view, the stage data
 * and the one-stage advance, the status screen's three questions, the
 * proposals list both roles see — and that lib/restrictions.ts keeps
 * stripping protocol and stage at every read now the stage data exists. */
import { readFileSync } from 'node:fs';
import { restrictionLine } from '@/lib/restrictions';
import { canITrainToday, stageLadder, whatCanIDo, whenAmIBack } from '@/lib/statusScreen';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sql = (s: string) => s.replace(/^\s*--.*$/gm, '');

console.log('1. C1 — the read flag against the availability row (0122)');
{
  const body = sql(read('supabase/migrations/0122_availability_seen_and_injury_site_setting.sql'));
  assert(/alter table public\.availability add column athlete_seen_at timestamptz/.test(body), 'availability.athlete_seen_at, nullable, no default: null is "not yet read"');
  assert(/create or replace function public\.mark_availability_seen\(\)/.test(body) && /athlete_id = public\.auth_athlete_id\(\)/.test(body) && /effective_to is null/.test(body) && /athlete_seen_at is null/.test(body), 'mark_availability_seen marks the athlete\'s own open row, once');
  const today = strip(read('src/app/(athlete)/today/page.tsx'));
  assert(/availability\.current\.athlete_seen_at === null && availability\.current\.set_by/.test(today) && /<StatusToldCard/.test(today), 'Today shows the told card only while the open row is unseen and was set by staff');
  const card = strip(read('src/components/StatusToldCard/StatusToldCard.tsx'));
  assert(/data-emphasis/.test(card) && /href="\/me\/status"/.test(card) && /btn-commit/.test(card), 'the told card is the emphasised card with one 56px action to the status screen');
  assert(!/setTimeout|setInterval/.test(card), 'no timer: it stays until the status screen has been opened');
  const status = strip(read('src/app/(athlete)/me/status/page.tsx'));
  assert(/current\.athlete_seen_at === null\) await db\.rpc\('mark_availability_seen'\)/.test(status), 'opening the status screen is the one act that clears it');
  const avail = strip(read('src/lib/queries/availability.ts'));
  assert(/athlete_seen_at: string \| null/.test(avail) && /effective_from, note, set_by, athlete_seen_at'/.test(avail), 'the flag rides the current-availability read');
}

console.log('\n2. C8 — body site and side are not coach-visible: a club setting defaulting to off (0122)');
{
  const body = sql(read('supabase/migrations/0122_availability_seen_and_injury_site_setting.sql'));
  assert(/add column coach_sees_injury_site boolean not null default false/.test(body), 'organisations.coach_sees_injury_site defaults to off');
  assert(/revoke select on public\.injuries from authenticated/.test(body), 'SELECT on the injuries table is revoked from authenticated…');
  const grant = body.match(/grant select \(([^)]*)\)\s*on public\.injuries to authenticated/);
  assert(!!grant && !/body_area|side/.test(grant[1]!), '…and re-granted by column, without body_area or side');
  assert(/create or replace view public\.injuries_staff with \(security_invoker = false\)/.test(body) && /case when public\.injury_site_visible\(\) or i\.athlete_id = public\.auth_athlete_id\(\) then i\.body_area else null end/.test(body), 'injuries_staff masks both columns unless the setting is on or the reader is the athlete');
  assert(/i\.org_id = public\.auth_org_id\(\)/.test(body), 'the view scopes rows to the reader\'s club');
  const vis = body.slice(body.indexOf('function public.injury_site_visible()'), body.indexOf('revoke all on function public.injury_site_visible'));
  assert(/'medic'/.test(vis) && /'sport_scientist'/.test(vis) && /'strength_conditioning'/.test(vis) && /'coach'/.test(vis) && /coach_sees_injury_site/.test(vis), 'injury_site_visible: medic, sport scientist and S&C always; the coach only when the setting is on');
  for (const f of ['src/lib/queries/availability.ts', 'src/lib/queries/injuries.ts', 'src/lib/queries/reports.ts', 'src/lib/queries/sarPack.ts']) {
    const s = strip(read(f));
    const direct = [...s.matchAll(/\.from\('injuries'\)[\s\S]*?\.select\('([^']*)'\)/g)].filter((m) => /body_area|\bside\b|\*/.test(m[1]!));
    assert(direct.length === 0 && /injuries_staff/.test(s), `${f}: body_area and side come from injuries_staff, never the table`);
  }
  const fmt = strip(read('src/lib/format.ts'));
  assert(/SITE_WITHHELD = 'Injury'/.test(fmt) && /if \(!injury\.body_area\) return SITE_WITHHELD/.test(fmt), 'a masked site renders as the word "Injury", not a blank');
  const t = sql(read('supabase/tests/770_availability_seen_and_injury_site_test.sql'));
  assert(/user_coach/.test(t) && /42501/.test(t) && /coach_sees_injury_site = true/.test(t), '770: the coach is refused at the table, null through the view, and reads the site once the club turns it on');
  const club = strip(read('src/app/(staff)/settings/club/page.tsx'));
  assert(/id="injury-site"/.test(club) && /InjurySiteSettingSwitch/.test(club), 'the switch lives on Club details');
  const sw = strip(read('src/components/InjurySiteSettingSwitch/InjurySiteSettingSwitch.tsx'));
  assert(/SITE_SWITCH_OFF/.test(sw) && /SITE_SWITCH_ON/.test(sw), 'each position says what the coach reads');
  const org = strip(read('src/lib/queries/orgDetails.ts'));
  assert(/org\.coach_sees_injury_site\.changed/.test(org), 'flipping it is audited');
  const vis2 = strip(read('src/lib/staffVisibility.ts'));
  assert(/the body site or side of an injury/.test(vis2) && /COACH_SEES_SITE/.test(vis2), 'the S9 coach card takes the board\'s wording, from the club\'s own setting');
}

console.log('\n3. C3 — return-to-play stages as data; advance is one stage with a rewritten line (0123)');
{
  const body = sql(read('supabase/migrations/0123_injury_protocol_stages.sql'));
  assert(/create table public\.injury_protocols/.test(body) && /total_stages\s+int not null check \(total_stages between 1 and 12\)/.test(body), 'injury_protocols: one per injury, 1..12 stages, no invented names');
  assert(/create table public\.injury_stage_events/.test(body) && /revoke all on public\.injury_stage_events from public, anon, authenticated/.test(body), 'injury_stage_events, append-only, with the default-privilege discipline');
  assert(/current_stage int not null default 0/.test(body) && /select current_stage into v_from from public\.injury_protocols/.test(body) && /update public\.injury_protocols set current_stage = p_to_stage/.test(body), 'the current stage lives on the protocol row and every move updates it — never derived from a uuid-ordered ledger');
  assert(/seq\s+bigint generated always as identity/.test(body) && /\.order\('seq', \{ ascending: false \}\)/.test(strip(read('src/lib/queries/injuryStages.ts'))), 'the ledger orders by seq, not by moved_at (constant within a transaction) or by id');
  const policies = [...body.matchAll(/create policy (\w+) on public\.injury_(protocols|stage_events)/g)].map((m) => m[1]);
  assert(policies.length === 4 && policies.every((p) => /_medic_select$|_self_select$/.test(p!)), 'four SELECT policies — the medic and the athlete\'s own — and none for a coach, sport scientist or S&C');
  assert(!/grant (insert|update|delete) on public\.injury_(protocols|stage_events)/.test(body), 'no direct write grant: the two functions are the only way in');
  const mv = body.slice(body.indexOf('function public.move_injury_stage'));
  assert(/v_advance := \(p_to_stage = v_from \+ 1\)/.test(mv) && /restriction_line_required/.test(mv) && /not coalesce\(p_criteria_reviewed, false\)/.test(mv), 'advancing (to = from + 1) needs the rewritten restriction line and the criteria-reviewed confirmation');
  assert(/reason_required/.test(mv), 'any other stage needs a reason');
  assert(/set effective_to = now\(\)/.test(mv) && /insert into public\.availability \(org_id, athlete_id, status, restrictions, reason_category, injury_id, effective_from, set_by, note\)/.test(mv) && !/set restrictions = /.test(mv), 'the new line opens a new availability row (the old one closed) — what the coach reads, dated to the move, unread by the athlete, and the ledger keeps the line before (C7)');
  assert(/restriction_line_names_clinical/.test(mv) && /function public\.restriction_line_is_clean/.test(body), 'a line naming a protocol, a stage or a diagnosis is refused at the database');
  assert(/'stage_change'/.test(mv) && /'injury\.stage_advanced'/.test(mv) && /'injury\.stage_set'/.test(mv), 'a timeline event and an audit row per move');
  assert(restrictionLine(['Stage 3 of 6', 'no contact']).join() === 'no contact' && restrictionLine(['Return to play protocol']).length === 0, 'lib/restrictions.ts still strips protocol and stage at every read, for every viewer');
  const rec = strip(read('src/app/(staff)/injuries/[injuryId]/page.tsx'));
  assert(/hasAnyRole\(claims\.roles, CLINICAL_ONLY\)/.test(rec) && /<StageLadder/.test(rec), 'the ladder renders on the injury record for the medic only');
  const ladder = strip(read('src/components/StageLadder/StageLadder.tsx'));
  assert(/name="reviewed" value="1" required/.test(ladder) && /name="line" className="field" required/.test(ladder), 'the advance form requires the line and the confirmation');
  assert(/Done|Now|Next|Later/.test(ladder) && !/Stage name|stage_name/.test(ladder), 'stages are numbered with state words, never named');
  const route = strip(read('src/app/(staff)/injuries/[injuryId]/stage/route.ts'));
  assert(/rpc\('open_injury_protocol'/.test(route) && /rpc\('move_injury_stage'/.test(route) && !/from\('injury_protocols'\)\s*\.(insert|update)/.test(route), 'the route writes through the functions only');
}

console.log('\n4. C2 — the athlete status screen: three questions, answers as sentences');
{
  assert(canITrainToday({ status: null, reason: null, restrictions: [] }).sentence === 'Not known yet.', 'nothing set: "Not known yet."');
  assert(canITrainToday({ status: 'available', reason: null, restrictions: [] }).sentence === 'Yes.', 'available: "Yes."');
  assert(canITrainToday({ status: 'modified', reason: 'injury', restrictions: ['no_contact'] }).sentence === 'Yes, with limits.', 'modified: "Yes, with limits."');
  assert(/because of an injury/.test(canITrainToday({ status: 'unavailable', reason: 'injury', restrictions: [] }).sub ?? ''), 'unavailable names the reason category, never a diagnosis');
  assert(whatCanIDo({ status: 'modified', restrictions: ['no_contact', 'gym_only'], label: (v) => v }).rows.length === 2, 'restrictions are rows, one each');
  assert(whatCanIDo({ status: 'modified', restrictions: [], note: 'No contact this week', label: (v) => v }).rows.join() === 'No contact this week' && whatCanIDo({ status: 'modified', restrictions: [], note: null, label: (v) => v }).sentence === 'No restriction is recorded.', 'with no restriction recorded the club\'s note is the row; with neither, the sentence');
  assert(whatCanIDo({ status: 'modified', restrictions: ['Stage 2 only', 'no_contact'], label: (v) => v }).rows.join() === 'Stage 2 only,no_contact' && restrictionLine(['Stage 2 only', 'no_contact']).join() === 'no_contact', 'the page passes the line through restrictionLine before whatCanIDo (checked below)');
  assert(whenAmIBack({ status: 'modified', expectedReturn: '2026-09-20', today: '2026-09-14', clearedOn: null, format: (d) => d }).sentence === 'Expected back 2026-09-20.', 'an expected return ahead is the sentence');
  assert(whenAmIBack({ status: 'unavailable', expectedReturn: null, today: '2026-09-14', clearedOn: null, format: (d) => d }).sentence === 'No date yet.', 'no expected return: "No date yet." — words, not a blank');
  assert(whenAmIBack({ status: 'available', expectedReturn: null, today: '2026-09-14', clearedOn: '2026-09-10', format: (d) => d }).sentence === 'You are back.', 'the cleared state after an injury');
  assert(stageLadder(3, 6, false).map((r) => r.state).join() === 'done,done,now,next,later,later', 'the ladder: Done, Now, Next, Later');
  assert(stageLadder(null, null, false).length === 0 && stageLadder(2, 4, true).every((r) => r.state === 'cleared'), 'no protocol, no ladder; cleared reads Cleared on every rung');
  const page = strip(read('src/app/(athlete)/me/status/page.tsx'));
  assert(/restrictionLine\(current\?\.restrictions\)/.test(page), 'the page strips protocol and stage from the line before answering');
  assert(/data-status-card="train"/.test(page) && /data-status-card="do"/.test(page) && /data-status-card="back"/.test(page), 'three cards, in the order the questions are asked');
  assert(/If the club sets different return rules for academy athletes, they appear here\. None are recorded\./.test(page), 'the academy slot is a place, not a policy');
  assert(/For you and your medical team/.test(page) && /fetchAthleteInjuryClinical/.test(page), 'the medical detail sits lower, labelled, through the age-gated clinical view');
  assert(!/pill-good|pill-warn|pill-bad/.test(page), 'no pills on the answers');
  const me = strip(read('src/app/(athlete)/me/page.tsx'));
  assert(/href="\/me\/status"/.test(me), 'Me carries the standing door');
  const banner = strip(read('src/components/AvailabilityBanner/AvailabilityBanner.tsx'));
  assert(/href="\/me\/status"/.test(banner), 'so does the availability card on Today');
  const tab = strip(read('src/components/AthleteTabBar/AthleteTabBar.tsx'));
  assert(!/me\/status/.test(tab), 'it is not a tab');
}

console.log('\n5. C6 — rehab proposals: proposed, approved, returned, one list both roles see (0124)');
{
  const body = sql(read('supabase/migrations/0124_proposal_states.sql'));
  assert(/add value if not exists 'returned'/.test(body), 'assignment_status gains returned');
  assert(/add column return_reason text/.test(body) && /add column decided_by uuid/.test(body) && /add column decided_at timestamptz/.test(body), 'the reason and the decision live on the assignment row both roles read');
  const fn = body.slice(body.indexOf('function public.decide_proposal'));
  assert(/array\['medic'\]/.test(fn) && /42501/.test(fn), 'decide_proposal is the medic\'s');
  assert(/reason_required/.test(fn) && /not_a_proposal/.test(fn), 'a return needs a reason; only a proposed row can be decided');
  assert(/'active'/.test(fn) && /programme_signed_off/.test(fn), 'approve assigns: active, with the sign-off event as before');
  const q = strip(read('src/lib/queries/proposals.ts'));
  assert(/'proposed' \| 'approved' \| 'returned'/.test(q) && /return_reason/.test(q), 'one row shape with three states');
  const page = strip(read('src/app/(staff)/programmes/proposals/page.tsx'));
  assert(/CLINICAL_ONLY/.test(page) && /INJURY_PROGRAMME_PROPOSER/.test(page) && /refuse\(db, 'proposals'/.test(page), 'the S&C and the medic; everyone else refused');
  assert(/isMedic && r\.state === 'proposed'/.test(page) && /rpc|\/decide/.test(page), 'the medic decides on the row; the S&C reads');
  assert(/data-return-reason/.test(page) && /\{r\.return_reason\}/.test(page), 'a returned row carries the reason in full');
  assert(/className="btn-primary">\s*Approve/.test(page) && /className="btn-ghost">\s*Return with the reason/.test(page), 'approve is the one primary; return is secondary under the reason');
  const route = strip(read('src/app/(staff)/programmes/proposals/[assignmentId]/decide/route.ts'));
  assert(/rpc\('decide_proposal'/.test(route) && !/from\('programme_assignments'\)/.test(route), 'the route writes through decide_proposal only');
  const tl = strip(read('src/lib/queries/injuryTimeline.ts'));
  assert(/rpc\('decide_proposal'/.test(tl) && !/\.update\(\{ status: 'active' \}\)/.test(tl), 'the injury record\'s sign-off and send-back go through the same function');
  const prog = strip(read('src/app/(staff)/programmes/page.tsx'));
  assert(/href="\/programmes\/proposals"/.test(prog), 'the door is on Gym programme');
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
