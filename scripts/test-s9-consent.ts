/* PATTERN-S9 (Isabella, 2026-09-13): athlete consent, first run, install
 * teaching. Grows with each artboard's commit. Section 1 is the schema and the
 * legal gate; the rest pin the screens as they land. */
import { readFileSync } from 'node:fs';
import { CONSENT_VERSION, LEGAL_PLACEHOLDERS } from '@/lib/legalPlaceholders';
import { consentState, consentStateLabel, entryFormsOpen, maskEmail } from '@/lib/consentState';
import { passwordRules, rulesMet, unmetLine } from '@/lib/passwordRules';
import { displayModeFrom, platformFrom } from '@/lib/installState';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sql = (s: string) => s.replace(/^\s*--.*$/gm, '');

console.log('1. the record: two, and only one named');
{
  const mig = read('supabase/migrations/0120_athlete_consent_and_guardian.sql');
  const body = sql(mig);
  assert(!/rename column consent_given_at|rename column consent_version/.test(body), 'consent_given_at and consent_version are not renamed');
  assert(/comment on column public\.athletes\.consent_given_at is[\s\S]*?lawful-basis-open\.md/.test(mig), 'and their comment points at docs/decisions/lawful-basis-open.md');
  for (const c of ['consent_declined_at', 'consent_withdrawn_at', 'health_consent_given_at', 'health_consent_version', 'health_consent_declined_at', 'health_consent_withdrawn_at', 'guardian_name', 'guardian_email']) {
    assert(new RegExp(`add column ${c}\\s`).test(body), `athletes.${c}`);
  }
  assert(/add column in_data boolean generated always as \(\s*consent_given_at is not null and consent_declined_at is null and consent_withdrawn_at is null\s*\) stored/.test(body), 'in_data is generated from the performance record alone');
  assert(/add value if not exists 'guardian_link'/.test(body), 'the online guardian route is one value of parental_consent_method; the offline values stay');
  assert(/comment on column public\.athletes\.parental_consent_recorded_by is[\s\S]*?There is no parent login: the guardian''s page is a single-use link with no account behind it/.test(mig), 'the "There is no parent login" comment is reworded in the same migration as the guardian field');
  for (const t of ['wellness_entries', 'training_entries', 'gym_session_logs', 'gym_set_logs', 'nutrition_checkins']) {
    assert(new RegExp(`create policy ${t}_in_data on public\\.${t} as restrictive for insert`).test(body), `${t}: a restrictive in_data insert policy (replaces nothing)`);
  }
  assert(/create policy injuries_health_consent on public\.injuries as restrictive for insert/.test(body), 'injuries: the health decision gates a new row');
  assert(/create table public\.guardian_consent_requests/.test(body) && /revoke all on public\.guardian_consent_requests from public, anon, authenticated/.test(body), 'guardian_consent_requests, with 0090\'s default-privilege discipline');
  assert(/grant execute on function public\.guardian_request_by_token\(text\) to anon/.test(body) && /grant execute on function public\.guardian_decide\(text, text\) to anon/.test(body), 'the guardian page reads and writes through two anon-callable functions, never the table');
  assert(/and a\.in_data/.test(body) && /where exists \(select 1 from public\.athletes a where a\.id = c\.athlete_id and a\.in_data\)/.test(body), 'the generator asks nothing of an athlete not in data');
  assert(/new\.consent_given_at is distinct from old\.consent_given_at/.test(body) && /new\.guardian_email is distinct from old\.guardian_email/.test(body) && /new\.parental_consent_method is distinct from old\.parental_consent_method/.test(body), 'the self-update guard refuses the consent, guardian and parental columns');
  assert(/consent_version = 'seed-pre-S9'/.test(body) && !/health_consent_given_at = now\(\)[\s\S]*?seed/.test(body.slice(body.indexOf('9. Seed backfill'))), 'the seed backfill writes the performance record only');
  /* Decision batch 14 September 2026, #6: the backfill is removed — every
     existing athlete goes through the flow on next open. 0120 is applied and
     stays; 0129 reverses exactly the rows it stamped, by their version mark. */
  const reversal = read('supabase/migrations/0129_remove_consent_backfill.sql');
  assert(/set consent_given_at = null, consent_version = null\s+where consent_version = 'seed-pre-S9'/.test(reversal), '0129 reverses the backfill by its version mark and nothing else');
  assert(!/health_consent/.test(reversal.replace(/--.*$/gm, '')), 'and touches no health column');
  const t = read('supabase/tests/750_athlete_consent_test.sql');
  assert(/declined: a morning check-in does not land/.test(t) && /the guardian agrees/.test(t) && /single use/.test(t) && /health declined: the medic cannot open an injury/.test(t) && /a hole closed/.test(t), 'pgTAP 750 covers the gates, the guardian route, single use and the guard');
}

console.log('\n2. the legal gate');
{
  const refs = Object.keys(LEGAL_PLACEHOLDERS);
  assert(['LEGAL-1A', 'LEGAL-3A', 'LEGAL-3B', 'LEGAL-3C', 'LEGAL-3D', 'LEGAL-3E', 'LEGAL-3F', 'LEGAL-4A'].every((r) => refs.includes(r)), 'the seven placeholders and LEGAL-3F (finding 2) are named');
  for (const [id, p] of Object.entries(LEGAL_PLACEHOLDERS)) {
    assert(!/\b(consent|agree|process|lawful|legitimate interest)\b.*\b(you|your)\b/i.test(p.needs) || /wording|what is needed|whether|who holds/i.test(p.needs), `${id}: the caption says what is needed, not what it might say`);
  }
  const comp = strip(read('src/components/LegalPlaceholder/LegalPlaceholder.tsx'));
  assert(/className="legal-pending"/.test(comp) && /data-legal=\{id\}/.test(comp) && /solicitor to supply/.test(comp), 'the drawn pattern: the reference and who supplies it');
  const css = strip(read('src/styles/base.css'));
  assert(/\.legal-pending \{[^}]*border: 1px dashed var\(--border-pending\);[^}]*background: var\(--pending-fill\);[^}]*border-radius: var\(--r\);/.test(css), 'dashed --border-pending on --pending-fill at the one radius');
  assert(/\.legal-pending\[data-lines='2'\] \{ min-height: 64px; \}/.test(css), 'sized for the expected length');
  const tokens = read('src/styles/tokens.css');
  assert(/--tap-min: 44px;/.test(tokens) && /--tap-commit: 56px;/.test(tokens), '--tap-min and --tap-commit named');
  assert(/--border-pending: var\(--border-strong\);/.test(tokens) && /--pending-fill: var\(--surf2\);/.test(tokens), '--border-pending and --pending-fill are aliases, no new values');
  assert(/\.consent-choice \{[^}]*min-height: var\(--tap-commit\);[^}]*background: var\(--surf\);[^}]*border: 1px solid var\(--accent\);/.test(css) && !/\.consent-choice \{[^}]*ring-action/.test(css), 'the two equal choices: 56px, --surf, the accent line, no halo');
  assert(CONSENT_VERSION.startsWith('placeholder:LEGAL-3A+3B:'), 'the stored version names the placeholders until LEGAL-3D is drafted');
}

console.log('\n3. the state, pure');
{
  const base = { in_data: false, consent_given_at: null, consent_declined_at: null, consent_withdrawn_at: null };
  assert(consentState({ ...base, in_data: true, consent_given_at: 'x' }, false) === 'in_data', 'in data');
  assert(consentState(base, false) === 'undecided' && consentState(base, true) === 'guardian_pending', 'undecided; a minor waits on a guardian');
  assert(consentState({ ...base, consent_declined_at: 'x' }, false) === 'declined' && consentState({ ...base, consent_given_at: 'x', consent_withdrawn_at: 'y' }, false) === 'withdrawn', 'declined and withdrawn');
  assert(consentStateLabel('declined') === 'No data consent' && consentStateLabel('guardian_pending') === 'Guardian consent outstanding', 'the staff words, no judgement');
  assert(entryFormsOpen('in_data') && !entryFormsOpen('declined') && !entryFormsOpen('guardian_pending') && !entryFormsOpen('undecided') && !entryFormsOpen('withdrawn'), 'only in_data opens the four forms');
  assert(maskEmail('b.rafferty@gmail.com') === 'b***@***.com', 'the masked address');
}

console.log('\n4. artboard 1 — invite received, setting a password');
{
  /* Two rules since 14 September 2026 (decision batch #7): the third — "not
     a password you already use somewhere else" — was removed entirely, not
     made a checkbox and not a system tick; a rule software cannot check is
     theatre. Nothing about reuse anywhere on the screen. */
  const rules = passwordRules({ password: '', firstName: 'Niall', lastName: 'Rafferty', clubName: 'Ashcombe Rugby Club' });
  assert(rules.length === 2 && rules.every((r) => r.state === 'unchecked'), 'two rules, all unchecked before typing — a dash means not checked yet, not failed');
  assert(!rules.some((r) => (r.id as string) === 'unique'), 'and the reuse rule is gone');
  const nine = passwordRules({ password: 'raffert1x', firstName: 'Niall', lastName: 'Rafferty', clubName: 'Ashcombe Rugby Club' });
  assert(nine[0]!.state === 'unmet' && nine[0]!.detail === ' — this has 9' && unmetLine(nine, 'raffert1x') === 'Add 3 more characters. This one is 9 of the 12 needed.', '9 characters: the one rule not met says what it needs');
  assert(rulesMet(passwordRules({ password: 'orchard-sparrow-99', firstName: 'Niall', lastName: 'Rafferty', clubName: 'Ashcombe Rugby Club' })) === 2, 'a long password with no name in it: 2 of 2');
  assert(passwordRules({ password: 'ashcombe-orchard-99', firstName: 'Niall', lastName: 'Rafferty', clubName: 'Ashcombe Rugby Club' })[1]!.state === 'unmet', 'the club’s name in it: rule two unmet');
  const form = strip(read('src/components/ResetConfirmForm/ResetConfirmForm.tsx'));
  assert(/Two rules, stated before you type/.test(form) && !/reuse|somewhere else|use nowhere else|type="checkbox"/.test(form), 'the form says two rules and nothing about reuse — no checkbox, no advice line');
  assert(!/reuse|somewhere else|nowhere else/.test(strip(read('src/lib/passwordRules.ts'))), 'nor does the module');
  assert(/Fydr never asks for a password by email or by message/.test(form), 'the one sentence that does the work');
  assert(/<LegalPlaceholder id="LEGAL-1A" \/>/.test(form), 'LEGAL-1A drawn, undrafted');
  assert(/\{met\} of \{rules\.length\} rules met/.test(form), 'the count with its denominator');
  assert(/aria-disabled=\{blocked \|\| undefined\}/.test(form) && /if \(blocked\) return;/.test(form), 'the action is blocked, not dimmed, and nothing is sent while a rule is unmet');
  assert(/Next you will read what staff can see, then make one choice\./.test(form), 'the athlete is told what comes next');
  assert(/data-emphasis/.test(form) && /Sent to \{invite\.recipientMasked\}/.test(form), 'the identity block is the emphasised card and the address is masked');
  const ctx = strip(read('src/lib/inviteContext.ts'));
  assert(/createAdminClient\(\)/.test(ctx) && /\.eq\('org_id', o\.orgId\)\.eq\('entity_type', 'users'\)\.eq\('entity_id', o\.userId\)/.test(ctx), 'the inviter is read from the account’s own creation audit row, scoped to the verified session');
  const add = strip(read('src/components/AddAthleteForm/AddAthleteForm.tsx'));
  assert(/isUnder18\(dateOfBirth\)/.test(add) && /data-guardian/.test(add) && /guardian-email/.test(add), 'the Add athlete form captures the guardian once the date of birth makes the athlete under 18');
  const route = strip(read('src/app/(staff)/squad/new/create/route.ts'));
  assert(/if \(minor && email\)/.test(route) && /needs a guardian’s name before they can be invited/.test(route) && /guardianEmail === email/.test(route), 'and the route requires it the moment an under-18 is invited, and refuses the athlete’s own address');
  const bulk = strip(read('src/app/(staff)/settings/users/bulk-invite/send/route.ts'));
  assert(/is under 18 and no guardian is recorded/.test(bulk) && /is under 18: add them with the Add athlete form/.test(bulk), 'the bulk invite refuses an under-18 with no guardian, by name');
}

console.log('\n5. artboard 2 — what staff can see, verified against the code');
{
  const vis = strip(read('src/lib/staffVisibility.ts'));
  assert(/createAdminClient\(\)/.test(vis) && /\.eq\('org_id', orgId\)/.test(vis), 'the club\'s own staff, read for the athlete\'s own club');
  /* 0122 (PATTERN-S3 C8): the coach card is worded from the club's own
     setting — the board's "no body site or side" while it is off, the honest
     wider sentence while it is on. Never a general claim. */
  assert(/coach_sees_injury_site/.test(vis) && /the body site or side of an injury/.test(vis) && /COACH_SEES_SITE/.test(vis) && /role === 'coach' && coachSeesSite \? COACH_SEES_SITE/.test(vis), 'the coach card says what the club\'s injury-site setting enforces, in both positions');
  assert(/your diagnosis, your treatment notes, the body site or side of an injury, or your weight/.test(vis), 'the coach card leads with the boundary that is enforced: no diagnosis, no treatment notes, no site or side, no weight');
  const page = strip(read('src/app/(athlete)/consent/staff/page.tsx'));
  assert(/Step 2 of 3 · nothing decided yet/.test(page) && /data-emphasis/.test(page) && /nobody can change it — not you, not the club/.test(page) && /A day you do not answer stays empty/.test(page), 'the two facts already true are the one emphasised card');
  assert(/\{total\} of \{total\} roles listed/.test(page), 'the roles count carries its denominator');
  const tab = strip(read('src/components/AthleteTabBar/AthleteTabBar.tsx'));
  assert(/pathname\.startsWith\('\/consent\/'\)\) return null/.test(tab), 'no tab bar inside the first run');
  const session = strip(read('src/lib/session.ts'));
  assert(/if \(mustDecide && !opts\.allowUndecided\) redirect\('\/consent\/staff'\)/.test(session), 'the gate: an undecided athlete is sent to the flow from every athlete page');
  assert(/state === 'guardian_pending' && !guardianRequestSent/.test(session), 'a minor is undecided until the guardian link has been sent once');
  // ADR-005, the immutability claim: no UPDATE policy on the two entry tables (010 asserts it live)
  const rls = read('supabase/tests/010_rls_coverage_test.sql');
  assert(/has NO update policy, corrections are new revision rows \(ADR-005\)/.test(rls) && /'wellness_entries', 'training_entries'/.test(rls), 'the immutability claim is what 010 asserts against the database');
}

console.log('\n6. artboard 3 — the decision, and what declining does');
{
  const blocks = strip(read('src/components/ConsentBlocks/ConsentBlocks.tsx'));
  assert(/Performance data/.test(blocks) && /Health and injury data/.test(blocks) && /id="LEGAL-3A"/.test(blocks) && /id="LEGAL-3B"/.test(blocks) && /id="LEGAL-3C"/.test(blocks) && /id="LEGAL-3D"/.test(blocks), 'two blocks, four placeholders');
  assert(/Saying no does not affect selection\./.test(blocks) && /Your club states this\. Fydr records your choice and cannot enforce what a coach does with it\./.test(blocks), 'the sentence and the caption that makes it honest');
  const agree = blocks.indexOf('value="agree"'); const decline = blocks.indexOf('value="decline"');
  assert(agree > 0 && decline > agree && (blocks.match(/className="consent-choice"/g) ?? []).length === 2 && !/btn-primary/.test(blocks) && !/ring-action/.test(blocks), 'two equal choices, agree then decline, no primary, no halo');
  const route = strip(read('src/app/(athlete)/consent/decide/record/route.ts'));
  assert(/db\.rpc\('record_data_consent', \{ p_decision: decision, p_version: CONSENT_VERSION \}\)/.test(route) && /redirect\(decision === 'agree' \? '\/check-in\?first=1' : '\/consent\/declined'\)/.test(route), 'one tap writes through the function; agree lands on the check-in, decline on the state screen');
  assert(/guardian_decides/.test(route), 'a minor is sent to the guardian screen');
  const declined = strip(read('src/app/(athlete)/consent/declined/page.tsx'));
  assert(/Your data · recorded/.test(declined) && /You said no/.test(declined) && /id="LEGAL-3E"/.test(declined) && !/toast|Banner/.test(declined), 'declining is a screen state with the recorded date and time, LEGAL-3E, no toast');
  assert(/never a zero/.test(declined) && /24 of 29/.test(declined), 'the club sees an em dash and 29');
  for (const f of ['src/app/(athlete)/check-in/page.tsx', 'src/app/(athlete)/rpe/[sessionId]/page.tsx', 'src/app/(athlete)/gym/[sessionId]/page.tsx', 'src/app/(athlete)/nutrition-check-in/page.tsx']) {
    assert(/if \(!entryFormsOpen\(consent\.state\)\) return <EntryLocked/.test(strip(read(f))), `${f.split('/').slice(-2).join('/')}: locked while out of data (all four forms, finding 3)`);
  }
  const today = strip(read('src/app/(athlete)/today/page.tsx'));
  /* Since 16 Sept 2026 (1.1) the list is three status cards plus the rating
     rows; while out of data the locked card takes the slot and none of them
     render (`!formsOpen ?` on the slot, the rows emptied). */
  assert(/const rpeItems = !formsOpen\s*\? \[\]/.test(today) && /\{!formsOpen \? \(/.test(today) && /lockedFormLine\(consent\.state\)/.test(today), 'Today lists no entry rows and says the state once');
  const roster = strip(read('src/components/RosterTable/RosterTable.tsx'));
  assert(/row\.consent_state !== 'in_data'/.test(roster) && /consentStateLabel\(row\.consent_state\)\.toLowerCase\(\)/.test(roster), 'the squad list shows the state and its date beside the name');
  const reports = strip(read('src/lib/queries/reports.ts'));
  assert(/notInData/.test(reports) && (reports.match(/\.eq\('in_data', true\)/g) ?? []).length === 1, 'the compliance denominator reads in_data and counts who is out, by state');
  for (const f of ['src/lib/queries/analytics.ts', 'src/lib/queries/trainingLoadReport.ts', 'src/lib/queries/testingReport.ts', 'src/lib/queries/leaderboardWall.ts', 'src/lib/queries/positionalContext.ts', 'src/lib/queries/exportBuilder.ts']) {
    assert(/\.eq\('in_data', true\)/.test(strip(read(f))), `${f.split('/').slice(-1)[0]}: a data denominator reads in_data`);
  }
  assert(!/\.eq\('in_data', true\)/.test(strip(read('src/lib/queries/availability.ts'))) && !/\.eq\('in_data', true\)/.test(strip(read('src/lib/queries/squad.ts'))), 'availability and the roster keep everyone — operational facts, not data consent');
  assert(/not counted, having no data consent in force/.test(read('src/lib/reportFigures.ts')), 'the figure names who is out and why');
  const spec = read('docs/athlete/screens/21-consent-first-run.md');
  assert(/zero haloed primaries/.test(spec) && /not\s+a toast/.test(spec) && /all four/.test(spec) && /not made/.test(spec), '21-consent-first-run.md records the flow and the drift');
}

console.log('\n7. artboard 4 — under 18: the athlete, the guardian, the staff side');
{
  const a = strip(read('src/app/(athlete)/consent/guardian/page.tsx'));
  assert(/Step 3 of 3 · waiting on a guardian/.test(a) && /consent\.guardianEmailMasked/.test(a) && !/guardian_email\b/.test(a), '4A shows the guardian masked, from the club\'s record');
  assert(/does not ask you for your date of birth/.test(a) && !/date_of_birth|ageFrom\(/.test(a), 'no date of birth shown or asked');
  assert(/1 of 1 guardian contacted/.test(a) && /Send the link again/.test(a) && /report-problem\?about=guardian/.test(a) && /id="LEGAL-4A"/.test(a), 'the count, the re-send, the "not my guardian" row to a person, LEGAL-4A');
  assert(/gym logging and the weekly nutrition check-in stay closed/.test(a), 'all four forms named as closed (finding 3)');
  const staff = strip(read('src/app/(athlete)/consent/staff/page.tsx'));
  assert(/consent\.isMinor && !consent\.guardianRequestSent \? \(\s*<form method="post" action="\/consent\/guardian\/send"/.test(staff), 'a minor\'s "Read the choice" is the first send, as a form post');
  const send = strip(read('src/app/(athlete)/consent/guardian/send/route.ts'));
  assert(/sendGuardianLink\(/.test(send) && /actorRole: 'athlete'/.test(send), 'the send route goes through one path, as the athlete');
  const lib = strip(read('src/lib/guardianConsent.ts'));
  assert(/db\.rpc\('request_guardian_consent'/.test(lib) && /new URL\(`\/guardian\/\$\{row\.token\}`, o\.origin\)/.test(lib) && /never shown to the athlete|is the guardian's/.test(read('src/lib/guardianConsent.ts')), 'the token goes into the email and nowhere else');
  const g = strip(read('src/app/guardian/[token]/page.tsx'));
  assert(/rpc\('guardian_request_by_token'/.test(g) && !/from\('guardian_consent_requests'\)/.test(g) && !/requireAthlete|requireStaff/.test(g), '4B reads by token through the function only, with no session');
  assert(/under 18 on the club’s record/.test(g) && !/date_of_birth/.test(g), '"under 18 on the club\'s record" and nothing more precise');
  assert((g.match(/sameAs="same wording as the athlete screen"/g) ?? []).length === 4, 'LEGAL-3A, 3B, 3C and 3D by reference');
  assert(/Saying no does not affect selection\./.test(g) && /The club states this; Fydr records the answer\./.test(g), 'the same sentence, the club speaking');
  const ga = g.indexOf('value="agree"'), gd = g.indexOf('value="decline"');
  assert(ga > 0 && gd > ga && !/btn-primary/.test(g), 'two equal choices, agree then decline, zero haloed primaries');
  assert(/This link is not recognised/.test(g) && /This link has expired/.test(g) && /You agreed\./.test(g), 'unknown, expired and answered states');
  const gr = strip(read('src/app/guardian/[token]/decide/route.ts'));
  assert(/rpc\('guardian_decide'/.test(gr), 'the answer writes through guardian_decide');
  const card = strip(read('src/components/GuardianCard/GuardianCard.tsx'));
  assert(/answered by the guardian on the link/.test(card) && /recorded from the club registration form/.test(card) && /recorded in person/.test(card), 'the staff card says which route was used');
  const sr = strip(read('src/app/(staff)/squad/[athleteId]/guardian/route.ts'));
  assert(/hasAnyRole\(claims\.roles, SETTINGS_ADMIN\)/.test(sr) && /parental_consent_recorded_by: claims\.userId/.test(sr) && /'club_registration_form', 'written_confirmation', 'in_person'/.test(sr), 'the offline route is the sport scientist\'s, one value of parental_consent_method, recorded_by named');
  const tpl = read('src/lib/email/templates.ts');
  assert(/guardianConsentEmail/.test(tpl) && !/consent to the processing|lawful basis|legitimate interest/i.test(tpl), 'the email carries no legal wording');
}

console.log('\n8. artboard 5 — the first check-in');
{
  const page = strip(read('src/app/(athlete)/check-in/page.tsx'));
  /* REPINNED 16 Sept 2026 (Isabella's evening queue, the text rule): the
     first-run card ("no score and no streak …") was helper prose (category
     1) and is gone with the ever-count that decided it; the first run lands
     on the plain form. The landing itself (artboard 5's route) still holds. */
  assert(!/data-first-run/.test(page) && !/There is no score and no streak/.test(page) && !/everCount/.test(page), 'no first-run card since 16 Sept 2026 (the text rule)');
  assert(!/first=1/.test(page.replace(/\/\*[\s\S]*?\*\//g, '')), 'the ?first=1 flag is a landing, not a condition');
  const form = strip(read('src/components/CheckInForm/CheckInForm.tsx'));
  assert(!/tap-commit|56px|minHeight: 56/.test(form), 'ATH-ADULT-03 unchanged: the submit is not raised here (finding 5, for the accessibility sweep)');
}

console.log('\n9. artboard 6 — install teaching, and the two named rows');
{
  assert(platformFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)') === 'ios' && platformFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5) === 'ios' && platformFrom('Mozilla/5.0 (Linux; Android 14)') === 'android' && platformFrom('Mozilla/5.0 (Windows NT 10.0)') === 'desktop', 'the platform rule: iPhone, iPad-as-Mac, Android, desktop');
  assert(displayModeFrom({ matchesStandalone: true, navigatorStandalone: undefined }) === 'standalone' && displayModeFrom({ matchesStandalone: false, navigatorStandalone: true }) === 'standalone' && displayModeFrom({ matchesStandalone: false, navigatorStandalone: false }) === 'browser', 'standalone from the manifest or Safari\'s own flag');
  const card = strip(read('src/components/InstallCard/InstallCard.tsx'));
  assert(/From Fydr, not from/.test(card) && /className="install-close"/.test(card) && /Not now/.test(card), 'marked as Fydr\'s three ways: the eyebrow, the close, the worded dismissal');
  assert(/<b>Add to Home Screen<\/b>, then <b>Add<\/b>/.test(card) && /the square with an arrow coming out of the top/.test(card) && /className="safari-share"/.test(card) && /Share — step 1/.test(card), 'the exact menu items, the share control ringed and labelled');
  assert(/An icon on your Home Screen, no browser bars, and reminders become possible/.test(card) && /do not change/.test(card), 'what changes once added, and what does not');
  assert(/beforeinstallprompt/.test(card) && /Install Fydr/.test(card), 'Android: the browser\'s own install, with the menu route as the fallback');
  assert(!/role="dialog"|role="alertdialog"|<dialog/.test(card), 'it does not imitate a system dialog');
  assert(/Settings › Reminders › Add to Home Screen/.test(card), 'the permanent route is named on the card');
  const today = strip(read('src/app/(athlete)/today/page.tsx'));
  assert(/firstCheckInJustSent = sp\.submitted === '1' &&/.test(today) && /=== 1;/.test(today) && /\{firstCheckInJustSent \? <InstallCard \/> : null\}/.test(today), 'Today shows the card once, after the first check-in — not every open, not a timer');
  assert(!/setInterval|setTimeout/.test(card), 'no timer');
  assert(/data-install-row/.test(strip(read('src/app/(athlete)/me/notifications/page.tsx'))) && /InstallCard canonical/.test(strip(read('src/app/(athlete)/me/reminders/install/page.tsx'))), 'Settings › Reminders › Add to Home Screen is the canonical route');
  const mig = sql(read('supabase/migrations/0121_athlete_devices.sql'));
  assert(/create table public\.athlete_devices/.test(mig) && /revoke all on public\.athlete_devices from public, anon, authenticated/.test(mig) && /platform in \('ios', 'android', 'desktop', 'other'\)/.test(mig) && !/user_agent|device_id/.test(mig), 'athlete_devices: platform and mode only, no device identifier, 0090\'s discipline');
  assert(/rpc\('record_athlete_device'/.test(strip(read('src/components/DeviceBeacon/DeviceBeacon.tsx'))) && /<DeviceBeacon \/>/.test(strip(read('src/app/(athlete)/layout.tsx'))), 'the beacon records how the app is running, once per session, from the shell');
  const reach = strip(read('src/lib/queries/reachability.ts'));
  assert(/display_mode === 'standalone' && d\.push_supported/.test(reach) && /not from a reminder sent/.test(reach) && /of whom/.test(reach) && /not opened the app yet/.test(reach), 'the figure measures the phone\'s readiness and its caption names the cause');
  const squad = strip(read('src/app/(staff)/squad/page.tsx'));
  /* 16 Sept 2026 (Isabella's overnight queue, 3.4): the figure is a small
     status in the top right — "Has app on home screen · N of M" — beside
     Manage groups, the same reachability read; never a compliance figure. */
  assert(/Has app on home screen/.test(squad) && /fetchReachability\(/.test(squad) && !/label="Can receive reminders"/.test(squad) && !/complianceFigure|Submitted of expected/.test(squad), 'on the squad view as a small status in the top right (16 Sept 2026), never merged with a compliance figure');
  // the withdrawal row and LEGAL-3F
  const dc = strip(read('src/app/(athlete)/me/data-consent/page.tsx'));
  assert(/agreeLabel=\{inData \? 'Keep my consent as it is' : 'I agree to both blocks'\}/.test(dc) && /declineLabel=\{inData \? 'Withdraw my consent' : 'I do not agree'\}/.test(dc), 'the withdrawal screen opens the same two blocks with the opposite pair');
  assert(/id="LEGAL-3F"/.test(dc) && /cannot refuse/.test(dc) && !/\/me\/export|download/i.test(dc), 'the subject access row beside it, with LEGAL-3F and no export');
  assert(/rpc\('withdraw_data_consent'\)/.test(strip(read('src/app/(athlete)/me/data-consent/withdraw/route.ts'))), 'withdrawal writes through the function');
  const me = strip(read('src/app/(athlete)/me/page.tsx'));
  assert(/href="\/me\/data-consent" className="me-row"/.test(me) && /consentStateLabel\(consent\.state\)/.test(me), 'the Me row shows the current state and its date');
  assert(!/recompute|retrospective/i.test(strip(read('src/app/(athlete)/me/data-consent/withdraw/route.ts'))), 'nothing recomputes a published mean either way (finding 4, LEGAL-3E)');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
