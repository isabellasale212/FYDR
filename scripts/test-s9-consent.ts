/* PATTERN-S9 (Isabella, 2026-09-13): athlete consent, first run, install
 * teaching. Grows with each artboard's commit. Section 1 is the schema and the
 * legal gate; the rest pin the screens as they land. */
import { readFileSync, existsSync } from 'node:fs';
import { CONSENT_VERSION, LEGAL_PLACEHOLDERS } from '@/lib/legalPlaceholders';
import { consentState, consentStateLabel, entryFormsOpen, maskEmail } from '@/lib/consentState';

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
  assert(/\.legal-pending \{[^}]*border: 1px dashed var\(--border-pending\);[^}]*background: var\(--pending-fill\);[^}]*border-radius: var\(--r-control\);/.test(css), 'dashed --border-pending on --pending-fill at the control radius');
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

if (existsSync('src/app/(athlete)/consent/decide/page.tsx')) {
  console.log('\n4. the screens (as they land)');
  // filled in by the artboard commits
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
