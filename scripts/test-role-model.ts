/* The role model, tested BEFORE the migration that creates it.
 *
 * CLAUDE.md §5: "Write the test for a permission rule before the rule. Access
 * control is the one area where tests are mandatory." G-02/D-07 is the one
 * item in the gap queue that can silently OPEN access if it lands in pieces:
 * a policy updated for the new roles while a guard still names the old ones
 * fails open, not closed. So this test exists before the migration and is
 * expected to FAIL until the whole push lands.
 *
 * The agreed model (Architecture To-Do List, 2026-09-04; build handoff step 1):
 * five staff roles, no admin. Admin's duties fold into sport scientist.
 *
 *     athlete  coach  medic  sport_scientist  strength_conditioning  nutritionist
 *
 * SOURCE-LEVEL, and the limit is the same one test-premium-routes.ts states
 * about itself: this proves the vocabulary is consistent everywhere, not that
 * any individual policy is correct. What it catches is the regression that
 * would actually happen — a rename applied in the migration and missed in a
 * guard, or an `admin` check left behind that now matches nobody and so
 * silently stops protecting anything.
 *
 * WHICH WAY A LEFT-BEHIND CHECK FAILS, checked rather than assumed. An earlier
 * draft of this comment claimed the negated shape `!roles.includes('admin')`
 * would admit everyone. It does not, and the difference matters enough to
 * correct rather than quietly reword.
 *
 * All 25 negated guards in this codebase have the same shape:
 *
 *     if (!claims.roles.includes('admin')) redirect(...)      // refuse
 *
 * After the migration nobody holds `admin`, so the condition is permanently
 * TRUE and every one of those screens refuses EVERYONE, including the sport
 * scientist who is supposed to own them. That is fail-CLOSED: loud, visible,
 * and safe. Nobody gains access they should not have.
 *
 * The same is true in the database. Renaming the enum value carries every
 * policy with it, so a policy that granted `admin` now grants
 * `sport_scientist`, which is exactly the intent. And no policy names the two
 * genuinely new roles, so somebody holding only `nutritionist` is refused
 * everywhere until a policy says otherwise. Also fail-closed.
 *
 * So the real risk in G-02 is a BROKEN app, not a LEAKING one, and this test
 * is what turns "eleven screens silently refuse their owner" into a list of
 * named failures before anyone deploys it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL - ${label}`);
  }
}

const STAFF_ROLES = ['coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'] as const;
const ALL_ROLES = ['athlete', ...STAFF_ROLES] as const;
const RETIRED = ['admin', 'medical'] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|sql)$/.test(e)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
console.log('\n-- the enum is exactly the agreed six --');

const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();

/** Replays every create/rename/add against the enum, in migration order, so
 *  this reads the END state rather than whichever statement happens to match
 *  a regex first. */
function replayEnum(): string[] {
  let values: string[] = [];
  for (const f of migrations) {
    const sql = readFileSync(join('supabase/migrations', f), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    const created = sql.match(/create type app_role as enum \(([^)]*)\)/i);
    if (created?.[1]) values = [...created[1].matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
    for (const m of sql.matchAll(/alter type app_role rename value '(\w+)' to '(\w+)'/gi)) {
      values = values.map((v) => (v === m[1] ? (m[2] as string) : v));
    }
    for (const m of sql.matchAll(/alter type app_role add value (?:if not exists )?'(\w+)'/gi)) {
      if (!values.includes(m[1] as string)) values.push(m[1] as string);
    }
  }
  return values;
}

const enumValues = replayEnum();
console.log(`     enum after replaying all ${migrations.length} migrations: ${enumValues.join(', ')}`);
for (const r of ALL_ROLES) assert(enumValues.includes(r), `enum contains '${r}'`);
for (const r of RETIRED) assert(!enumValues.includes(r), `enum no longer contains '${r}'`);
assert(enumValues.length === ALL_ROLES.length, `enum has exactly ${ALL_ROLES.length} values, found ${enumValues.length}`);

// ---------------------------------------------------------------------------
console.log('\n-- no retired role name survives anywhere --');

const sources = walk('src');
for (const retired of RETIRED) {
  const hits = sources.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return new RegExp(`'${retired}'`).test(src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n'));
  });
  assert(hits.length === 0, `no source file uses '${retired}' as a role literal${hits.length ? ` (found in ${hits.length}: ${hits.slice(0, 3).join(', ')})` : ''}`);
}

/** The dangerous shape, called out in this file's header: a NEGATED check on a
 *  role that no longer exists admits everyone instead of refusing everyone. */
const negated = sources.filter((f) =>
  RETIRED.some((r) => new RegExp(`!\\s*\\w+\\.?\\w*\\.includes\\('${r}'\\)`).test(readFileSync(f, 'utf8'))),
);
assert(negated.length === 0, `no negated guard on a retired role${negated.length ? ` (${negated.join(', ')})` : ''}`);

// ---------------------------------------------------------------------------
console.log('\n-- the app and the database agree on the vocabulary --');

const claims = readFileSync('src/lib/supabase/claims.ts', 'utf8');
const declared = [...(claims.match(/const ROLES: readonly string\[\] = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
assert(declared.length > 0, 'claims.ts declares a ROLES list');
assert(
  declared.length === ALL_ROLES.length && ALL_ROLES.every((r) => declared.includes(r)),
  `claims.ts ROLES matches the enum exactly (found: ${declared.join(', ') || 'none'})`,
);

const isStaffBody = claims.match(/export function isStaff[\s\S]*?\n}/)?.[0] ?? '';
for (const r of STAFF_ROLES) assert(isStaffBody.includes(`'${r}'`), `isStaff() counts '${r}' as staff`);
assert(!isStaffBody.includes("'athlete'"), 'isStaff() does not count athlete as staff');

// ---------------------------------------------------------------------------
console.log('\n-- every role literal in the app is a real role --');

const ROLE_LITERAL = /roles\.includes\('(\w+)'\)|'(\w+)'\s*(?:as\s+)?(?::\s*)?AppRole/g;
const unknown = new Set<string>();
for (const f of sources) {
  for (const m of readFileSync(f, 'utf8').matchAll(ROLE_LITERAL)) {
    const v = m[1] ?? m[2];
    if (v && !(ALL_ROLES as readonly string[]).includes(v)) unknown.add(`${v} (${f})`);
  }
}
assert(unknown.size === 0, `no unknown role literal${unknown.size ? `: ${[...unknown].slice(0, 5).join(', ')}` : ''}`);

// ---------------------------------------------------------------------------
console.log('\n-- the nutritionist exclusion (D-01) has somewhere to live --');

const injuryScreens = [
  'src/app/(staff)/injuries/page.tsx',
  'src/app/(staff)/injuries/[injuryId]/page.tsx',
  'src/app/(staff)/injuries/rehab-groups/page.tsx',
  'src/app/(staff)/injuries/team-allocation/page.tsx',
];
/** NO HEURISTIC. This check went through three wrong versions and each failure
 *  was the same one the project has hit repeatedly: inferring intent from the
 *  shape of nearby code.
 *
 *    v1  matched any mention of a role name, so a render flag
 *        `const isMedical = roles.includes('medic')` counted as a gate.
 *    v2  required a refusal within four lines, so a `notFound()` for a MISSING
 *        INJURY counted as a refusal for a missing ROLE. Proximity is not
 *        causation.
 *    v3  this one. It asserts a named function is called. A call either exists
 *        or it does not, and no regex has to guess what the author meant.
 *
 *  requireInjuryAccess() does not exist yet. That is why these fail, and the
 *  failure is the specification of the work: G-01 calls for one shared guard
 *  rather than five hand-written copies, and this is what "shared" means in a
 *  form a test can check.
 */
const INJURY_GUARD = 'requireInjuryAccess';
for (const f of injuryScreens) {
  assert(
    readFileSync(f, 'utf8').includes(INJURY_GUARD),
    `${f.replace('src/app/(staff)', '')} calls ${INJURY_GUARD}()`,
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
