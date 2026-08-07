/* Create the development logins.
 *
 * supabase/seed.sql writes public.users, which is the application's user table.
 * It cannot write auth.users, which is owned by GoTrue and has its own password
 * hashing. This script closes that gap: for every row in public.users it
 * creates an auth user with the SAME id, so the foreign key public.users.id
 * lines up and the custom access token hook resolves org_id, athlete_id and
 * roles on the first sign-in.
 *
 *   npm run seed:auth
 *
 * Development only. It needs the service role key and it sets one shared
 * password, which is exactly why it is a script and not a migration. */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_PASSWORD first.',
  );
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

  let created = 0;
  let existing = 0;

  for (const user of (data ?? []) as SeedUser[]) {
    const result = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.full_name },
    });

    if (result.error) {
      if (/already/i.test(result.error.message)) existing += 1;
      else console.error(`${user.email}: ${result.error.message}`);
      continue;
    }
    created += 1;
  }

  console.log(`Created ${created} logins, ${existing} were already there.`);
  console.log(`Every one uses the password in SEED_USER_PASSWORD.`);
}

void main();
