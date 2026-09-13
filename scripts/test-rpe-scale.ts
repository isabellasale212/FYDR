/* The RPE package, change three (Isabella, 2026-09-13): the session rating
 * is CR-10, 0 to 10; 0 is a real rating meaning rest. Zero is falsy, so
 * this also pins the sweep's finding: no RPE value is tested for
 * truthiness anywhere it decides presence. */
import { readFileSync } from 'node:fs';
import { CR10_ANCHORS, CR10_SCALE, TrainingEntryInput } from '@/lib/validation/training';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the scale');
{
  assert(CR10_SCALE.length === 11 && CR10_SCALE[0] === 0 && CR10_SCALE[10] === 10, 'eleven steps, 0 to 10');
  assert(CR10_ANCHORS[0] === 'Rest' && CR10_ANCHORS[10] === 'Maximal', '0 is Rest, 10 is Maximal');
  const base = { id: '00000000-0000-4000-8000-000000000001', session_id: null, entry_date: '2026-09-13', duration_min: 45 };
  assert(TrainingEntryInput.safeParse({ ...base, rpe: 0 }).success, 'the athlete\'s schema accepts 0');
  assert(!TrainingEntryInput.safeParse({ ...base, rpe: -1 }).success && !TrainingEntryInput.safeParse({ ...base, rpe: 11 }).success, 'and refuses -1 and 11');
  assert(!TrainingEntryInput.safeParse({ ...base, rpe: 0.5 }).success, 'whole numbers only from the athlete\'s control');
  const correction = strip(read('src/lib/validation/entryCorrection.ts'));
  assert(/rpe: z\.number\(\)\.min\(0\)\.max\(10\)\.multipleOf\(0\.5\)/.test(correction), 'a coach\'s correction accepts 0, half steps');
  const list = strip(read('src/components/CR10List/CR10List.tsx'));
  assert(/Session rating, 0 to 10/.test(list), 'the list\'s legend says 0 to 10');
  const panel = strip(read('src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx'));
  assert(/RPE \(0–10\)/.test(panel) && /RPE is 0–10 in half-point steps \(0 is rest\)/.test(panel), 'the correction form says 0–10 and what 0 is');
}

console.log('\n2. the database');
{
  const mig = read('supabase/migrations/0117_rpe_scale_0_to_10.sql');
  assert(/add constraint training_entries_rpe_check check \(rpe between 0 and 10\)/.test(mig), '0117 widens the check to 0–10');
  assert(/Rows written before 0117 were entered on a 1-to-10 control/.test(mig) && /NO back-conversion/.test(mig), 'and records that earlier rows were written on 1 to 10, with no back-conversion');
  assert(/planned_rpe stays 1–10/.test(mig) && /gym_set_logs\.rpe/.test(mig), 'the two scales that are not the session rating are named as left');
  const t = read('supabase/tests/720_rpe_scale_0_to_10_test.sql');
  assert(/a session rated 0 \(rest\) is accepted/.test(t) && /a rated-0 session carries a load of 0\.0, a real value/.test(t) && /planned_rpe stays 1 to 10/.test(t), 'the pgTAP test: 0 accepted with a real load, the ends refused, planned RPE untouched');
}

console.log('\n3. zero is never read as missing (the sweep, pinned)');
{
  const files = ['src/lib/acwr.ts', 'src/lib/queries/analytics.ts', 'src/lib/format.ts', 'src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx', 'src/components/RpeForm/RpeForm.tsx', 'src/components/GymSessionLogger/GymSessionLogger.tsx', 'src/lib/complianceRpe.ts', 'src/lib/queries/reports.ts', 'src/lib/queries/schedule.ts', 'src/lib/queries/athleteReport.ts', 'src/app/(athlete)/my-data/page.tsx', 'src/lib/outboxQueue.ts', 'src/lib/queries/training.ts'];
  const truthy = /(^|[^a-zA-Z_.])(!\s*)?[a-zA-Z_.]*(\brpe|_rpe|Rpe|session_load|sessionLoad)\b\s*(\?[^?.:]|&&|\|\|)|\bif \(!?[a-zA-Z_.]*(\brpe|_rpe|Rpe|session_load)\b\)|(\brpe|session_load)\s*\|\|\s*0\b|Boolean\([a-zA-Z_.]*(rpe|session_load)/;
  for (const f of files) {
    const src = strip(read(f)).split('\n').filter((l) => !/=== null|!== null|\?\?|=== undefined|!== undefined|typeof |rpeIsDue|rpeDue|requires\.rpe|requires_rpe|\.rpe: |rpe:\s|rpeExpectations|Rpe\(|rpeRows|rpeSession|rpeWhen|rpeRowName|rpeSubmissions|isRpe|rpeState|rpe\.expected|rpe\.submitted|RpeForm|meanRpe/.test(l));
    const hits = src.filter((l) => truthy.test(l));
    assert(hits.length === 0, `${f.split('/').slice(-1)[0]}: no RPE or load value is tested for truthiness${hits.length ? ` — ${hits[0]!.trim().slice(0, 80)}` : ''}`);
  }
  assert(/if \(e\.entry_date === null \|\| e\.session_load === null\) continue;/.test(read('src/lib/acwr.ts')), 'loadByDateFrom keeps a load of 0 as a day with data');
  assert(/0 to 10 since 13 September 2026/.test(read('docs/athlete/screens/03-session-rating.md')) && /0 is a real rating meaning rest/.test(read('docs/metrics.md')), 'the athlete spec and MET-007 say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
