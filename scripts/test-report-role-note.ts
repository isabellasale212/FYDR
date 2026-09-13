/* PATTERN-S7 C10 + C11 (2026-09-13). C10: the role note on the report — one
 * sentence under the definition saying what this reader sees that another
 * role does not, or what is withheld and whose it is; built from access.ts's
 * sets; null where the report reads the same for every role. C11: on a phone
 * the exports sit first under the title (CSS order on .rhead alone), and the
 * training board says its phone reading is the PDF. */
import { readFileSync } from 'node:fs';
import { reportRoleNote } from '@/lib/reportRoleNote';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. C10 — the note, from the sets');
{
  assert(/^Medical: you see the diagnosis and the clinical columns\. Coaches, the sport scientist and S&C do not/.test(reportRoleNote('injuries', ['medic']) ?? ''), 'injuries, medic: what they see that others do not');
  assert(/^Status, restriction and expected return only\. The diagnosis and the clinical detail are the medic’s/.test(reportRoleNote('injuries', ['coach']) ?? ''), 'injuries, coach: what is withheld and whose it is');
  assert(reportRoleNote('injuries', ['coach', 'medic'])?.startsWith('Medical:') === true, 'a dual-role reader with the medic role reads as medical');
  assert(/^Nutritionist: the nutrition domain only/.test(reportRoleNote('compliance', ['nutritionist']) ?? ''), 'compliance, nutritionist: the one domain');
  assert(reportRoleNote('compliance', ['coach']) === null && reportRoleNote('compliance', ['nutritionist', 'coach']) === null, 'compliance reads the same for every other role — no note');
  assert(/^Medical:/.test(reportRoleNote('athlete', ['medic']) ?? '') && /^Nutritionist: availability is shown as a status/.test(reportRoleNote('athlete', ['nutritionist']) ?? '') && /^Availability and the restriction line only/.test(reportRoleNote('athlete', ['strength_conditioning']) ?? ''), 'athlete report: three readings');
  for (const key of ['squad', 'testing', 'training'] as const) assert(reportRoleNote(key, ['coach']) === null && reportRoleNote(key, ['medic']) === null, `${key}: no difference, no note`);
  const src = strip(read('src/lib/reportRoleNote.ts'));
  assert(/hasAnyRole\(roles, CLINICAL_ONLY\)/.test(src) && !/'medic'\s*\]/.test(src.replace(/roles\.every\(\(r\) => r === 'nutritionist'\)/, '')), 'the medic reading comes from access.ts\'s CLINICAL_ONLY set, not a hand-written role name');
}

console.log('\n2. C10 — on the reports');
{
  const header = strip(read('src/components/ReportHeader/ReportHeader.tsx'));
  assert(/roleNote\?: string \| null;/.test(header) && /\{roleNote \? <p className="tiny rhead-rolenote">\{roleNote\}<\/p> : null\}/.test(header), 'the header carries it under the definition, nothing for null');
  assert(/roleNote: reportRoleNote\('injuries', claims\.roles\),/.test(strip(read('src/app/(staff)/reports/injuries/page.tsx'))), 'injuries');
  assert(/roleNote: reportRoleNote\('compliance', claims\.roles\),/.test(strip(read('src/app/(staff)/reports/compliance/page.tsx'))), 'compliance');
  assert(/reportRoleNote\('athlete', claims\.roles\)/.test(strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'))), 'the athlete report, composed');
  assert(/role note/i.test(read('docs/screens/24-injury-report.md')) && /role note/i.test(read('docs/screens/20-compliance-report.md')) && /role note/i.test(read('docs/screens/19-athlete-report.md')), 'the three specs say so');
}

console.log('\n3. C11 — exports first under the title on a phone');
{
  const css = strip(read('src/styles/base.css'));
  const phone = css.slice(css.indexOf('.rhead > * {'), css.indexOf('.rhead > * {') + 400);
  assert(/\.rhead > \* \{\s*order: 3;/.test(phone) && /\.rhead > \.rhead-chips \{\s*order: 0;/.test(phone) && /\.rhead > \.rhead-title \{\s*order: 1;/.test(phone) && /\.rhead > \.rhead-eyerow \{\s*order: 2;/.test(phone), 'chips, title, then the eyebrow-and-exports row, then the rest — by order, on a phone');
  const before = css.slice(0, css.indexOf('@media (max-width: 767px) {\n  .rhead {'));
  assert(!/\.rhead\s*\{[^}]*display:\s*flex/.test(before), 'desktop is untouched: .rhead is not flex outside the phone query');
  assert(/\.tr-phone-note\s*\{[^}]*display:\s*none;/.test(css) && /@media \(max-width: 767px\) \{\s*\.tr-phone-note \{\s*display: block;/.test(css), 'the training board\'s phone note draws on a phone only');
  assert(/On a phone, read it as the PDF — Export PDF is above\./.test(strip(read('src/app/(staff)/reports/training/page.tsx'))), 'and says the board\'s phone reading is the PDF');
  assert(/exports first/i.test(read('docs/screens/23-training-report.md')), 'the training spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
