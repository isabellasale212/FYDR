/* PATTERN-S7 C1, first commit (2026-09-13): the report catalogue and the
 * shell's definition slot. docs/reports-catalogue.md is canonical; the module
 * mirrors its Definition sentences verbatim; ReportHeader and PdfHeader carry
 * a definition; the compliance report (the board's "full shell" artboard)
 * passes it on screen, in print (the card is not .no-print) and in both
 * exports' headers. One report a commit after this. */
import { readFileSync } from 'node:fs';
import { REPORT_DEFINITIONS, reportDefinition } from '@/lib/reportCatalogue';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the catalogue and the module agree');
{
  const doc = read('docs/reports-catalogue.md');
  const defs = [...doc.matchAll(/^\*\*Definition\.\*\* (.+)$/gm)].map((m) => m[1]!.trim());
  assert(defs.length === 6, 'six definitions in the doc');
  const keys = ['compliance', 'injuries', 'training', 'athlete', 'squad', 'testing'] as const;
  for (const [i, key] of keys.entries()) {
    assert(REPORT_DEFINITIONS[key] === defs[i], `${key}: the module's sentence is the doc's, verbatim`);
  }
  assert(reportDefinition('compliance').startsWith('Who has submitted'), 'reportDefinition reads the map');
  for (const key of keys) {
    const d = REPORT_DEFINITIONS[key];
    assert(/\.$/.test(d) && d.length <= 200 && !/\d+%/.test(d), `${key}: one sentence, in words, no figure a number below could contradict`);
  }
  assert(/not in the repository/.test(doc) && /reconciled/.test(doc), 'the doc says where it came from and what happens when the real catalogue lands');
}

console.log('\n2. the shell carries the definition');
{
  const header = strip(read('src/components/ReportHeader/ReportHeader.tsx'));
  assert(/definition\?: string;/.test(header) && /\{definition \? \(\s*<div className="card rhead-definition">\s*<p>\{definition\}<\/p>\s*<\/div>\s*\) : null\}/.test(header), 'ReportHeader renders the sentence as a --surf card above the numbers');
  const css = strip(read('src/styles/base.css'));
  assert(/\.rhead-definition\s*\{[^}]*max-width:\s*100ch;[^}]*\}/.test(css) && /\.rhead-definition p\s*\{[^}]*margin:\s*0;[^}]*\}/.test(css), 'capped at 100ch, body text, no extra margin');
  assert(!/\.rhead-definition\s*\{[^}]*(#[0-9a-f]{3,6}|\d+px)/i.test(css), 'composed from the system: no raw hex, no raw px');
  const pdf = strip(read('src/lib/pdf.tsx'));
  assert(/definition\?: string;/.test(pdf) && /\{definition \? <Text style=\{pdfStyles\.definition\}>\{definition\}<\/Text> : null\}/.test(pdf), 'PdfHeader renders it under the title');
}

console.log('\n3. compliance, the full shell');
{
  const page = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/definition: reportDefinition\('compliance'\),/.test(page), 'on screen (through ReportPager\'s header props)');
  const csv = strip(read('src/app/(staff)/reports/compliance/export/route.ts'));
  assert(/`# \$\{reportDefinition\('compliance'\)\}\\r\\n` \+/.test(csv), 'in the CSV header, first line');
  const pdf = strip(read('src/app/(staff)/reports/compliance/pdf/route.tsx'));
  assert(/definition=\{reportDefinition\('compliance'\)\}/.test(pdf), 'in the PDF header');
  assert(/definition sentence/i.test(read('docs/screens/20-compliance-report.md')), 'the spec says so');
}

/* One report a commit after compliance. Each: the definition on screen
   (ReportPager header props or a direct ReportHeader), first line of the CSV,
   under the PDF's title, and a line in its spec. */
const DONE: { key: string; dir: string; spec: string; csv?: string; pdf?: string; screen?: RegExp }[] = [
  { key: 'injuries', dir: 'injuries', spec: 'docs/screens/24-injury-report.md' },
  { key: 'training', dir: 'training', spec: 'docs/screens/23-training-report.md' },
  /* The athlete report's header is its own (one athlete, a breadcrumb), so
     the card is composed in the page with the shared header's classes. */
  { key: 'athlete', dir: 'athlete/[athleteId]', spec: 'docs/screens/19-athlete-report.md', screen: /<div className="card rhead-definition"[^>]*>\s*<p>\{reportDefinition\('athlete'\)\}<\/p>\s*<\/div>/ },
  { key: 'squad', dir: 'squad', spec: 'docs/screens/21-squad-weekly-report.md' },
  { key: 'testing', dir: 'testing', spec: 'docs/screens/22-testing-report.md' },
];
assert(DONE.length === 5, 'with compliance in §3, all six reports carry the sentence');
console.log('\n4. the reports that carry it so far');
for (const r of DONE) {
  const page = strip(read(`src/app/(staff)/reports/${r.dir}/page.tsx`));
  assert((r.screen ?? new RegExp(`definition(: |=\\{)reportDefinition\\('${r.key}'\\)`)).test(page), `${r.key}: on screen`);
  const csv = strip(read(r.csv ?? `src/app/(staff)/reports/${r.dir}/export/route.ts`));
  assert(new RegExp("`# \\$\\{reportDefinition\\('" + r.key + "'\\)\\}\\\\r\\\\n` \\+").test(csv), `${r.key}: first line of the CSV`);
  const pdf = strip(read(r.pdf ?? `src/app/(staff)/reports/${r.dir}/pdf/route.tsx`));
  assert(new RegExp(`definition=\\{reportDefinition\\('${r.key}'\\)\\}`).test(pdf), `${r.key}: under the PDF's title`);
  assert(/definition sentence/i.test(read(r.spec)), `${r.key}: the spec says so`);
}
{
  const csv = strip(read('src/app/(staff)/reports/training/export/route.ts'));
  assert((csv.match(/reportDefinition\('training'\)/g) ?? []).length === 2, 'training: both the training and the match CSV carry it');
  const pdf = strip(read('src/app/(staff)/reports/training/pdf/route.tsx'));
  assert((pdf.match(/definition=\{reportDefinition\('training'\)\}/g) ?? []).length === 2, 'training: both PDFs carry it (the two no-data headers do not — nothing to define over)');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
