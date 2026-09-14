/* One renderer for print and PDF — PATTERN-S7 C4, ruled 2026-09-13 (batch
 * B10), built 2026-09-14: "the PDF survives and Print opens it; printing
 * becomes a two-step action, accepted." No print stylesheet, no
 * window.print(); every Print control is a PrintLink to the screen's own PDF
 * route, opened in a new tab with an inline disposition; every PDF route
 * honours `?open=1` through pdfDisposition; the two screens that had no PDF
 * (the dashboard's availability board, the availability history) have one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk('src');
const read = (p: string) => strip(readFileSync(p, 'utf8'));

console.log('nothing prints the live screen');
assert(!files.some((f) => f.endsWith('.css') && /@media\s+print/.test(read(f))), 'no @media print block in any stylesheet');
assert(!files.some((f) => /window\.print\(\)/.test(read(f))), 'no window.print() anywhere');
assert(!files.some((f) => /PrintButton/.test(read(f))), 'components/PrintButton is gone');

console.log('\nPrint opens the PDF');
const link = read('src/components/PrintLink/PrintLink.tsx');
assert(/open=1/.test(link) && /target="_blank"/.test(link) && /rel="noopener"/.test(link), 'PrintLink opens the PDF inline, in a new tab');
assert(/<a /.test(link) && !/<button/.test(link), 'a link, not a button: it navigates');
const uses = files.filter((f) => /<PrintLink/.test(read(f)));
assert(uses.length === 5, `five screens carry Print (${uses.length}): dashboard, injuries, availability history, the athlete's test, the testing report`);
for (const f of uses) {
  const src = read(f);
  const at = src.indexOf('<PrintLink');
  const tag = src.slice(at, src.indexOf('/>', at));
  assert(/href=\{`[^ ]*\/pdf/.test(tag), `${f.replace(/^src\/app\/\(staff\)\//, '')}: Print's href is a PDF route`);
}

console.log('\nevery PDF route honours ?open=1');
const pdfRoutes = files.filter((f) => /\/pdf\/route\.tsx$/.test(f));
assert(pdfRoutes.length === 12, `twelve PDF routes (${pdfRoutes.length}): the ten there were, the availability board, the availability history`);
for (const f of pdfRoutes) {
  const src = read(f);
  const calls = src.match(/pdfResponse\(/g) ?? [];
  const withDisposition = src.match(/pdfDisposition\(request\)\)/g) ?? [];
  assert(calls.length > 0 && calls.length === withDisposition.length, `${f.replace(/^src\/app\/\(staff\)\//, '')}: ${calls.length} pdfResponse call${calls.length === 1 ? '' : 's'}, all with the request's disposition`);
}
const pdf = read('src/lib/pdf.tsx');
assert(/searchParams\.get\('open'\) === '1' \? 'inline' : 'attachment'/.test(pdf), 'inline only on ?open=1; Export PDF stays an attachment');

console.log('\nthe board and the history are documents of their own');
const board = read('src/app/(staff)/dashboard/pdf/route.tsx');
assert(/fetchSaturdayReadiness/.test(board) && /leadCardNames\(version\)/.test(board), 'the availability board is the dashboard\'s own split, names per the version');
assert(!/fetchSelectionReasons|injury_clinical|diagnosis/.test(board), 'and carries no clinical line — a printed sheet is an export');
const history = read('src/app/(staff)/squad/[athleteId]/availability/pdf/route.tsx');
assert(/buildHistory\(ledger, names\)/.test(history) && /recordReportView/.test(history), 'the availability history PDF is the screen\'s own rows, recorded like its CSV');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
