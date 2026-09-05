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

// ---------------------------------------------------------------------------
console.log('\n-- every route gate matches docs/access-matrix.md (G-29) --');

/* G-29. 27 route gates decide access, and until now each was hand written with
 * role literals inline. That is how the four injury screens ended up disagreeing
 * with each other, and it is why none of the 114 role checks in this app
 * mentioned strength_conditioning or nutritionist: there was no single place
 * that had to be updated when the enum grew.
 *
 * So the sets live in src/lib/access.ts, one exported constant per distinct
 * column pattern in the matrix's own grid, and this test asserts that each
 * gated route names the right one.
 *
 * SAME RULE AS THE D-01 CHECK ABOVE: assert a named identifier is present, never
 * infer intent from nearby code. A constant name either appears in a file or it
 * does not. What this does NOT prove is that the constant is used in the right
 * direction (a gate written `if (hasAnyRole(...)) redirect()` would pass), which
 * is the same limit test-premium-routes.ts states about itself. It catches the
 * regression that actually happens: a screen whose role list was never revisited.
 */
const EXPECTED_GATE: Record<string, string> = {
  // 3.6 Settings and administration. "Everything in this block belonged to the
  // removed admin role and now belongs to the sport scientist alone."
  'settings/retention/page.tsx': 'SETTINGS_ADMIN',
  'settings/retention/preview/route.ts': 'SETTINGS_ADMIN',
  'settings/retention/run/route.ts': 'SETTINGS_ADMIN',
  'settings/audit/page.tsx': 'SETTINGS_ADMIN',
  'settings/users/page.tsx': 'SETTINGS_ADMIN',
  'settings/users/bulk-invite/page.tsx': 'SETTINGS_ADMIN',
  'settings/users/bulk-invite/send/route.ts': 'SETTINGS_ADMIN',
  'settings/users/create/route.ts': 'SETTINGS_ADMIN',
  'settings/users/[userId]/page.tsx': 'SETTINGS_ADMIN',
  'settings/users/[userId]/mfa/route.ts': 'SETTINGS_ADMIN',
  /* Import GPS is VC for the sport scientist and X for everyone else in the
     matrix. This gate refused the sport scientist, which is the half that is
     unambiguously wrong and is fixed. The other half, taking it away from the
     coach and the medic who have it today, is a narrowing and is left to G-33. */
  'settings/imports/page.tsx': 'GPS_IMPORT',
  'settings/imports/template/route.ts': 'GPS_IMPORT',
  'settings/imports/[batchId]/export/route.ts': 'GPS_IMPORT',
  'settings/subject-access/[requestId]/release/route.ts': 'SETTINGS_ADMIN',
  'squad/[athleteId]/subject-access/route.ts': 'SETTINGS_ADMIN',

  // Clinical review of a request: X X V X X. The only row where the sport
  // scientist is refused, because the screen shows the clinical record.
  'settings/subject-access/[requestId]/review/page.tsx': 'CLINICAL_ONLY',

  // 3.1 New and edit session: VEC VEC X X X. Was coach or medic.
  'schedule/planner/new/page.tsx': 'SESSION_EDIT',
  // 3.6 Thresholds: VECD VECD V V X. Creating is the C. Was coach only.
  'settings/thresholds/new/page.tsx': 'THRESHOLD_EDIT',

  /* 3.3 Programme builder: VEC V V VEC V, so the coach views and the S&C
     builds. But this screen also creates REHAB programmes, which 0022 splits
     out and 0067 gives to the medic and the sport scientist, so the gate is
     the union: whoever may author a programme of some type. Gating it on
     PROGRAMME_EDIT alone, which is what this line said first, would have shut
     a medic out of the only screen that creates the rehab work they prescribe
     while the database still let them write it. */
  'programmes/new/page.tsx': 'PROGRAMME_AUTHOR',
  'leaderboards/new/page.tsx': 'LEADERBOARD_EDIT',

  // 3.3 New nutrition target: VC X X X VC.
  'nutrition/new/page.tsx': 'NUTRITION_EDIT',
};

for (const [route, constant] of Object.entries(EXPECTED_GATE)) {
  const f = `src/app/(staff)/${route}`;
  assert(readFileSync(f, 'utf8').includes(constant), `${route} gates on ${constant}`);
}

/* 3.2 New injury is VC for all four injury roles, not medic only, so it takes
 * the shared guard rather than a set of its own. */
assert(
  readFileSync('src/app/(staff)/injuries/new/page.tsx', 'utf8').includes(INJURY_GUARD),
  `injuries/new/page.tsx calls ${INJURY_GUARD}()`,
);

/* 3.4 Leaderboard is V for every staff role, and 3.5's rule is that "a download
 * carries the same permission as the screen it belongs to, without exception".
 * Both downloads carried their own coach-or-medic test, which is narrower than
 * the screen above them. requireStaff() is the whole gate they need. */
for (const f of [
  'src/app/(staff)/leaderboards/[leaderboardId]/export/route.ts',
  'src/app/(staff)/leaderboards/[leaderboardId]/pdf/route.tsx',
]) {
  const src = readFileSync(f, 'utf8');
  assert(
    !/roles\.includes\('(coach|medic)'\)/.test(src),
    `${f.replace('src/app/(staff)/', '')} does not narrow the board below its own screen`,
  );
}

/* The sets themselves, checked against the matrix rather than against whatever
 * access.ts happens to say. */
const access = readFileSync('src/lib/access.ts', 'utf8');
const SETS: Record<string, readonly string[]> = {
  SETTINGS_ADMIN: ['sport_scientist'],
  CLINICAL_ONLY: ['medic'],
  /* The five G-33 rows, decided 2026-09-05. Three narrowed as the matrix wrote
     them, one narrowed as a bug fix, and Leaderboard SPLIT rather than taken as
     written: the medic loses create, the coach keeps it, and the matrix itself
     was corrected. Asserted here against the decision, not against whatever
     access.ts currently says. */
  SESSION_EDIT: ['sport_scientist', 'coach'],
  THRESHOLD_EDIT: ['sport_scientist', 'coach'],
  PROGRAMME_EDIT: ['sport_scientist', 'strength_conditioning'],
  NUTRITION_EDIT: ['sport_scientist', 'nutritionist'],
  GPS_IMPORT: ['sport_scientist'],
  LEADERBOARD_EDIT: ['sport_scientist', 'coach', 'strength_conditioning'],
  REHAB_PROGRAMME: ['sport_scientist', 'medic'],
  PROGRAMME_AUTHOR: ['sport_scientist', 'strength_conditioning', 'medic'],
  INJURY_ACCESS: ['sport_scientist', 'coach', 'medic', 'strength_conditioning'],
  ALL_STAFF: ['sport_scientist', 'coach', 'medic', 'strength_conditioning', 'nutritionist'],
  ANALYTICS: ['sport_scientist'],
  ATHLETE_BIO_EDIT: ['sport_scientist', 'coach', 'medic'],
};
for (const [name, want] of Object.entries(SETS)) {
  const declared = access.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`))?.[1] ?? '';
  const got = [...declared.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert(
    got.length === want.length && want.every((r) => got.includes(r)),
    `${name} is exactly ${want.join(', ')} (found: ${got.join(', ') || 'nothing'})`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n-- the role LISTS, not just the role checks --');

/* The gate inventory above matched `roles.includes('x')` and `roles.some(...)`.
 * It does not match a list of roles declared as data, and this app has six of
 * those. Every one was written when the enum had four values, and every one is
 * a place the two new roles simply do not appear:
 *
 *   the sidebar          nine rows, each with its own roles array. An S&C signs
 *                        in and sees no navigation at all.
 *   VALID_ROLES          the create-user route filters the submitted roles
 *                        through it, so an admin cannot GRANT either new role.
 *   ALL_ROLES            the two user-management panels build their tick boxes
 *                        from it, so neither role can be offered in the first
 *                        place.
 *   STAFF_MFA_REQUIRED   two staff roles that are not required to enrol.
 *
 * The last one is the reason this section is not cosmetic. */
function listIn(file: string, name: string): string[] {
  const src = readFileSync(file, 'utf8');
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  return [...(m?.[1] ?? '').matchAll(/'(\w+)'/g)].map((x) => x[1] as string);
}

for (const [file, name, want] of [
  ['src/app/(staff)/settings/users/create/route.ts', 'VALID_ROLES', ALL_ROLES],
  ['src/components/UserDetailPanel/UserDetailPanel.tsx', 'ALL_ROLES', ALL_ROLES],
  ['src/components/UserManagementPanel/UserManagementPanel.tsx', 'ALL_ROLES', ALL_ROLES],
  ['src/lib/mfa.ts', 'STAFF_MFA_REQUIRED_ROLES', STAFF_ROLES],
] as [string, string, readonly string[]][]) {
  const got = listIn(file, name);
  const missing = want.filter((r) => !got.includes(r));
  assert(missing.length === 0, `${name} covers every role${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
}

/* The sidebar. Each row carries its own array, and `['coach','medic']` there is
 * the same phrase it was everywhere else: "any staff". Asserted per row so a
 * failure names the destination rather than a count. */
const sidebar = readFileSync('src/components/Sidebar/Sidebar.tsx', 'utf8');
const rows = [...sidebar.matchAll(/label: '([^']+)',\s*\n\s*route: '([^']+)',\s*\n\s*roles: (\[[^\]]*\]|\w+),/g)];
assert(rows.length > 0, 'the sidebar declares rows this test can read');
/* One row narrows, and only one. §3.4 and D-02 both make Analytics the sport
   scientist's alone, confirmed 2026-09-05. It is named here rather than skipped
   by a general rule, so a SECOND row quietly narrowing still fails. */
const SIDEBAR_EXCEPTIONS: Record<string, readonly string[]> = {
  Analytics: ['sport_scientist'],
};
for (const r of rows) {
  /* A row may write its roles inline or name a set from access.ts. Resolve the
     identifier rather than trusting it, so pointing a row at the wrong constant
     fails here instead of shipping. */
  const raw = r[3] as string;
  const got = raw.startsWith('[')
    ? [...raw.matchAll(/'(\w+)'/g)].map((m) => m[1] as string)
    : listIn('src/lib/access.ts', raw);
  const want = SIDEBAR_EXCEPTIONS[r[1] as string] ?? STAFF_ROLES;
  const missing = want.filter((x) => !got.includes(x));
  const extra = want === STAFF_ROLES ? [] : got.filter((x) => !want.includes(x));
  assert(
    missing.length === 0 && extra.length === 0,
    `sidebar row ${r[1]} is reachable by exactly ${want.join(', ')}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}${extra.length ? ` (unexpectedly also: ${extra.join(', ')})` : ''}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n-- refusals that are RENDERED, not redirected --');

/* The shape my own G-29 inventory missed, and it locked three roles out of most
 * of the app in production.
 *
 * That inventory classified a role check as a "gate" by looking for redirect(),
 * notFound() or a 403 nearby. These screens refuse by RENDERING a message
 * instead, so all of them were filed as render flags and never reviewed. Same
 * for homeRoute(), which refuses by returning a different destination.
 *
 * Each one read `coach || medic`, which in the four-role model was the phrase
 * for "any staff who is not an admin". The sport scientist, the S&C and the
 * nutritionist are none of those, so every one of these screens told them
 * "Not part of this role", quoting a document describing a role that no longer
 * exists.
 */
const RENDERED_REFUSALS: Record<string, string> = {
  'dashboard/page.tsx': 'ALL_STAFF',
  'flags/page.tsx': 'ALL_STAFF',
  'squad/page.tsx': 'ALL_STAFF',
  'squad/[athleteId]/page.tsx': 'ALL_STAFF',
  'leaderboards/page.tsx': 'ALL_STAFF',
  'leaderboards/[leaderboardId]/page.tsx': 'ALL_STAFF',
  // The one refusal in this group that is an HTTP response rather than a
  // rendered page, and the one that stays narrow: GPS import is §3.6's VC for
  // the sport scientist alone.
  'settings/imports/upload/route.ts': 'GPS_IMPORT',
  // The eighth, found while fixing the seven: it refused anyone who was not a
  // coach, including the sport scientist that THRESHOLD_EDIT contains.
  'settings/thresholds/page.tsx': 'THRESHOLD_EDIT',
};

for (const [route, set] of Object.entries(RENDERED_REFUSALS)) {
  const f = `src/app/(staff)/${route}`;
  const src = readFileSync(f, 'utf8');
  assert(src.includes(set), `${route} resolves its refusal from ${set}`);
  assert(
    !/(hasAccess|isCoach)\s*=\s*claims\.roles\.includes\('coach'\);?\s*\n\s*if \(!\1\)/.test(src) &&
      !/hasAccess\s*=\s*claims\.roles\.includes/.test(src),
    `${route} no longer hand-writes its own role test`,
  );
}

/* homeRoute decides where a signed-in person lands, so getting it wrong is not
 * a hidden panel, it is the first thing they see. It sent every role that was
 * not coach or medic to /settings, which was right when "not coach or medic"
 * meant the club secretary. */
const claimsSrc = readFileSync('src/lib/supabase/claims.ts', 'utf8');
const homeBody = claimsSrc.match(/export function homeRoute[\s\S]*?\n}/)?.[0] ?? '';
assert(homeBody.length > 0, 'homeRoute() exists');
assert(
  !/includes\('coach'\)\s*\|\|\s*claims\.roles\.includes\('medic'\)/.test(homeBody),
  'homeRoute() no longer splits staff into coach-or-medic and everyone else',
);
assert(!/'\/settings'/.test(homeBody), 'homeRoute() no longer lands any staff role on /settings');

// ---------------------------------------------------------------------------
console.log('\n-- refusals that show nothing at all (G-40) --');

/* The shape after G-39's: a role check that hides a region and renders NOTHING.
 * No refusal text, so no scan looking for refusal copy finds it, and nothing on
 * screen tells anybody the thing exists.
 *
 * Seventeen were read one at a time. Seven were §4 partial-visibility working
 * as designed and are deliberately absent from this list; two more log an audit
 * actor and are correct if inconsistent. These seven were wrong, and all seven
 * were approved on 2026-09-05 before being changed, because two of them are
 * real access decisions rather than obvious artefacts: the S&C gaining rehab
 * allocation, and the GPS import link NARROWING away from coach and medic. */
const HIDDEN_REGIONS: [string, string][] = [
  ['settings/page.tsx', 'GPS_IMPORT'],
  ['schedule/planner/page.tsx', 'SESSION_EDIT'],
  ['injuries/rehab-groups/page.tsx', 'REHAB_ALLOCATION'],
  ['squad/[athleteId]/page.tsx', 'ALL_STAFF'],
  ['programmes/page.tsx', 'PROGRAMME_EDIT'],
];
for (const [route, set] of HIDDEN_REGIONS) {
  const src = readFileSync(`src/app/(staff)/${route}`, 'utf8');
  assert(src.includes(set), `${route} resolves its hidden region from ${set}`);
}

/* Named individually because one file carries three of them and a file-level
 * check would pass on any one. */
const athlete = readFileSync('src/app/(staff)/squad/[athleteId]/page.tsx', 'utf8');
for (const [name, want] of [
  ['canLogWeighIn', 'ALL_STAFF'],
  ['canCorrect', 'ALL_STAFF'],
] as [string, string][]) {
  const m = athlete.match(new RegExp(`const ${name} = ([^;]*);`));
  assert((m?.[1] ?? '').includes(want), `${name} resolves from ${want}`);
}
assert(
  /INJURY_ACCESS[\s\S]{0,300}Log injury/.test(athlete),
  'the "+ Log injury" link is offered to INJURY_ACCESS, not the medic alone',
);
const progList = readFileSync('src/app/(staff)/programmes/page.tsx', 'utf8');
assert(
  !/const canEditSelected[\s\S]{0,200}isCoach/.test(progList),
  'the programmes list no longer offers Edit on a hand-written coach test',
);
/* Two more in the same file that the sweep collapsed into the declaration line:
   the "+ New programme" link appears twice, on the empty state and under the
   list, and both gated on isCoach || isMedical while /programmes/new admits
   PROGRAMME_AUTHOR. A file-level check would have missed a second one. */
assert(
  !/isCoach \|\| isMedical/.test(progList),
  'neither "+ New programme" link is offered on a hand-written coach-or-medic test',
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
