/* §0aj (second bullet) — "Yes, remove" on a staged draft no longer promises
 * "You can undo with Discard, until you publish": a draft that was never
 * published vanishes on removal (no ghost, no Restore). The entry's fix:
 * branch the copy on isDraft. A committed session keeps the promise, which
 * is true for it (the ghost and Restore exist until the week is published).
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const src = readFileSync('src/components/ScheduleGrid/SelectedSessionPanel.tsx', 'utf8');
const block = src.slice(src.indexOf('confirmingRemove ? ('), src.indexOf('Yes, remove'));

console.log('the confirmation names what will happen');
{
  assert(/isDraft\s*\?\s*'Remove this draft\? It was never published, so there is nothing to undo\.'/.test(block.replace(/\s+/g, ' ')),
    'a staged draft: "Remove this draft? It was never published, so there is nothing to undo."');
  assert(/'Remove this session\? You can undo with Discard, until you publish\.'/.test(block),
    'a committed session keeps the true promise');
  assert(!/Remove this session\? You can undo with Discard, until you publish\.\s*<\/span>/.test(src), 'the old unconditional sentence is gone');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
