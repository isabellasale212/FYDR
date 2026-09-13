/* PATTERN-S8 C9 (2026-09-13): retention states its consequence before the
 * button: rows, athletes, which are current; the preview is logged as its
 * own action and retains no rows (decision batch A6); Run is B11's dialog. */
import { readFileSync } from 'node:fs';
import { retentionConsequence } from '@/lib/retentionWords';
import type { RetentionPreview } from '@/lib/retention/compute';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const base: RetentionPreview = {
  orgId: 'o', computedAt: '2026-09-13T19:00:00Z',
  athletes: { total: 11, current: 2, names: ['Ade Oyelaran', 'Ross Gallagher'] },
  categories: [
    { category: 'Import batch raw files (30 days)', count: 3, cutoffDescription: 'Created before 30 days ago', automated: true },
    { category: 'Injury clinical detail (8 years from closure, longer if under 18)', count: 14, cutoffDescription: 'Closed before 8 years ago', automated: true },
    { category: 'Wellness, training, gym logs (current + 3 completed seasons)', count: 2000, cutoffDescription: 'x', automated: false },
    { category: 'GPS records (current + 3 completed seasons)', count: 150, cutoffDescription: 'x', automated: false },
    { category: 'Test results, body composition (current + 5 completed seasons)', count: 34, cutoffDescription: 'x', automated: false },
  ],
};

console.log('1. the consequence, in words');
{
  const c = retentionConsequence(base);
  assert(c.lead === 'Running now will delete 3 import files older than 30 days, and redact the clinical detail on 14 closed injury records and archive them. This cannot be undone.', `the lead: rows and what happens to them (${c.lead.slice(0, 60)}…)`);
  assert(c.people === 'Those records belong to 11 athletes, 2 of them still on the squad: Ade Oyelaran, Ross Gallagher. Their availability history and everything else about them stays; only the diagnosis, mechanism, notes, treatment plan, imaging and referral go.', 'the athletes, which are current, by name, and what stays');
  assert(c.visibility === '2,184 rows in the 3 preview-only categories are past their period and untouched by this run — shown so the club can see what a fuller retention would remove.', 'the preview-only rows, as visibility');
  assert(c.runnable, 'runnable');
  const none = retentionConsequence({ ...base, athletes: { total: 0, current: 0, names: [] }, categories: base.categories.map((x) => ({ ...x, count: 0 })) });
  assert(/^Nothing is eligible today/.test(none.lead) && none.people === null && !none.runnable && /^0 rows in the 3 preview-only categories are/.test(none.visibility!), 'nothing eligible: says so, Run has nothing to do');
  const one = retentionConsequence({ ...base, athletes: { total: 1, current: 1, names: ['Dan Okonkwo'] }, categories: base.categories.map((x) => (x.automated ? { ...x, count: /Injury/.test(x.category) ? 1 : 0 } : x)) });
  assert(one.lead === 'Running now will redact the clinical detail on 1 closed injury record and archive it. This cannot be undone.' && /^That record belongs to 1 athlete, still on the squad: Dan Okonkwo\./.test(one.people!), 'singular');
  const left = retentionConsequence({ ...base, athletes: { total: 4, current: 0, names: [] } });
  assert(/to 4 athletes, none of them still on the squad\./.test(left.people!), 'none current: said');
}

console.log('\n2. the preview is logged, the run is a dialog');
{
  const preview = strip(read('src/app/(staff)/settings/retention/preview/route.ts'));
  assert(/action: 'retention\.preview'/.test(preview) && /athletes_current: preview\.athletes\.current/.test(preview) && !/names/.test(preview.slice(preview.indexOf('metadata'))), 'A6: the preview writes its own audit row with the counts and retains no rows or names');
  const compute = strip(read('src/lib/retention/compute.ts'));
  assert(/athletes: \{ total: number; current: number; names: string\[\] \}/.test(compute) && /status !== 'left_club'/.test(compute), 'the preview counts the athletes behind the injury records and which are current');
  const panel = strip(read('src/components/RetentionPanel/RetentionPanel.tsx'));
  assert(/retentionConsequence\(preview\)/.test(panel) && /<Dialog/.test(panel) && /tone="bad"/.test(panel) && /Run retention/.test(panel), 'the consequence sits in the card with Run; Run opens B11\'s dialog (bad edge) whose primary is Run retention');
  assert(/consequence\.runnable/.test(panel), 'Run has nothing to do when nothing is eligible');
  assert(/consequence/i.test(read('docs/screens/52-data-retention.md')) && /dialog/i.test(read('docs/screens/52-data-retention.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
