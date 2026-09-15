/* PATTERN-S7 C1 (reconciled 2026-09-13): the report catalogue and the shell's
 * definition slot. docs/reports-catalogue-source.md is Isabella's and is not
 * edited; docs/reports-catalogue.md is the working copy reconciled against it;
 * src/lib/reportCatalogue.ts mirrors the working copy's sentences verbatim.
 * The source's confirmed sentences must appear in the working copy word for
 * word; the reports that carry a sentence carry it on screen, in print and in
 * both exports; the two with none (training — raised; match — on hold) carry
 * none anywhere. */
import { readFileSync } from 'node:fs';
import { REPORT_DEFINITIONS, TRAINING_LOAD_DEFINITION, TRAINING_LOAD_OFF_STATE, athleteDefinition, matchDefinition, reportDefinition } from '@/lib/reportCatalogue';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the source, the working copy and the module agree');
{
  const source = read('docs/reports-catalogue-source.md');
  const work = read('docs/reports-catalogue.md');
  const sourceSentence = (heading: string) => {
    const sec = source.slice(source.indexOf(`## ${heading}`));
    return sec.match(/\*\*Definition sentence \(draft\):\*\* "([^"]+)"/)?.[1] ?? null;
  };
  /* The addendum's confirmed sentences are blockquotes under a bold name. */
  const addendum = source.slice(source.indexOf('# Addendum, 13 September 2026'));
  const addendumSentence = (name: string) => {
    /* The name appears in the naming table first; the sentence sits under
       its second, bold-heading occurrence in "Definition sentences, confirmed". */
    const confirmed = addendum.slice(addendum.indexOf('## Definition sentences, confirmed'));
    const sec = confirmed.slice(confirmed.indexOf(`**${name}**`));
    const q = sec.match(/\n> ([\s\S]*?)\n\n/);
    return q ? q[1]!.replace(/\n> /g, ' ').trim() : null;
  };
  const workSentence = (heading: string) => {
    const sec = work.slice(work.indexOf(`## ${heading}`));
    return sec.match(/\*\*Definition sentence[^:]*:\*\* "([^"]+)"/)?.[1] ?? null;
  };
  for (const [src, wrk, key] of [
    ['3. Squad weekly report', '3. Squad weekly report', 'squad'],
    ['4. Athlete report', '4. Athlete report', 'athlete'],
    ['5. Testing report', '5. Testing report', 'testing'],
  ] as const) {
    const s = sourceSentence(src);
    const w = workSentence(wrk);
    assert(s !== null && s === w, `${key}: the working copy carries the source's confirmed sentence verbatim`);
    assert(REPORT_DEFINITIONS[key] === s, `${key}: the module mirrors it`);
  }
  /* Reconciled 2026-09-13 against the addendum (ruling four), then built
     (the training report split): the drafts are gone; the GPS board is the
     GPS report at /reports/gps and carries the GPS sentence; the Training
     load report is the seventh, at /reports/training-load, with the
     addendum's sentence and its off state. */
  for (const [name, wrk, key] of [
    ['GPS report', '1. GPS report', 'gps'],
    ['Training load report', '8. Training load report', 'trainingLoad'],
    ['Compliance report', '6. Compliance', 'compliance'],
  ] as const) {
    const a = addendumSentence(name);
    const w = workSentence(wrk);
    assert(a !== null && a === w, `${key}: the working copy carries the addendum's confirmed sentence verbatim`);
    assert(REPORT_DEFINITIONS[key] === a, `${key}: the module mirrors it`);
  }
  /* Injuries: the addendum's sentence, corrected by Isabella's ruling of 14
     September 2026 (decision batch #5): the medic's copy carries diagnosis,
     mechanism and SEVERITY — three, not four — and clinical notes are in no
     export. The batch states the correction, not the sentence, so the sentence
     is checked against both: the addendum's first half verbatim, the second
     half naming the three and the notes' absence. The source still carries
     the pre-ruling sentence and is not edited (it is the source). */
  {
    const a = addendumSentence('Injury and availability report');
    const w = workSentence('7. Injury and availability');
    const batch14 = read('docs/decisions/decision-batch-2026-09-14.md');
    assert(/THREE extra columns, not four: diagnosis, mechanism, severity/.test(batch14) && /catalogue sentence is corrected to name the three/.test(batch14), 'injuries: the 14 Sept batch rules three columns and a corrected sentence');
    const firstHalf = a?.split('. ')[0];
    assert(!!firstHalf && !!w && w.startsWith(`${firstHalf}. `), 'injuries: the working copy keeps the addendum\'s first sentence verbatim');
    assert(!!w && /Diagnosis, mechanism and severity appear only in the medic's copy/.test(w) && /clinical notes are in no export/.test(w), 'injuries: and names the three, with clinical notes in no export');
    assert(REPORT_DEFINITIONS.injuries === w, 'injuries: the module mirrors it');
  }
  assert(TRAINING_LOAD_DEFINITION === REPORT_DEFINITIONS.trainingLoad, 'the seventh report\'s sentence is one string, named twice');
  const off = addendum.slice(addendum.indexOf('Its off state')).match(/\n> ([\s\S]*?)\n\n/)![1]!.replace(/\n> /g, ' ').trim();
  assert(off === TRAINING_LOAD_OFF_STATE, 'and its off state');
  assert(!/drafted by the builder, pending/.test(work) && !/draft, builder/.test(work), 'no draft remains in the working copy');
  assert(!/pending confirmation|builder\'s drafts pending/.test(read('src/lib/reportCatalogue.ts')), 'no draft remains in the module');
  assert(/must state which entry types it counted/.test(work), 'the compliance rule that comes with the sentence is recorded');
  /* 15 Sept 2026: the match report has its sentence, confirmed in the decision
     batch (not the source, whose draft it supersedes). The working copy and
     the module carry it verbatim. */
  const batch = read('docs/decisions/decision-batch-2026-09-13.md');
  const batchSentence = batch.slice(batch.indexOf('**Definition sentence, confirmed**')).match(/\n> ([\s\S]*?)\n\n/)?.[1]?.replace(/\n> /g, ' ').trim() ?? null;
  const matchWork = workSentence('2. Match report');
  assert(batchSentence !== null && batchSentence === matchWork, 'match: the working copy carries the decision batch\'s confirmed sentence verbatim');
  assert(REPORT_DEFINITIONS.match === batchSentence, 'match: the module mirrors it');
  assert(matchDefinition('v Harlequins, Sat 18 Jul').startsWith('Everything recorded against v Harlequins, Sat 18 Jul: who was selected'), 'and resolves its placeholder');
  assert(/did \*\*not\*\* record who played or minutes/.test(work) && /now closed/.test(work), 'match: the open question is answered and closed in the working copy');
  assert(athleteDefinition({ athlete: 'Dan Okonkwo', start: 'Mon 17 Aug', end: 'Sun 13 Sept' }) === 'Everything recorded for Dan Okonkwo between Mon 17 Aug and Sun 13 Sept. Sections with no data say so rather than showing zeros.', 'the athlete sentence resolves its three placeholders');
  assert(reportDefinition('squad') === REPORT_DEFINITIONS.squad, 'reportDefinition reads the map');
  assert(!/Do not edit this file/.test(work) && /SOURCE OF TRUTH/.test(source), 'the source is the source; the working copy does not claim to be');
}

console.log('\n2. the shell carries the definition');
{
  const header = strip(read('src/components/ReportHeader/ReportHeader.tsx'));
  assert(/definition\?: string;/.test(header) && /\{definition \? \(\s*<div className="card rhead-definition">\s*<p>\{definition\}<\/p>\s*<\/div>\s*\) : null\}/.test(header), 'ReportHeader renders the sentence as a --surf card above the numbers, nothing for none');
  const css = strip(read('src/styles/base.css'));
  assert(/\.rhead-definition\s*\{[^}]*max-width:\s*100ch;[^}]*\}/.test(css), 'capped at 100ch');
  const pdf = strip(read('src/lib/pdf.tsx'));
  assert(/definition\?: string;/.test(pdf) && /\{definition \? <Text style=\{pdfStyles\.definition\}>\{definition\}<\/Text> : null\}/.test(pdf), 'PdfHeader renders it under the title, nothing for none');
}

console.log('\n3. the reports that carry a sentence carry it everywhere; the two without carry it nowhere');
{
  const withSentence: { key: 'compliance' | 'injuries' | 'squad' | 'testing' | 'trainingLoad'; dir: string; spec: string; viaPager: boolean }[] = [
    { key: 'compliance', dir: 'compliance', spec: 'docs/screens/20-compliance-report.md', viaPager: true },
    { key: 'injuries', dir: 'injuries', spec: 'docs/screens/24-injury-report.md', viaPager: true },
    { key: 'squad', dir: 'squad', spec: 'docs/screens/21-squad-weekly-report.md', viaPager: false },
    { key: 'testing', dir: 'testing', spec: 'docs/screens/22-testing-report.md', viaPager: true },
    { key: 'trainingLoad', dir: 'training-load', spec: 'docs/screens/65-training-load-report.md', viaPager: false },
  ];
  for (const r of withSentence) {
    const page = strip(read(`src/app/(staff)/reports/${r.dir}/page.tsx`));
    assert(new RegExp(r.viaPager ? `definition: reportDefinition\\('${r.key}'\\) \\?\\? undefined,` : `definition=\\{reportDefinition\\('${r.key}'\\) \\?\\? undefined\\}`).test(page), `${r.key}: on screen`);
    const csv = strip(read(`src/app/(staff)/reports/${r.dir}/export/route.ts`));
    // Repointed 2026-09-13 (PATTERN-S7 C3): the definition reaches the CSV
    // through exportCaption(descriptor, reportDefinition(key)), which writes
    // it as the first `#` line when the catalogue has one.
    assert(new RegExp(`exportCaption\\(descriptor, reportDefinition\\('${r.key}'\\)`).test(csv), `${r.key}: first line of the CSV`);
    const pdf = strip(read(`src/app/(staff)/reports/${r.dir}/pdf/route.tsx`));
    assert(new RegExp(`definition=\\{reportDefinition\\('${r.key}'\\) \\?\\? undefined\\}`).test(pdf), `${r.key}: under the PDF's title`);
    assert(/definition sentence/i.test(read(r.spec)), `${r.key}: the spec says so`);
  }
  const athletePage = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/<p>\{athleteDefinition\(\{ athlete: `\$\{athlete\.first_name\} \$\{athlete\.last_name\}`, start: formatDate\(report\.from, timezone\), end: formatDate\(report\.to, timezone\) \}\)\}<\/p>/.test(athletePage), 'athlete: the resolved sentence on screen');
  assert(/athleteDefinition\(\{ athlete: `\$\{athlete\.first_name\} \$\{athlete\.last_name\}`, start: report\.from, end: report\.to \}\)/.test(strip(read('src/app/(staff)/reports/athlete/[athleteId]/export/route.ts'))), 'athlete: in the CSV');
  assert(/definition=\{athleteDefinition\(\{/.test(strip(read('src/app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx'))), 'athlete: in the PDF');
  /* The eighth (15 Sept 2026): the match report resolves its sentence for the
     fixture on screen, in the CSV's first line and under the PDF's title. */
  assert(/definition=\{matchDefinition\(fx\)\}/.test(strip(read('src/app/(staff)/reports/match/page.tsx'))), 'match: the resolved sentence on screen');
  assert(/exportCaption\(descriptor, matchDefinition\(fx\)/.test(strip(read('src/app/(staff)/reports/match/export/route.ts'))), 'match: first line of the CSV');
  assert(/definition=\{matchDefinition\(fx\)\}/.test(strip(read('src/app/(staff)/reports/match/pdf/route.tsx'))), 'match: under the PDF\'s title');
  assert(/definition sentence/i.test(read('docs/screens/67-match-report.md')), 'match: the spec says so');
  /* Reconciled 2026-09-13 against the addendum (ruling four): the training-mode
     board is the GPS report and carries the confirmed GPS sentence on screen,
     in the CSV and in the PDF; the match board is kept but its sentence is
     not yet written, so it carries none anywhere. */
  const gps = strip(read('src/app/(staff)/reports/gps/page.tsx'));
  assert(/definition=\{mode === 'training' \? \(reportDefinition\('gps'\) \?\? undefined\) : undefined\}/.test(gps), 'gps: the GPS sentence on the training-session board only');
  const gpsCsv = strip(read('src/app/(staff)/reports/gps/export/route.ts'));
  assert((gpsCsv.match(/exportCaption\(descriptor, reportDefinition\('gps'\)/g) ?? []).length === 1 && (gpsCsv.match(/exportCaption\(descriptor, null/g) ?? []).length === 1, 'the GPS CSV carries the sentence; the match CSV carries none');
  const gpsPdf = strip(read('src/app/(staff)/reports/gps/pdf/route.tsx'));
  assert((gpsPdf.match(/definition=\{reportDefinition\('gps'\) \?\? undefined\}/g) ?? []).length === 1 && /title="Match day GPS report"\s*definition=\{undefined\}/.test(gpsPdf), 'the GPS PDF carries the sentence; the match PDF carries none');
}

console.log('\n4. the split (the addendum): two names, two routes, neither called "Training report"');
{
  assert(/title: 'GPS report · Fydr'/.test(read('src/app/(staff)/reports/gps/page.tsx')) && /title: 'Training load report · Fydr'/.test(read('src/app/(staff)/reports/training-load/page.tsx')), 'the two titles');
  const hub = strip(read('src/app/(staff)/reports/page.tsx'));
  assert(/key: 'gps'[\s\S]*?premiumGated: true/.test(hub) && /key: 'trainingLoad'[\s\S]*?premiumGated: false/.test(hub), 'the hub: GPS premium, Training load every club');
  assert(!/title: 'Training report'/.test(hub) && !/reports\/training'/.test(hub), 'no card is called "Training report" and none links to the old address');
  assert(/permanentRedirect\(`\/reports\/gps/.test(read('src/app/(staff)/reports/training/page.tsx')), 'the old address redirects to /reports/gps, query and all');
  const page = strip(read('src/app/(staff)/reports/training-load/page.tsx'));
  assert(/if \(!collectsRpe\)/.test(page) && /body=\{TRAINING_LOAD_OFF_STATE\}/.test(page) && /href: '\/settings\/club#rpe'/.test(page), 'the Training load report keeps its destination and carries the off state, pointing at the setting');
  assert(/TRAINING_LOAD_OFF_STATE/.test(strip(read('src/app/(staff)/reports/training-load/export/route.ts'))) && /TRAINING_LOAD_OFF_STATE/.test(strip(read('src/app/(staff)/reports/training-load/pdf/route.tsx'))), 'so do its CSV and PDF');
  assert(/'No ratings'/.test(page) && /No ratings/.test(read('src/app/(staff)/reports/training-load/export/route.ts')), 'nothing rated is words, never 0, on screen and in the file');
  const q = strip(read('src/lib/queries/trainingLoadReport.ts'));
  assert(/\.eq\('domain', 'training_rpe'\)/.test(q) && /if \(!expected\.has\(k\)\) continue;/.test(q) && /total_load: rated > 0 \? total : null/.test(q), 'the query counts only expected sessions and never sums an unrated one as zero');
  assert(/from\('training_entries_current'\)/.test(q), 'a corrected rating is what is summed');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
