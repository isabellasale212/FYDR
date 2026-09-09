/* A fixture always gets its own match session, so the two never disagree.
 *
 * WHY. A match can be represented twice in this schema — a row in `fixtures`,
 * and a session of type 'match' carrying that fixture's id. `fixturesToDraw`
 * already resolves the overlap: the session wins when one exists, because it is
 * the richer object (duration, participants, an RPE expectation), and the
 * fixture only draws its own block to fill the gap. But that gap was the normal
 * case: nothing created the session, so a coach had to build it by hand, and
 * until they did the fixture existed with no session behind it — no participants,
 * no RPE, and an athlete's Today screen pointing at a match the schedule had no
 * real object for. Isabella decided 2026-09-09 that creating a fixture creates
 * its session.
 *
 * THE CONVENTIONS ARE TAKEN FROM THE DATA, not chosen. Every one of the seven
 * match sessions on scratch is 80 minutes; the three genuine ones use md_offset
 * 0, because matchday is the day the countdown points at; the real ones are
 * titled `v {opponent}` (the seeded rows say only "Fixture", which is filler).
 *
 * PARTICIPANTS ARE THE POSITIONAL GROUPS, resolved by group_type rather than by
 * the names "Forwards"/"Backs" so it is not one club's vocabulary. Measured on
 * scratch before choosing: all 29 active Ashcombe athletes hold an open
 * membership in one of the two, so positional groups ARE the full squad there,
 * exactly. Group rows rather than 29 athlete rows deliberately — group
 * membership stays live as the squad changes, where frozen athlete rows go stale
 * the moment somebody joins. Coaches trim after, as with any session.
 *
 * THE FIXTURE IS NOT ROLLED BACK IF THE SESSION FAILS. There is no transaction
 * across these two writes, and the fixture is the object the coach asked for, so
 * losing it to a failed second write would be worse than the inconsistency. The
 * error is surfaced instead, with the fixture id, so the failure is visible and
 * the session can be added by hand. Asserted below, because the tempting
 * alternative — swallow the session error and return success — is what would
 * make this silent.
 */
import { readFileSync } from 'node:fs';
import { fixturesToDraw } from '@/lib/scheduleGeometry';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

const src = blank(readFileSync('src/lib/queries/schedule.ts', 'utf8'));

/** Body of a named exported function, brace-matched.
 *
 *  THE BODY BRACE IS NOT THE FIRST `{` AFTER THE PARAMETERS, and assuming it was
 *  is what made the first version of this file report ten false failures against
 *  correct code. Every function here returns `Promise<{ ... }>`, so the first
 *  `{` encountered belongs to that type literal and the "body" came back as
 *  `error: string | null`. The body opener is the first `{` whose preceding
 *  non-space character is `)` or `>` — the end of the parameter list or the end
 *  of the return-type annotation. */
function bodyOf(name: string): string {
  const i = src.search(new RegExp(`export async function ${name}\\s*\\(`));
  if (i < 0) return '';
  let open = -1;
  for (let k = i; k < src.length; k++) {
    if (src[k] !== '{') continue;
    const before = src.slice(0, k).replace(/\s+$/, '').slice(-1);
    if (before === ')' || before === '>') { open = k; break; }
  }
  if (open < 0) return '';
  let d = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}' && --d === 0) break;
  }
  return src.slice(open + 1, j);
}

/* ---- createSession can carry a fixture id at all ---- */
const inputType = /export type NewSessionInput = \{([\s\S]*?)\};/.exec(src)?.[1] ?? '';
assert(/fixtureId\??:/.test(inputType), 'NewSessionInput accepts a fixtureId');
const cs = bodyOf('createSession');
assert(/fixture_id:/.test(cs), 'and createSession writes it to the fixture_id column');

/* ---- the shared builder, used by creation AND by the backfill ---- */
assert(/export async function createMatchSessionForFixture/.test(src),
  'a single exported helper builds a fixture\'s match session');
const helper = bodyOf('createMatchSessionForFixture');
assert(helper.length > 0, 'and it has a body');
assert(/MATCH_DURATION_MIN/.test(src), 'the 80 minutes is a named constant, not a literal buried in a call');
assert(/MATCH_DURATION_MIN\s*=\s*80/.test(src), 'and it is 80, matching every existing match session');
assert(/mdOffset:\s*0|md_offset:\s*0/.test(helper), 'md_offset is 0 — matchday is the day the countdown points at');
assert(/sessionType:\s*'match'|session_type:\s*'match'/.test(helper), "session_type is 'match'");
assert(/`v \$\{/.test(helper), 'the title follows the `v {opponent}` convention');
assert(/venue/.test(helper), "location comes from the fixture's venue");
assert(/kickoff/i.test(helper), 'and starts_at from its kickoff');

/* POSITIONAL, not the two names. A club's groups are its own vocabulary. */
assert(/group_type/.test(helper) && /positional/.test(helper),
  'participants are resolved by group_type positional, not by the names Forwards/Backs');
/* THE USE, NOT THE WORD. The helper's error copy legitimately says "Add Forwards
   and Backs in Groups", which is more use to a coach than "add positional
   groups" — so a bare word search fails on correct code. What must not exist is
   either name as a standalone literal, or in a query filter. */
assert(!/'(Forwards|Backs)'/.test(helper) && !/"(Forwards|Backs)"/.test(helper),
  'neither name appears as a standalone string literal');
assert(!/\.(eq|in)\([^)]*(Forwards|Backs)/.test(helper),
  'and neither is used in a query filter — the selector is group_type');

/* ---- creation wires it in, and does not hide a failure ---- */
const cf = bodyOf('createFixture');
assert(/createMatchSessionForFixture/.test(cf), 'createFixture calls the helper after inserting the fixture');
assert(/return \{ id: data\.id/.test(cf) || /id: data\.id/.test(cf),
  'and still returns the fixture id');
/* The failure path must surface, not swallow. */
assert(/sessionError|matchError/.test(cf),
  'the session result is captured rather than discarded — a failed session must not read as success');

/* ---- SUPPRESSION, as behaviour rather than as an empty screen ----
   Verified on the running grid too: with every Ashcombe fixture now carrying a
   session, the week of 27 July draws `v Exeter Chiefs` once, through a
   `sg-block-name` session block, and `sg-fixture` count is 0. But an empty
   result cannot distinguish "suppressed correctly" from "fixture blocks never
   render at all", so the mechanism is exercised directly here. */
const FX = [{ id: 'fx-1' }, { id: 'fx-2' }];
const claim = (fixtureId: string | null) => ({ type: 'match', fixtureId });

assert(fixturesToDraw(FX, [claim('fx-1')]).map((f) => f.id).join() === 'fx-2',
  'a fixture claimed by a match session stops drawing its own block');
assert(fixturesToDraw(FX, []).length === 2,
  'and an unclaimed fixture still draws one — suppression is conditional, not blanket');
assert(fixturesToDraw(FX, [claim(null)]).length === 2,
  'a match session with no fixture_id claims nothing (the orphan case: real history, suppresses nobody)');
assert(fixturesToDraw(FX, [{ type: 'training', fixtureId: 'fx-1' }]).length === 2,
  'and only a session of type match can claim a fixture');
assert(fixturesToDraw(FX, [claim('fx-1'), claim('fx-2')]).length === 0,
  'two fixtures on one day are each suppressed by their OWN session, never by the day');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
