/* A rated session is read-only on BOTH screens, with one sentence —
 * PATTERN-S4 C4 (B6, 13 Sept 2026) on the session screen, and
 * decision-batch-2026-09-15.md #6 on the schedule grid: "A rule that holds
 * on one screen and not the other is worse than no rule, because a coach
 * told they cannot edit will assume they cannot, and then will. Same rule,
 * same wording."
 *
 * Pinned: the sentence lives once (lib/ratedSession.ts) and both screens
 * read it; the week query carries a rating count on every grid row, counted
 * the same way the session screen counts (distinct athletes on the current
 * view); the panel offers no Edit and no fields on a rated session and shows
 * the sentence; a draft can never be rated. */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const copy = read('src/lib/ratedSession.ts');
const page = strip(read('src/app/(staff)/schedule/[sessionId]/page.tsx'));
const panel = strip(read('src/components/ScheduleGrid/SelectedSessionPanel.tsx'));
const workspace = strip(read('src/components/ScheduleGrid/ScheduleWorkspace.tsx'));
const types = strip(read('src/components/ScheduleGrid/types.ts'));
const queries = strip(read('src/lib/queries/schedule.ts'));

console.log('one sentence, read by both screens');
{
  assert(/export function ratedSessionSentence\(ratingCount: number\): string/.test(copy), 'lib/ratedSession.ts exports ratedSessionSentence');
  assert(/This session has been rated by \$\{ratingCount\} \$\{ratingCount === 1 \? 'athlete' : 'athletes'\}\. Ratings are tied to its date and duration, so it cannot be changed\. Cancel it and create a new one if the details are wrong\./.test(copy), 'and it is B6\'s sentence, word for word');
  assert(/ratedSessionSentence\(session\.ratingCount\)/.test(page) && /data-rated-read-only/.test(page), 'the session screen renders it');
  assert(/ratedSessionSentence\(session\.ratingCount\)/.test(panel) && /data-rated-read-only/.test(panel), 'the grid panel renders it');
  assert(!/has been rated by/.test(page) && !/has been rated by/.test(panel), 'neither screen restates the words');
}

console.log('\nthe grid knows the count, counted as the session screen counts');
{
  assert(/ratingCount: number;/.test(types) && /ratingCount: s\.ratingCount,/.test(types), 'BaseSession carries ratingCount from GridSession');
  const detailed = queries.slice(queries.indexOf('export async function fetchWeekSessionsDetailed('), queries.indexOf('export async function', queries.indexOf('export async function fetchWeekSessionsDetailed(') + 10));
  assert(/from\('training_entries_current'\)[\s\S]*?select\('session_id, athlete_id'\)/.test(detailed) && /ratingCount: ratersBySession\.get\(session\.id\)\?\.size \?\? 0/.test(detailed), 'fetchWeekSessionsDetailed counts distinct athletes on training_entries_current per session');
  const detail = queries.slice(queries.indexOf('export async function fetchSessionDetail('));
  assert(/from\('training_entries_current'\)[\s\S]*?\.eq\('session_id', sessionId\)/.test(detail) && /const ratingCount = new Set\(/.test(detail), 'fetchSessionDetail counts the same way, so the two screens say one number');
  assert((workspace.match(/ratingCount: 0,/g) ?? []).length === 2, 'a staged draft and a precommit card are never rated');
}

console.log('\nthe panel offers no edit on a rated session');
{
  assert(/const rated = !!session && !isPrecommitId && session\.ratingCount > 0;/.test(panel), 'rated = an existing session with a rating');
  assert(/!isDraft && mode === 'edit' && !unlocked && !rated \?/.test(panel), 'the header Edit button is withheld');
  // The rated branch runs from its own `rated ? (` to the edit branch that starts with {dayField}.
  const branchStart = panel.indexOf(') : rated ? (');
  const branch = panel.slice(branchStart, panel.indexOf('{dayField}', branchStart));
  assert(branch.length > 0 && !/\{timeFields\}|\{groupField\}|\{locationField\}|\{typeField\}|\{nameField\}/.test(branch), 'the rated branch renders none of the fields');
  assert(/sg-panel-facts/.test(branch) && /ratedSessionSentence/.test(branch), 'it shows the facts and the sentence');
  assert(/Remove session/.test(branch) && /Duplicate/.test(branch), 'Remove (which cancels a session carrying data on publish) and Duplicate stay — "cancel it and create a new one"');
  assert(/Cancel changes/.test(branch), 'a held edit from before the rule can still be dropped');
}

console.log('\nand the database holds it (0133) — the last line under both screens');
{
  const mig = read('supabase/migrations/0133_rated_session_read_only.sql').replace(/^\s*--.*$/gm, '');
  assert(/create or replace function public\.sessions_rated_read_only\(\)/.test(mig) && /before update on public\.sessions/.test(mig), 'a before-update trigger on sessions');
  assert(/new\.starts_at is distinct from old\.starts_at or new\.duration_min is distinct from old\.duration_min/.test(mig), 'refuses a change to starts_at or duration_min — what the sentence ties the rating to — and nothing else');
  assert(/from public\.training_entries te[\s\S]*?te\.superseded_by is null/.test(mig), 'when the session has a LIVE rating, the population the screens count');
  assert(/raise exception 'session_rated_read_only'/.test(mig), 'loudly');
  const q = strip(read('src/lib/queries/schedule.ts'));
  assert(/error\.message\.includes\('session_rated_read_only'\)\) return \{ error: RATED_SESSION_REFUSAL \}/.test(q), 'updateSession turns the refusal into the rule\'s own words');
  assert(/export const RATED_SESSION_REFUSAL =[\s\S]*?Ratings are tied to its date and duration, so it cannot be changed\. Cancel it and create a new one if the details are wrong\./.test(copy), 'and those words are the sentence both screens show');
}

console.log('\nthe caption describes a gesture that exists');
{
  const grid = strip(read('src/components/ScheduleGrid/TimeGrid.tsx'));
  assert(!/drag a block/.test(grid) && /select a block to change its day or time/.test(grid), 'the edit-mode caption says "select a block to change its day or time" — there is no drag (15 Sept #5)');
  assert(!/onPointerDown|onDragStart|draggable=/.test(grid) && !/onPointerDown|onDragStart|draggable=/.test(workspace), 'and still none is built');
  assert(!/Dragging a block/.test(read('docs/screens/07-schedule.md')), '07-schedule.md no longer lists a drag');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
