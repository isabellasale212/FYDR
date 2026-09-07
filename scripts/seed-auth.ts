/* Create — and repair — the development logins.
 *
 * supabase/seed.sql writes public.users, which is the application's user table.
 * It cannot write auth.users, which is owned by GoTrue and has its own password
 * hashing. This script closes that gap: for every row in public.users it
 * creates an auth user with the SAME id, so the foreign key public.users.id
 * lines up and the custom access token hook resolves org_id, athlete_id and
 * roles on the first sign-in.
 *
 *   npm run seed:auth              # refuses, prints what it would do
 *   npm run seed:auth -- --confirm # does it
 *
 * IT NOW RESETS, AND THAT IS THE POINT OF THE REWRITE. This script used to call
 * createUser per row, count an "already exists" error, skip the row, and then
 * print "Every one uses the password in SEED_USER_PASSWORD." That sentence was
 * false for exactly the accounts it skipped, which after the first run is all of
 * them — so the passwords on scratch drifted away from the value .env.local
 * declares, silently, and stayed wrong until something needed to sign in. On
 * 2026-09-07 something did: verifying the sign-in audit trail, where every
 * seeded account returned "Invalid login credentials".
 *
 * A seed script that leaves the thing it seeded unusable while reporting success
 * is worse than one that fails, so this one ENSURES: create where missing, reset
 * the password where present, and count the two separately in the summary.
 *
 * WHICH MAKES IT DESTRUCTIVE, so it is guarded like reset-scratch.mjs. "Reset
 * the password on every account" must never run against production, and the
 * check is structural rather than a comment: the URL must name the scratch
 * project and must not name the production one, in either the direct or the
 * pooler shape. See lib/scratch-guard.mjs for why both shapes have to be tested.
 *
 * Development only. It needs the service role key and it sets one shared
 * password, which is exactly why it is a script and not a migration. */

import { createClient } from '@supabase/supabase-js';
import { describeTarget } from './lib/scratch-guard.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_USER_PASSWORD;
const confirmed = process.argv.includes('--confirm');

if (!url || !serviceKey || !password) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_PASSWORD first.',
  );
  process.exit(1);
}

/* THE TARGET CHECK COMES BEFORE ANYTHING ELSE, including reading the user list.
   Note what it does and does not protect: Node's --env-file does not override a
   variable already exported, so `npm run seed:auth` naming .env.local is
   convenience, and THIS is the thing that actually stands between a stray
   production environment and every password in the database. */
const target = describeTarget(url);
if (!target.ok) {
  console.error(`\n${target.reason}`);
  console.error(`  URL: ${url}`);
  console.error('\nThis script resets passwords. It runs against scratch and nowhere else.\n');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type SeedUser = { id: string; email: string; full_name: string };

async function main(): Promise<void> {
  const { data, error } = await admin
    .from('users')
    .select('id, email, full_name')
    .is('deleted_at', null);

  if (error) {
    console.error('Could not read public.users:', error.message);
    process.exit(1);
  }

  const users = (data ?? []) as SeedUser[];

  if (!confirmed) {
    console.log(`\nWould create or reset ${users.length} logins on the scratch project.`);
    console.log('Every account gets the password in SEED_USER_PASSWORD, whether it existed or not.');
    console.log('\nNothing was changed. Re-run with --confirm.\n');
    return;
  }

  let created = 0;
  let reset = 0;
  const failures: string[] = [];

  for (const user of users) {
    const result = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    });

    if (!result.error) {
      created += 1;
      continue;
    }

    if (!/already/i.test(result.error.message)) {
      failures.push(`${user.email}: ${result.error.message}`);
      continue;
    }

    /* THE PATH THAT USED TO BE A `continue`. The account exists, so its password
       is whatever it happens to be — which is the drift this rewrite exists to
       end. The id is ours (createUser was called with it), so the account is
       addressable directly without a lookup. email_confirm goes along too: an
       unconfirmed seeded account cannot sign in either, and it is the same
       class of "seeded but unusable". */
    const { error: resetError } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });

    if (resetError) failures.push(`${user.email}: ${resetError.message}`);
    else reset += 1;
  }

  console.log(`\nCreated ${created}, reset the password on ${reset}.`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} could not be set:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  /* Said as an outcome, not an intention. The claim is only made about the
     accounts this run actually touched. */
  console.log(
    `\n${created + reset} of ${users.length} accounts now use the password in SEED_USER_PASSWORD.\n`,
  );
}

void main();
