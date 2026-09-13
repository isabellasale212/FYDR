/* PATTERN-S8 C6 (2026-09-13): thresholds in plain English with the owner
 * and date the dashboard quotes; a 28-day preview of how many athletes a
 * rule would have flagged, writing nothing. */
import { readFileSync } from 'node:fs';
import { previewSummary, thresholdOwnerLine } from '@/lib/thresholdWords';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the owner line, as the dashboard quotes it');
{
  const a = thresholdOwnerLine({ setBy: 'Jane Pemberton', updatedAt: '2026-08-24T09:00:00Z', timezone: 'Europe/London' });
  assert(/^Set by Jane Pemberton · /.test(a) && /24 Aug/.test(a), `a person: "${a}"`);
  const b = thresholdOwnerLine({ setBy: null, updatedAt: '2026-08-06T09:00:00Z', timezone: 'Europe/London' });
  assert(/^One of the club defaults · unchanged since /.test(b) && /6 Aug/.test(b), `no creator means default (D8): "${b}"`);
  const dash = read('src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx');
  assert(/Thresholds set by \{provenance\.setBy \?\? 'the club defaults'\}/.test(dash), 'the dashboard says "the club defaults" for the same case — one wording');
}

console.log('\n2. the preview, read back with its denominator');
{
  const rows = [
    { athlete_id: 'a', first_name: 'Ross', last_name: 'Gallagher', breach_days: 6, in_scope: 30, window_days: 28 },
    { athlete_id: 'b', first_name: 'Ade', last_name: 'Oyelaran', breach_days: 2, in_scope: 30, window_days: 28 },
    { athlete_id: 'c', first_name: 'Ollie', last_name: 'Hartnell', breach_days: 1, in_scope: 30, window_days: 28 },
  ];
  const s = previewSummary(rows)!;
  assert(s.count === '3 of 30 athletes' && s.flagged === 3 && s.inScope === 30 && s.windowDays === 28, 'the count carries its denominator');
  assert(s.names.join(' | ') === 'Ross Gallagher (6 days) | Ade Oyelaran (2 days) | Ollie Hartnell (1 day)', 'names most days first, with their day counts');
  assert(/^Over the last 28 days this rule would have flagged 3 of 30 athletes it applies to/.test(s.sentence), 'the sentence');
  assert(/writes nothing — no flag, no notification/.test(s.caveat) && /without the cooldown/.test(s.caveat), 'the caveat: writes nothing, cooldown not applied');
  const none = previewSummary([{ athlete_id: null, first_name: null, last_name: null, breach_days: 0, in_scope: 30, window_days: 28 }])!;
  assert(none.count === '0 of 30 athletes' && none.names.length === 0 && /would have flagged nobody among the 30 athletes/.test(none.sentence), 'nobody: still "0 of 30", never a bare 0');
  const empty = previewSummary([{ athlete_id: null, first_name: null, last_name: null, breach_days: 0, in_scope: 0, window_days: 28 }])!;
  assert(/Nobody is in this rule's scope/.test(empty.sentence), 'no athlete in scope: says so, not "0 of 0"');
  assert(previewSummary([]) === null, 'no rows at all (the RPC answered nobody — the wrong role): null, the screen says whose it is');
}

console.log('\n3. the migration, the test, the screens');
{
  const mig = read('supabase/migrations/0113_preview_threshold_rule.sql');
  assert(/create or replace function public\.preview_threshold_rule\(/.test(mig) && /create or replace function public\.preview_threshold\(/.test(mig), 'two functions: a rule as fields, a rule by id');
  assert(/public\._threshold_breach_on_day\(t, a\.id/.test(mig), 'the preview runs the engine\'s own per-day evaluator');
  assert(/if v_state is null then\s*continue;/.test(mig) && /if not v_state then\s*v_all := false;/.test(mig), 'with 0053\'s gap rule: a gap is skipped, a real non-breach ends the run');
  assert(/^stable$/m.test(mig) && !/insert into public\.flags/.test(mig), 'STABLE and writes nothing');
  assert(/auth_has_any_role\(array\['sport_scientist','coach'\]/.test(mig), 'gated to the roles that configure thresholds');
  assert(/^grant execute on function public\.preview_threshold_rule/m.test(mig) && /^grant execute on function public\.preview_threshold\(uuid, int\) to authenticated/m.test(mig), 'callable by the signed-in app');
  const t = read('supabase/tests/690_preview_threshold_rule_test.sql');
  assert(/no flag row was written|no row written by any preview/.test(t) && /the medic gets an empty preview/.test(t) && /anonymous gets nothing/.test(t), 'the pgTAP test covers writes-nothing, the medic, anonymous');

  const q = strip(read('src/lib/queries/thresholds.ts'));
  assert(/created_by, updated_at, applies_to_group_id'/.test(q) && /export async function fetchThresholdOwnerNames/.test(q), 'the rule carries its creator and date');
  assert(/rpc\('preview_threshold_rule'/.test(q) && /rpc\('preview_threshold'/.test(q), 'both RPCs wrapped');
  const page = strip(read('src/app/(staff)/settings/thresholds/page.tsx'));
  assert(/fetchThresholdOwnerNames\(db, thresholds\.map\(\(t\) => t\.created_by\)\)/.test(page) && /ownerLine=\{thresholdOwnerLine\(/.test(page), 'the list reads owners once and hands each row its line');
  const row = strip(read('src/components/ThresholdRow/ThresholdRow.tsx'));
  assert(/\{ownerLine\}/.test(row) && /<ThresholdPreview kind="saved" thresholdId=\{threshold\.id\} \/>/.test(row), 'each rule: the owner line and the on-demand preview');
  const form = strip(read('src/components/ThresholdEditorForm/ThresholdEditorForm.tsx'));
  assert(/<ThresholdPreview kind="draft" input=\{previewInput\}/.test(form) && /Enter a value to preview the rule\./.test(form), 'the new-rule form previews the draft before Create');
  const comp = strip(read('src/components/ThresholdPreview/ThresholdPreview.tsx'));
  assert(/previewThreshold\(db, props\.thresholdId, 28\)/.test(comp) && /previewThresholdRule\(db, props\.input!, 28\)/.test(comp) && /previewSummary\(rows\)/.test(comp), 'the component asks for 28 days and reads the summary back');
  assert(/aria-live="polite"/.test(comp) && /summary\.caveat/.test(comp), 'the answer is announced and carries the caveat');
  assert(/28-day preview|preview/i.test(read('docs/screens/58-thresholds.md')) && /owner|set by/i.test(read('docs/screens/58-thresholds.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
