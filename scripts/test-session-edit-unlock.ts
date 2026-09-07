/* Editing an existing session's name, location and type from the schedule card.
 *
 * WHY THOSE THREE WERE LOCKED, and why unlocking them is not a UI change. The
 * card's edit overlay was `{ start?, mins?, groupIds? }` — literally three
 * fields — and updateDraftField did nothing at all when the selection was a
 * saved session rather than a draft. So wiring Name, Location and Type to the
 * existing handlers would have produced a form that accepts typing and discards
 * it: a silent no-op, the G-34 class this project has fixed six times already.
 *
 * The overlay now carries all six, `effective` applies them so the grid and the
 * card show the pending edit, and publish sends them. updateSession already
 * accepted title/sessionType/location — the publish path was resending them
 * unchanged from a page-load snapshot.
 *
 * LOCATION IS NULLABLE, so it is applied by PRESENCE and not by `??`. Clearing a
 * location is a real edit; `patch.location ?? base.location` would silently
 * restore the old value the moment somebody emptied the field, which is the same
 * silent-discard bug one level down.
 *
 * BEHIND AN EXPLICIT EDIT, not open by default. Start, duration and groups are
 * adjustments; a name, a type and a place are what the session IS, and the
 * schedule is a screen people click around on. The unlock also resets when the
 * selection moves, so it cannot leak from one session to the next.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const types = readFileSync('src/components/ScheduleGrid/types.ts', 'utf8');
const ws = readFileSync('src/components/ScheduleGrid/ScheduleWorkspace.tsx', 'utf8');
const wsCode = strip(ws);
const panel = readFileSync('src/components/ScheduleGrid/SelectedSessionPanel.tsx', 'utf8');
const pCode = strip(panel);
const queries = readFileSync('src/lib/queries/schedule.ts', 'utf8');

console.log('the overlay can carry all six fields');
{
  const decl = strip(types).slice(strip(types).indexOf('export type EditOverlay'));
  /* The type is multi-line now, so take the whole block, not up to the first
     semicolon — which after the rewrite is just `start?: number;`. */
  const line = decl.slice(0, decl.indexOf('};') + 2);
  for (const f of ['start', 'mins', 'groupIds', 'title', 'type', 'location', 'dow']) {
    assert(line.includes(f), `EditOverlay carries ${f}`);
  }
}

console.log('\nan edit to a saved session is not a no-op');
{
  const fn = wsCode.slice(wsCode.indexOf('function updateDraftField'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert(/patchEdit\(/.test(body), 'updateDraftField routes a saved session into the edit overlay');
  assert(
    /sel === '__new'/.test(body) && /startsWith\('new-'\)/.test(body),
    'while drafts still go to their own state',
  );
}

console.log('\nthe pending edit is what the screen shows');
{
  const eff = wsCode.slice(wsCode.indexOf('const effective:'), wsCode.indexOf('const drafts:'));
  assert(/title: e\.title \?\? s\.title/.test(eff), 'effective applies a patched title');
  assert(/type: e\.type \?\? s\.type/.test(eff), 'and a patched type');
  assert(
    /'location' in e \? \(?e\.location/.test(eff),
    'and a patched location BY PRESENCE — clearing it is a real edit that ?? would undo',
  );
}

console.log('\npublish sends the edit rather than the page-load snapshot');
{
  const pub = wsCode.slice(wsCode.indexOf('for (const [id, patch] of Object.entries(edits))'));
  const body = pub.slice(0, pub.indexOf('\n    }'));
  assert(/title: patch\.title \?\? b\.title/.test(body), 'title comes from the patch when there is one');
  assert(/sessionType: patch\.type \?\? b\.type/.test(body), 'so does the type');
  assert(
    /'location' in patch \? \(?patch\.location/.test(body),
    'and location by presence, for the same reason as above',
  );
  assert(/expectedUpdatedAt: b\.updatedAt/.test(body), 'the optimistic lock is still sent');
}

console.log('\nmoving a session to another day');
{
  const eff = wsCode.slice(wsCode.indexOf('const effective:'), wsCode.indexOf('const drafts:'));
  assert(/dow: e\.dow \?\? s\.dow/.test(eff), 'effective applies a patched day, so the block moves column before publish');

  const pub = wsCode.slice(wsCode.indexOf('for (const [id, patch] of Object.entries(edits))'));
  const body = pub.slice(0, pub.indexOf('\n    }'));
  assert(
    /zonedTimeToUtcIso\(\s*patch\.dow \?\? b\.dow/.test(body),
    'and publish builds starts_at from the patched day — a day move IS a starts_at change',
  );
  /* md_offset is deliberately NOT recomputed. The schema's own comment says it
     is stored rather than derived so a postponed fixture cannot retroactively
     rewrite what MD-n a session was planned under. The grid already labels by
     the DAY's anchored offset (anchoredMd), so a moved session displays
     correctly without touching the stored value. */
  assert(/mdOffset: b\.mdOffset/.test(body), 'while the stored md_offset is left alone');
}

console.log('\nthe fields unlock behind an explicit Edit');
assert(/const \[unlocked, setUnlocked\]/.test(pCode), 'the panel tracks whether the viewer asked to edit');
assert(/setUnlocked\(false\)/.test(pCode), 'and relocks when the selection moves, so it cannot leak between sessions');
{
  for (const [field, marker] of [
    ['name', 'isDraft || unlocked'],
    ['location', 'isDraft || unlocked'],
    ['type', 'isDraft || unlocked'],
    ['day', 'isDraft || unlocked'],
  ] as const) {
    assert(pCode.includes(marker), `the ${field} field opens for a draft OR an unlocked session`);
  }
  assert(
    [...pCode.matchAll(/isDraft \|\| unlocked/g)].length >= 4,
    'all four of them, not one',
  );
}
assert(/onUnlock/.test(pCode), 'an Edit control is offered');
assert(
  /const dayField = \(isDraft \|\| unlocked\)/.test(pCode),
  'the day picker is one of the fields it opens',
);
assert(
  /!isDraft && mode === 'edit' && !unlocked/.test(pCode),
  'only for a saved session, in edit mode, that is not already unlocked',
);

console.log('\nthe comment that documented the old limit no longer claims it');
assert(
  !/only start\/duration\/groups are ever in that patch/.test(queries),
  'schedule.ts no longer says the patch can only hold start, duration and groups',
);
assert(
  /EditOverlay/.test(queries),
  'and still points at EditOverlay for what the patch can carry',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
