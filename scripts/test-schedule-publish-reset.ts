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
  const i = src.search(new RegExp(`async function ${name}\\s*\\(`));
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

/* The button is still the thing this protects. */
assert(/className="sg-btn-publish"[\s\S]{0,200}?disabled=\{publishing\}/.test(src)
    || /disabled=\{publishing\}[\s\S]{0,200}?className="sg-btn-publish"/.test(src),
  'the Publish button is still disabled by `publishing`, which is what made this fatal');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
