/* PATTERN-S7 C3 + PATTERN-S8 C8 (2026-09-13): the export dialog names the
 * file before it is written; the file reads its own filters back; the
 * audit row carries the row count; a medical export carries the line;
 * B11's one dialog pattern, built once. */
import { readFileSync } from 'node:fs';
import { MEDICAL_EXPORT_LINE, exportAuditMetadata, exportCaption, exportFileName, exportSentences, type ExportDescriptor } from '@/lib/exportDescriptor';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const d: ExportDescriptor = { fileName: exportFileName('compliance', '2026-08-17', '2026-09-13'), report: 'Compliance report', window: 'Last 28 days: 2026-08-17 to 2026-09-13', scope: 'Forwards (15 athletes)', rows: 15, rowNoun: 'athlete', filters: [], medical: false };

console.log('1. one descriptor, three readers');
{
  assert(d.fileName === 'compliance-2026-08-17-to-2026-09-13.csv', 'the file is named from its window');
  const lines = exportSentences(d);
  assert(lines[0] === 'Compliance report, Last 28 days: 2026-08-17 to 2026-09-13. Scope: Forwards (15 athletes).', 'the report, its window and its scope with the count');
  assert(lines[1] === 'No filter beyond the window and the scope above.', 'no filter is said, not left blank');
  assert(lines[2] === '15 rows, one per athlete.', 'the row count with its noun');
  assert(lines[3] === 'Written to the audit log with your name and the row count.', 'the audit sentence, before the button');
  const m = exportSentences({ ...d, medical: true, filters: ["The medic's copy"] }, { exportedBy: 'Ruth Callaghan', at: '13 Sept 2026, 19:00' });
  assert(m[1] === "Filters: The medic's copy." && m[3] === MEDICAL_EXPORT_LINE && /^Exported by Ruth Callaghan on 13 Sept 2026, 19:00; written to the audit log with the row count\.$/.test(m[4]!), 'the medical line on the medic\'s copy; the file names who exported it');
  const cap = exportCaption(d, 'The definition sentence.');
  assert(cap.startsWith('# The definition sentence.\r\n# Compliance report, ') && cap.split('\r\n').filter(Boolean).every((l) => l.startsWith('# ')), 'the file header: the definition first, every line a # comment, CRLF');
  assert(exportSentences({ ...d, rows: 1 })[2] === '1 row, one per athlete.' && exportSentences({ ...d, rows: 1988 })[2] === '1,988 rows, one per athlete.', 'singular and thousands');
  const meta = exportAuditMetadata(d);
  assert(meta.file === d.fileName && meta.rows === 15 && meta.format === 'csv' && Array.isArray(meta.filters), 'the audit row carries the file and the row count');
}

console.log('\n2. the one dialog pattern (B11)');
{
  const tokens = read('src/styles/tokens.css');
  assert(/--w-dialog: 640px;/.test(tokens) && /2026-09-13/.test(tokens.slice(tokens.indexOf('--w-dialog') - 900, tokens.indexOf('--w-dialog'))), 'the token, at its approved value, dated');
  const dlg = strip(read('src/components/Dialog/Dialog.tsx'));
  assert(/<dialog/.test(dlg) && /showModal\(\)/.test(dlg) && /onCancel=/.test(dlg) && /aria-labelledby=\{titleId\}/.test(dlg), 'the native dialog: showModal, cancel, a labelled title');
  const css = strip(read('src/styles/base.css'));
  assert(/\.dlg \{[^}]*width: min\(var\(--w-dialog\), calc\(100vw - 2 \* var\(--sp-16\)\)\)/.test(css) && /\.dlg::backdrop/.test(css), '--w-dialog wide, clamped to the viewport with the gutter, a scrim');
  assert(/\.dlg-actions \.btn-primary,\s*\.dlg-actions \.btn-ghost \{[^}]*min-height: 44px/.test(css), 'its buttons are 44px');
  const users = ['src/components/ExportDialog/ExportDialog.tsx'].map((p) => strip(read(p)));
  assert(users.every((u) => /<Dialog/.test(u)), 'the export dialog uses it');
}

console.log('\n3. every export route and page');
{
  const routes = ['compliance', 'injuries', 'squad', 'testing', 'training'].map((k) => [k, strip(read(`src/app/(staff)/reports/${k}/export/route.ts`))] as const);
  const athleteRoute = strip(read('src/app/(staff)/reports/athlete/[athleteId]/export/route.ts'));
  for (const [k, r] of [...routes, ['athlete', athleteRoute] as const]) {
    assert(/exportCaption\(descriptor/.test(r) && /\.\.\.exportAuditMetadata\(descriptor\)/.test(r) && /csvResponse\([^)]*descriptor\.fileName\)/.test(r), `${k}: the file header and the audit row read the same descriptor, the file takes its name`);
  }
  assert(/medical: isMedical/.test(routes[1]![1]) && /The medic's copy/.test(routes[1]![1]), 'injuries: the medic\'s copy is marked medical');
  assert(/Ranked test: \$\{selectedTestName\}/.test(routes[3]![1]), 'testing: the ranked test is a filter the file reads back');
  assert(/Session: v \$\{selected\.opponent\}/.test(routes[4]![1]) && /Session: \$\{selected\.title\}/.test(routes[4]![1]), 'training: the session is a filter the file reads back');
  const pages = ['compliance', 'injuries', 'squad', 'testing', 'training'].map((k) => strip(read(`src/app/(staff)/reports/${k}/page.tsx`)));
  const athletePage = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  for (const [i, p] of [...pages, athletePage].entries()) {
    assert(/<ExportDialog/.test(p) && !/>\s*Export CSV\s*<\/a>/.test(p.replace(/exportDescriptor \? \([\s\S]*?\) : \(\s*<a[^>]*>\s*Export CSV\s*<\/a>\s*\)/, '')), `page ${i}: Export CSV opens the dialog`);
  }
  const gen = strip(read('src/app/(staff)/settings/exports/generate/route.ts'));
  assert(/exportCaption\(descriptor, null/.test(gen) && /fileCounts\.push\(\{ file: filename, domain: key, rows: rowCount \}\)/.test(gen) && /files: fileCounts, rows: fileCounts\.reduce/.test(gen), 'the export builder: every file reads its filters back; the audit row carries the counts per file');
  assert(/Body mass omitted — not visible to your role/.test(gen), 'and a coach\'s wellness file says the column was omitted');
  assert(/dialog/i.test(read('docs/screens/17-reports-hub.md')) && /row count/i.test(read('docs/screens/61-exports.md')), 'the specs say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
