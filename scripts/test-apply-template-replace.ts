/* Applying a week template REPLACES the week — PATTERN-S4 C7, ruled 2026-09-13
 * (batch B7), built 2026-09-14.
 *
 * The three strategies (add alongside / replace planned / fill gaps) are gone.
 * What the replace keeps, because removing it would destroy something: a
 * session with recorded attendance or ratings, and the fixture's own match
 * session; a template's MD-0 match is not created on a day that already has
 * the fixture's. The consequence is named before the button, in B11's dialog
 * ("This will remove 4 sessions already in this week and add 9 from the
 * template."), from one pure function the preview caption shares.
 */
import { readFileSync } from 'node:fs';
import { buildApplyPlan, type ExistingSession } from '@/lib/queries/weekTemplates';
import { applyConsequence, applyKeeps, applySkipped } from '@/lib/applyTemplateWords';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const session = (key: string, type: string, title: string) => ({
  key, type: type as 'training', title, startTime: '10:00', durationMin: 60, location: null, plannedRpe: null,
});
const requires = { wellness: true, rpe: true, nutrition: false };
const structure = {
  anchor: 'fixture' as const,
  days: [
    { mdOffset: -2, requires, sessions: [session('t1', 'training', 'Skills'), session('g1', 'gym', 'Lower')] },
    { mdOffset: -1, requires, sessions: [session('t2', 'training', 'Team run')] },
    { mdOffset: 0, requires, sessions: [session('m', 'match', 'Match')] },
    { mdOffset: 3, requires, sessions: [session('x', 'recovery', 'Off-week recovery')] },
  ],
} as unknown as Parameters<typeof buildApplyPlan>[0];
const week = [
  { date: '2026-09-14', mdOffset: -5 }, { date: '2026-09-15', mdOffset: -4 }, { date: '2026-09-16', mdOffset: -3 },
  { date: '2026-09-17', mdOffset: -2 }, { date: '2026-09-18', mdOffset: -1 }, { date: '2026-09-19', mdOffset: 0 },
  { date: '2026-09-20', mdOffset: 1 },
];
const ex = (id: string, date: string, extra: Partial<ExistingSession> = {}): ExistingSession => ({
  id, date, status: 'planned', hasData: false, sessionType: 'training', fixtureId: null, ...extra,
});

console.log('the plan replaces the week');
{
  const plan = buildApplyPlan(structure, week, [
    ex('a', '2026-09-14'), ex('b', '2026-09-17'), ex('c', '2026-09-18', { status: 'cancelled' }),
    ex('d', '2026-09-16', { hasData: true }),
    ex('fx', '2026-09-19', { sessionType: 'match', fixtureId: 'fixture-1' }),
    ex('other', '2026-09-22'),
  ]);
  assert(plan.softDelete.sort().join(',') === 'a,b,c', 'every session in the week without recorded data is removed, whatever its day or status');
  assert(!plan.softDelete.includes('d') && plan.keepCount === 1, 'a session with recorded attendance or ratings stays, and is counted');
  assert(!plan.softDelete.includes('fx') && plan.keepsMatch, 'the fixture\'s own match session stays');
  assert(!plan.softDelete.includes('other'), 'a session outside the week is not touched');
  assert(plan.create.length === 3 && !plan.create.some((c) => c.session.type === 'match'), 'the template\'s MD-0 match is not created on top of the fixture\'s');
  assert(plan.unmappedPositions.length === 1 && plan.unmappedPositions[0] === 3, 'a template position with no day this week is reported, not silently dropped');
}
{
  const plan = buildApplyPlan(structure, week, []);
  assert(plan.create.length === 4 && plan.create.some((c) => c.session.type === 'match' && c.mdOffset === 0), 'with no fixture match in the week, the template\'s match is created at MD');
  assert(plan.softDelete.length === 0 && plan.keepCount === 0 && !plan.keepsMatch, 'an empty week removes nothing');
}

console.log('\nthe consequence sentence');
assert(applyConsequence({ create: 9, softDelete: 4, keep: 0, keepsMatch: false, unmapped: [] }) === 'This will remove 4 sessions already in this week and add 9 from the template.', 'the ruling\'s own sentence, verbatim');
assert(applyConsequence({ create: 1, softDelete: 1, keep: 0, keepsMatch: false, unmapped: [] }) === 'This will remove 1 session already in this week and add 1 from the template.', 'singulars');
assert(applyConsequence({ create: 5, softDelete: 0, keep: 0, keepsMatch: false, unmapped: [] }) === 'This will remove nothing already in this week and add 5 from the template.', 'nothing to remove says so');
assert(applyKeeps({ create: 0, softDelete: 0, keep: 2, keepsMatch: true, unmapped: [] }) === '2 sessions with recorded attendance or ratings and the match stay.', 'what stays is named');
assert(applyKeeps({ create: 0, softDelete: 0, keep: 0, keepsMatch: true, unmapped: [] }) === 'The match stays.', 'the match alone');
assert(applyKeeps({ create: 0, softDelete: 0, keep: 0, keepsMatch: false, unmapped: [] }) === '', 'nothing kept, nothing said');
assert(applySkipped({ create: 0, softDelete: 0, keep: 0, keepsMatch: false, unmapped: [3] }) === '1 template position has no matching day this week and will be skipped.', 'a skipped position is named');

console.log('\nthe screen');
const controls = strip(readFileSync('src/components/ApplyControls/ApplyControls.tsx', 'utf8'));
const page = strip(readFileSync('src/app/(staff)/schedule/planner/apply/page.tsx', 'utf8'));
const queries = strip(readFileSync('src/lib/queries/weekTemplates.ts', 'utf8'));
assert(!/replace_planned|fill_gaps|'add'/.test(controls + page) && /ApplyStrategy = 'replace'/.test(queries), 'the three strategies are gone: there is one way to apply');
assert(/<Dialog/.test(controls) && /tone="warn"/.test(controls), 'the confirmation is B11\'s dialog, warn-toned (a soft delete nobody can undo from a screen)');
const dialogStart = controls.indexOf('<Dialog');
const consequenceAt = controls.indexOf('applyConsequence(planSummary)', dialogStart);
const primaryAt = controls.indexOf('Replace the week', dialogStart);
assert(consequenceAt > -1 && primaryAt > -1, 'the dialog carries the consequence and a primary that says what it does');
assert(/actions=\{/.test(controls) && /data-apply-consequence/.test(controls), 'the consequence is the dialog\'s body, the button its action row — the sentence is read before the button');
assert(/Keep the week as it is/.test(controls), 'the way out says what it keeps');
assert(/aria-haspopup="dialog"/.test(controls), 'the opener announces the dialog');
assert(/session_attendance/.test(page) && /training_entries/.test(page), 'the preview reads the same two tables as the write to decide what stays');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
