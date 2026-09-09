/* Publish must re-enable itself on every path, including the ones that throw.
 *
 * THE BUG THIS PINS. `handlePublish` set `setPublishing(true)` on entry and
 * `setPublishing(false)` only at the end of the success path. It awaits three
 * loops of network writes; any rejection inside them skipped the reset, so
 * `publishing` stayed true and the button — `disabled={publishing}` — was dead
 * until the coach reloaded the page. That is the "unresponsive Publish button"
 * reported from the schedule screen, and it is not recoverable from the UI:
 * there is no error.tsx anywhere in this app, and a rejection inside an async
 * event handler is an unhandled promise rejection rather than something an
 * error boundary would catch, so nothing rendered and nothing reset.
 *
 * WHY THE RESET IS NOT THE WHOLE FIX. The three loops write sessions one at a
 * time. A throw halfway leaves some of the week genuinely published and the
 * grid still showing it as a pending edit — so `router.refresh()` has to run on
 * the throwing path too, or the coach is looking at state that disagrees with
 * the database. Both calls are cleanup that must happen whatever the outcome,
 * which is why both live in `finally` and why this file asserts both.
 *
 * WHY IT IS STRUCTURAL AND NOT BEHAVIOURAL. This repo's tests read source and
 * assert on it; there is no React test renderer here, and `handlePublish` is a
 * closure over component state that cannot be invoked without one. So this
 * checks the SHAPE that makes the guarantee — reset and refresh inside a
 * `finally` whose `try` opens before the first `await` — rather than observing
 * a stuck button. It takes a path so its own negative control can run it
 * against the pre-fix file and confirm it fails there.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const path = process.argv[2] ?? 'src/components/ScheduleGrid/ScheduleWorkspace.tsx';
const raw = readFileSync(path, 'utf8');
/* Comments are blanked rather than removed so offsets keep meaning, and so a
   `finally` written only inside a comment cannot satisfy any assertion. */
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/** The body of handlePublish, brace-matched rather than guessed at by regex. */
function bodyOf(name: string): string {
  const i = src.search(new RegExp(`(?:async )?function ${name}\\s*\\(`));
  if (i < 0) return '';
  const open = src.indexOf('{', i);
  let d = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) break;
  }
  return src.slice(open + 1, j);
}

const body = bodyOf('handlePublish');
assert(body.length > 0, 'handlePublish is still an async function in this file');

const setTrue = [...body.matchAll(/setPublishing\(true\)/g)];
const setFalse = [...body.matchAll(/setPublishing\(false\)/g)];
assert(setTrue.length === 1, `sets publishing true exactly once (saw ${setTrue.length})`);
assert(setFalse.length === 1, `resets publishing exactly once (saw ${setFalse.length})`);

/* The finally block, brace-matched from the keyword. */
const finIdx = body.search(/\bfinally\s*\{/);
assert(finIdx >= 0, 'handlePublish has a finally block');

let finBlock = '';
if (finIdx >= 0) {
  const open = body.indexOf('{', finIdx);
  let d = 0, j = open;
  for (; j < body.length; j++) {
    if (body[j] === '{') d++;
    else if (body[j] === '}' && --d === 0) break;
  }
  finBlock = body.slice(open + 1, j);
}
assert(/setPublishing\(false\)/.test(finBlock), 'the reset is INSIDE finally, so a throw cannot skip it');
assert(/router\.refresh\(\)/.test(finBlock), 'router.refresh() is inside finally, so a partial publish still re-syncs the grid');
assert((finBlock.match(/router\.refresh\(\)/g) ?? []).length === (body.match(/router\.refresh\(\)/g) ?? []).length,
  'and refresh is not ALSO called on the success path, which would double-fetch');

/* The try must open before the first await, or the awaits it is meant to cover
   sit outside it and the finally guarantees nothing. */
const tryIdx = body.search(/\btry\s*\{/);
const awaitIdx = body.search(/\bawait\b/);
assert(tryIdx >= 0 && awaitIdx >= 0 && tryIdx < awaitIdx,
  'try opens before the first await, so every network write is covered');
assert(setTrue.length === 1 && tryIdx >= 0 && (setTrue[0]!.index ?? 0) < tryIdx,
  'publishing is set true before the try, so the finally always has something to undo');

/* A throw must say so. Without this the button re-enables silently and the
   coach cannot tell a failed publish from a successful one. */
const catIdx = body.search(/\bcatch\s*\(/);
assert(catIdx >= 0, 'handlePublish has a catch');
if (catIdx >= 0 && finIdx > catIdx) {
  const catBlock = body.slice(catIdx, finIdx);
  assert(/setPublishError\(/.test(catBlock), 'the catch surfaces the failure through setPublishError');
}

/* THE MODE DEFAULT, from the same bug report. A coach who can edit must not
   land in the read-only view: that, not the publish reset above, is what made
   the screen read as broken. Roles without SESSION_EDIT must still default to
   read, so this asserts the value is DERIVED from canEdit rather than pinned
   to either literal. */
const modeInit = /useState<'read' \| 'edit'>\(([^)]*)\)/.exec(src)?.[1]?.trim();
assert(modeInit !== undefined, 'the mode state is still initialised in this file');
assert(modeInit !== "'read'", 'mode does not default to read for everyone (the reported bug)');
assert(/canEdit/.test(modeInit ?? ''), `mode default is derived from canEdit (saw: ${modeInit})`);
assert(/'edit'/.test(modeInit ?? '') && /'read'/.test(modeInit ?? ''),
  'and it still resolves to read for roles that cannot edit');

/* The button is still the thing this protects. */
assert(/className="sg-btn-publish"[\s\S]{0,200}?disabled=\{publishing\}/.test(src)
    || /disabled=\{publishing\}[\s\S]{0,200}?className="sg-btn-publish"/.test(src),
  'the Publish button is still disabled by `publishing`, which is what made this fatal');


console.log('\na single session can be cancelled without discarding the week');
{
  /* WHAT WAS ACTUALLY WRONG, measured live as a coach rather than read off the
     note that tracked it. The note said a coach edits a field, looks for Save,
     and sees nothing appear. Both halves were wrong: a clean week already
     renders a disabled "Published" in the banner slot, and one stepper nudge
     DOES surface Discard and "Publish to athletes", enabled. What is wrong is
     WHERE — with the panel at y=700 the banner sat at y=-1782, so the commit
     controls appeared ~2,500px above the thing being edited, off screen.

     And Discard was never an undo for one session: it clears every overlay,
     every added draft and every removal in the week, so a coach who nudged one
     session by fifteen minutes could not get it back without throwing away the
     other four changes they had made. */
  const panel = readFileSync('src/components/ScheduleGrid/SelectedSessionPanel.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

  const revert = bodyOf('handleRevertSession');
  const dirty = bodyOf('isSessionDirty');
  assert(revert.length > 0, 'the workspace has a handleRevertSession');
  assert(dirty.length > 0, 'and an isSessionDirty');

  /* IT MUST NOT BE DISCARD WEARING A DIFFERENT LABEL. This is the whole
     distinction: a revert touches one key, Discard resets the collections. */
  assert(
    !/setEdits\(\{\}\)/.test(revert) && !/setRemoved\(\{\}\)/.test(revert) && !/setAdded\(\[\]\)/.test(revert),
    'and it resets no collection wholesale — that is Discard, not a per-session undo',
  );
  assert(
    /delete next\[id\]/.test(revert),
    'it deletes this id from the edits overlay',
  );
  assert(
    /setAdded\(\(cur\) => cur\.filter\(\(d\) => d\.id !== id\)\)/.test(revert),
    'and drops an added draft by id, since a draft has no committed row to revert to',
  );

  /* THIS ASSERTION WAS THE OPPOSITE, AND THE INVERSION IS THE HISTORY. When
     handleRemove nulled the selection, a removed session could never be
     selected and the panel that would host its undo never rendered, so a
     revert branch for removed[id] was dead code — deleted, and this file
     asserted its absence. Keeping the selection is what made it live. The
     assertion is inverted rather than dropped, because the property that
     matters is not "absent" or "present" but "reachable": if handleRemove ever
     goes back to clearing sel, the branch is dead again and the pair below
     fails together. */
  const restore = bodyOf('handleRestoreSession');
  assert(
    /setRemoved\(\(cur\) => \{[\s\S]{0,140}delete next\[id\]/.test(restore) && /removed\[id\]/.test(dirty),
    'handleRestoreSession un-removes this id and isSessionDirty counts a removal — it is a pending change like any other, with its own undo',
  );

  /* THE BUG THIS PAIR EXISTS FOR, which testing found and reasoning had not.
     Restore was first pointed at handleRevertSession, which also clears the
     edits overlay — so a coach who moved a session to 10:30, removed it, then
     restored it got it back at its PUBLISHED 10:00 with the banner reading "up
     to date". Silent loss of work, in the one area of this app built to prevent
     exactly that. Measured: 10:30 -> remove -> restore -> 10:00.
     The two paths are disjoint — Cancel is unreachable while a session is
     pending removal and Restore is unreachable while it is not — so each must
     touch exactly one collection, and these assert that separation from both
     sides. */
  assert(
    !/setEdits/.test(restore),
    'and Restore does NOT touch the edits overlay: restoring a removed session must not discard a pending edit to it',
  );
  assert(
    !/setRemoved/.test(revert),
    'while Cancel changes does not touch `removed`, which it could never reach anyway',
  );
  assert(
    /onClick=\{onRestore\}[\s\S]{0,90}Restore session/.test(panel),
    'and the Restore button is wired to onRestore, not to onRevert — the whole bug was one prop',
  );
  const remove = bodyOf('handleRemove');
  assert(
    /\/\* SELECTION DELIBERATELY KEPT|SELECTION DELIBERATELY KEPT/.test(raw)
      && !/setRemoved\(\(cur\) => \(\{ \.\.\.cur, \[sel\]: true \}\)\);\s*setSel\(null\)/.test(remove),
    'and handleRemove keeps the selection after a removal, which is what makes that branch reachable at all',
  );
  assert(
    /if \(sel\.startsWith\('new-'\)\)[\s\S]{0,220}setSel\(null\);\s*return;/.test(remove),
    'while a staged draft still clears it, because removing a draft destroys it and leaves nothing to select',
  );
  assert(
    /pendingRemovalSession/.test(raw) && !/removed\[s\.id\]\s*\?/.test(raw),
    'the pending removal is read from `base`, not put back into `effective`',
  );
  /* WHY THAT LAST ONE MATTERS MORE THAN IT LOOKS. Five things read `effective`:
     MD-offset anchoring, the hour range, clash placement, fixture drawing and
     WeekStatsPanel — contact minutes, the typical-week comparison, per-group
     totals. A pending removal inside that list would inflate every one of them
     unless excluded in all five places. */
  assert(
    /\.filter\(\(s\) => !removed\[s\.id\]\)/.test(raw),
    'and `effective` still filters removals out, so no computed number counts a session on its way out',
  );

  /* THE DECISION: no per-session Save. The commit is week-level, because one
     session published out of a week puts a half-updated schedule on athletes'
     phones and breaks the banner's own promise. */
  assert(
    !/>\s*Save(\s+session)?\s*</.test(panel),
    'the panel offers no per-session Save — the commit stays week-level on purpose',
  );
  assert(
    /Publish to athletes, at the top of this page/.test(panel),
    'it names where the commit is instead, because that control is off screen',
  );

  /* AND CANCEL IS NOT OFFERED WHERE IT WOULD DUPLICATE REMOVE. Found by
     testing: on a staged draft the draft IS the change, so cancelling and
     removing are the same act — the panel briefly offered two buttons doing
     exactly that, with different confirmations. */
  assert(
    /isDirty && !isDraft \?/.test(panel),
    'Cancel changes renders only for a committed session carrying an overlay, not for a staged draft where Remove already owns it',
  );
  const lineAt = panel.indexOf('Publish to athletes, at the top of this page');
  const gateBefore = panel.slice(Math.max(0, lineAt - 400), lineAt);
  assert(
    /isDirty \?/.test(gateBefore) && !/isDirty && !isDraft \?/.test(gateBefore),
    'while the commit line shows for ANY pending change, draft included — a staged draft is genuinely held and unpublished',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
