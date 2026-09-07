/* Create a new club: the organisation, its first season, and its first staff
 * account, in one command.
 *
 * WHY THIS EXISTS. Nothing in the app can do it. There is no signup route, no
 * onboarding flow, no admin surface — and `organisations` has no INSERT policy
 * at all, only member-SELECT and sport-scientist-UPDATE, so no authenticated
 * user can create one through the API even by hand. The one route that creates
 * staff, settings/users/create, takes orgId from the CALLER's own claims, so it
 * can only ever add people to an org that already has somebody in it. Until
 * this script, the day a real club said yes meant hand-written SQL.
 *
 * THE FIFTH STEP IS THE ONE THAT GETS FORGOTTEN. An org, a season, an auth
 * user, a users row and a role grant. Steps 1-4 produce an app that looks like
 * it works right up until somebody adds a fixture and gets "No current season
 * is set up for this club" — nothing in the app ever inserts a season, every
 * reference to `seasons` is a select. So the season is created here and is not
 * optional.
 *
 * WHY sport_scientist FOR THE FIRST ACCOUNT. It is the only role that can
 * update the organisation and invite other staff. Anything less and the club's
 * first person cannot onboard their own coaches, which turns every subsequent
 * account into another job for you.
 *
 * NO PASSWORD, EVER. This calls the same issueInvite() the real route calls, so
 * there is one credential path in this codebase rather than a second one for
 * bootstrapping. The person follows a single-use link and chooses their own
 * password, which is the build handoff's step 2 rule.
 *
 * ORDERING AND ROLLBACK. There is no multi-statement transaction available
 * through supabase-js, so the writes are ordered and each failure undoes what
 * came before it, in reverse. An organisation with no staff is invisible to
 * everyone (every policy opens with org_id = auth_org_id(), and nobody's claims
 * carry that id), so a half-created club is not a mess someone finds — it is a
 * mess nobody can see, which is worse. Deleting one is cancelling a creation,
 * not deleting anybody's data: CLAUDE.md rule 4 is about athlete records, and
 * at this point the org has none, by construction.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --commit. This is a script
 * whose whole purpose is to be pointed at production.
 *
 * The `@/` alias means this needs the repo's loader, so it runs through npm
 * with the environment supplied by --env-file:
 *
 *   node --env-file=.env.local --import ./scripts/lib/register-ts-aliases.mjs \
 *        --experimental-strip-types scripts/create-org.ts \
 *        --name "Ashcombe Rugby Club" --sport rugby_union \
 *        --admin-email person@club.com --admin-name "Their Name"
 *
 * Swap .env.local for .env.production.explicit to point it at production, and
 * add --commit once the dry run reads correctly.
 */

export const SPORTS = [
  'rugby_union', 'rugby_league', 'football', 'netball',
  'hockey', 'cricket', 'basketball', 'athletics', 'other',
] as const;
export const TIERS = ['core', 'performance'] as const;

/** The first account's role. Not an argument: see the header. */
export const FIRST_STAFF_ROLE = 'sport_scientist';

export type OrgSpec = {
  name: string;
  sport: (typeof SPORTS)[number];
  timezone: string;
  countryCode: string;
  tier: (typeof TIERS)[number];
  season: { name: string; startsOn: string; endsOn: string };
  admin: { email: string; fullName: string };
  origin: string;
  commit: boolean;
};

/** The season a club signing up today is in.
 *
 *  Northern-hemisphere, July to June, which is what every club in this app's
 *  seed data uses. Derived rather than required so the common case is one
 *  fewer argument to get wrong, and printed back so a club on a different
 *  calendar is corrected rather than silently mislabelled. */
export function defaultSeason(today: string): { name: string; startsOn: string; endsOn: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return {
    name: `${start}/${String(start + 1).slice(2)}`,
    startsOn: `${start}-07-01`,
    endsOn: `${start + 1}-06-30`,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseArgs(argv: readonly string[], today: string): { spec: OrgSpec | null; errors: string[] } {
  /* lastIndexOf, not indexOf: a repeated flag takes the LAST value, which is
     what every other command-line tool does and what somebody appending an
     override to a saved command will expect. With indexOf, `--sport rugby_union
     ... --sport football` silently kept rugby_union — found by a test that
     appended an override and watched it be ignored. */
  const get = (name: string): string | undefined => {
    const i = argv.lastIndexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const errors: string[] = [];
  const season = defaultSeason(today);

  const name = (get('name') ?? '').trim();
  if (name === '') errors.push('--name is required (the club\'s name as it should appear in the app)');

  const sport = (get('sport') ?? '') as (typeof SPORTS)[number];
  if (!SPORTS.includes(sport)) errors.push(`--sport must be one of: ${SPORTS.join(', ')}`);

  const tier = (get('tier') ?? 'core') as (typeof TIERS)[number];
  if (!TIERS.includes(tier)) errors.push(`--tier must be one of: ${TIERS.join(', ')}`);

  /* Validated by asking Intl, not by matching a list: a timezone this process
     cannot resolve is one the app cannot format a kick-off in either, and every
     timestamp in this product is stored UTC and displayed in the org's zone. */
  const timezone = get('timezone') ?? 'Europe/London';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    errors.push(`--timezone "${timezone}" is not a timezone this system recognises`);
  }

  const countryCode = (get('country') ?? 'GB').toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('--country must be a two-letter code, e.g. GB');

  const email = (get('admin-email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('--admin-email must be an email address');

  const fullName = (get('admin-name') ?? '').trim();
  if (fullName === '') errors.push('--admin-name is required (the first staff member\'s name)');

  const seasonName = (get('season-name') ?? season.name).trim();
  const startsOn = get('season-start') ?? season.startsOn;
  const endsOn = get('season-end') ?? season.endsOn;
  if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) errors.push('--season-start and --season-end must be YYYY-MM-DD');
  else if (startsOn >= endsOn) errors.push('--season-start must be before --season-end');

  const origin = get('origin') ?? 'https://fydr.app';
  try {
    new URL(origin);
  } catch {
    errors.push(`--origin "${origin}" is not a URL`);
  }

  if (errors.length > 0) return { spec: null, errors };
  return {
    spec: {
      name, sport, timezone, countryCode, tier,
      season: { name: seasonName, startsOn, endsOn },
      admin: { email, fullName },
      origin,
      commit: argv.includes('--commit'),
    },
    errors: [],
  };
}

/** Every write this script makes, injected so the rollback path can be tested
 *  without a database. That path is the one that only ever runs when something
 *  has already gone wrong, which is exactly when it must be right. */
export type Ops = {
  findOrgByName(name: string): Promise<{ id: string } | null>;
  createOrg(spec: OrgSpec): Promise<string>;
  createSeason(orgId: string, spec: OrgSpec): Promise<string>;
  invite(email: string, fullName: string, origin: string): Promise<{ userId: string; inviteUrl: string }>;
  createUserRow(userId: string, orgId: string, spec: OrgSpec): Promise<void>;
  grantRole(userId: string, orgId: string): Promise<void>;
  deleteSeason(seasonId: string): Promise<void>;
  deleteOrg(orgId: string): Promise<void>;
  deleteUserRow(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
};

export type CreateResult = { orgId: string; seasonId: string; userId: string; inviteUrl: string };

export class DuplicateOrgError extends Error {}

export async function createOrganisation(
  ops: Ops,
  spec: OrgSpec,
  log: (line: string) => void = () => {},
): Promise<CreateResult> {
  const existing = await ops.findOrgByName(spec.name);
  if (existing) {
    throw new DuplicateOrgError(
      `An organisation called "${spec.name}" already exists (${existing.id}). ` +
        'Re-running this script would give the club a second, empty copy of itself that nobody is a member of. ' +
        'Add staff to the existing org instead, or use a distinguishing name.',
    );
  }

  /* Undo steps are pushed as they become necessary and run in reverse, so a
     failure at step 5 removes exactly steps 1-4 and a failure at step 2 removes
     only step 1. Each is best-effort: a rollback that throws would replace a
     clear "creation failed" with an unrelated error about the cleanup. */
  const undo: { what: string; run: () => Promise<void> }[] = [];
  const rollback = async (): Promise<void> => {
    for (const step of [...undo].reverse()) {
      try {
        await step.run();
        log(`  rolled back: ${step.what}`);
      } catch (e) {
        log(`  COULD NOT ROLL BACK ${step.what}: ${(e as Error).message}`);
      }
    }
  };

  try {
    const orgId = await ops.createOrg(spec);
    undo.push({ what: `organisation ${orgId}`, run: () => ops.deleteOrg(orgId) });
    log(`  organisation ${orgId}`);

    const seasonId = await ops.createSeason(orgId, spec);
    undo.push({ what: `season ${seasonId}`, run: () => ops.deleteSeason(seasonId) });
    log(`  season ${seasonId} — ${spec.season.name}, current`);

    /* The auth user is created before its application row because generateLink
       assigns the id. An auth user with no users row signs in to a token whose
       org_id is null, which matches nothing anywhere — the person sees an app
       that is simply empty rather than an error that explains itself. */
    const { userId, inviteUrl } = await ops.invite(spec.admin.email, spec.admin.fullName, spec.origin);
    undo.push({ what: `auth user ${userId}`, run: () => ops.deleteAuthUser(userId) });
    log(`  auth user ${userId}`);

    await ops.createUserRow(userId, orgId, spec);
    undo.push({ what: `users row ${userId}`, run: () => ops.deleteUserRow(userId) });
    log(`  users row, status active`);

    await ops.grantRole(userId, orgId);
    log(`  role ${FIRST_STAFF_ROLE} granted`);

    return { orgId, seasonId, userId, inviteUrl };
  } catch (e) {
    log(`  FAILED: ${(e as Error).message}`);
    await rollback();
    throw e;
  }
}

/* ---------------------------------------------------------------------------
   CLI. Imported by nothing; the logic above is what the tests exercise.
   --------------------------------------------------------------------------- */

/** Only when run directly, so importing this file for its logic — which the
 *  test does — never opens a client or writes anything.
 *
 *  The basename is compared exactly. `endsWith('create-org.ts')` was the first
 *  attempt and it is also true of `test-create-org.ts`, so running the tests
 *  executed the CLI: it read the environment, found no service-role key, and
 *  printed usage in the middle of the test output. A suffix check on a filename
 *  is a prefix check waiting to be wrong. */
const runningDirectly = process.argv[1]?.split('/').pop() === 'create-org.ts';

if (runningDirectly) {
  const { createClient } = await import('@supabase/supabase-js');
  const { issueInvite, deleteInvitedUser } = await import('@/lib/invite');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    console.error('Scratch:     npm run create:org -- --env scratch ...   (or set them yourself)');
    console.error('Production:  node --env-file=.env.production.explicit --import ./scripts/lib/register-ts-aliases.mjs \\');
    console.error('               --experimental-strip-types scripts/create-org.ts ...');
    process.exit(2);
  }

  const { spec, errors } = parseArgs(process.argv.slice(2), new Date().toISOString().slice(0, 10));
  if (!spec) {
    console.error('\nCannot create the organisation:\n');
    for (const e of errors) console.error(`  ${e}`);
    console.error('');
    process.exit(2);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  /* Printed before anything happens, and it names the database. Getting the
     environment wrong is the failure this project has already had once. */
  console.log(`\n  ${spec.commit ? 'CREATING' : 'DRY RUN — nothing will be written'}`);
  console.log(`  database    ${new URL(url).hostname}`);
  console.log(`  club        ${spec.name} · ${spec.sport} · ${spec.tier}`);
  console.log(`  locale      ${spec.timezone} · ${spec.countryCode}`);
  console.log(`  season      ${spec.season.name}  ${spec.season.startsOn} to ${spec.season.endsOn}`);
  console.log(`  first staff ${spec.admin.fullName} <${spec.admin.email}> as ${FIRST_STAFF_ROLE}`);
  console.log(`  invite from ${spec.origin}\n`);

  const must = <T>(what: string, res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error || res.data === null) throw new Error(`${what}: ${res.error?.message ?? 'no row returned'}`);
    return res.data;
  };

  const ops: Ops = {
    findOrgByName: async (name) => {
      /* Case-insensitive and exact: "Ashcombe RFC" and "ashcombe rfc" are the
         same club typed twice, and that is precisely the second run this check
         exists to stop. */
      const res = await admin.from('organisations').select('id').ilike('name', name).is('deleted_at', null).limit(1);
      if (res.error) throw new Error(`duplicate check: ${res.error.message}`);
      return res.data?.[0] ?? null;
    },
    createOrg: async (s) =>
      must<{ id: string }>(
        'organisation',
        await admin
          .from('organisations')
          .insert({ name: s.name, sport: s.sport, timezone: s.timezone, country_code: s.countryCode, tier: s.tier })
          .select('id')
          .single(),
      ).id,
    createSeason: async (orgId, s) =>
      must<{ id: string }>(
        'season',
        await admin
          .from('seasons')
          .insert({ org_id: orgId, name: s.season.name, starts_on: s.season.startsOn, ends_on: s.season.endsOn, is_current: true })
          .select('id')
          .single(),
      ).id,
    invite: async (email, fullName, origin) => {
      const r = await issueInvite(admin, email, fullName, origin);
      if (!r.ok) throw new Error(`invite: ${r.error}`);
      return r.invite;
    },
    createUserRow: async (userId, orgId, s) => {
      const { error } = await admin
        .from('users')
        .insert({ id: userId, org_id: orgId, email: s.admin.email, full_name: s.admin.fullName, status: 'active' });
      if (error) throw new Error(`users row: ${error.message}`);
    },
    grantRole: async (userId, orgId) => {
      /* claims_version is NOT set here: this insert fires bump_claims_version,
         which is what every other staff account in the system relies on. */
      const { error } = await admin
        .from('user_roles')
        .insert({ org_id: orgId, user_id: userId, role: FIRST_STAFF_ROLE, granted_by: null });
      if (error) throw new Error(`role grant: ${error.message}`);
    },
    deleteSeason: async (id) => { await admin.from('seasons').delete().eq('id', id); },
    deleteOrg: async (id) => { await admin.from('organisations').delete().eq('id', id); },
    deleteUserRow: async (id) => { await admin.from('users').delete().eq('id', id); },
    deleteAuthUser: async (id) => { await deleteInvitedUser(admin, id); },
  };

  if (!spec.commit) {
    const clash = await ops.findOrgByName(spec.name);
    console.log(clash ? `  REFUSED: "${spec.name}" already exists (${clash.id}).` : '  No clash on the name.');
    console.log('  Re-run with --commit to create it.\n');
    process.exit(clash ? 1 : 0);
  }

  try {
    const result = await createOrganisation(ops, spec, (l) => console.log(l));
    console.log(`\n  Done. Organisation ${result.orgId}\n`);
    console.log('  Send this to the club. It is single-use and expires:\n');
    console.log(`    ${result.inviteUrl}\n`);
    console.log(`  They choose their own password on arrival and can then invite the rest of their staff.\n`);
  } catch (e) {
    console.error(`\n  Nothing was created. ${(e as Error).message}\n`);
    process.exit(1);
  }
}
