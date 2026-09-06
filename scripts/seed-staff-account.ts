/* Seed a staff account, the way the app itself creates one.
 *
 * WHY THIS EXISTS. Production carried no strength_conditioning and no
 * nutritionist account, so two of migration 0073's narrowings had nobody who
 * could exercise them: exercises (sport scientist + S&C) and
 * body_mass_target_ranges (sport scientist + nutritionist) were, in practice,
 * sport-scientist-only. That is a gap in the test data, not in the policy.
 *
 * WHAT "SAME PATTERN AS THE EXISTING 44" MEANS HERE, and the one place it
 * deliberately does not. Org, users row, status, role grant, email convention
 * and claims handling are all identical to what settings/users/create/route.ts
 * writes — this calls the same issueInvite() the route calls, so there is one
 * credential path in this codebase and this is not a second one.
 *
 * The existing 44 all carry a password, and these two do not. That is the build
 * handoff's step 2 rule: "No password is ever generated, emailed, or shown on
 * screen, on either path." Seeding a known password here would reintroduce
 * exactly what that work removed, into production, for the convenience of a
 * test. The invite link does the same job: it is single-use, it expires, it
 * proves nothing by itself, and the person following it chooses their own
 * password and is signed in by the same act.
 *
 * ORDERING, and it matters. generateLink assigns the id, so the auth user is
 * created first and the application row second. If either later step fails the
 * auth user is deleted again, because an auth user with no users row is a
 * sign-in that resolves to no organisation: the hook in migration 0010 returns
 * a token with org_id null, which matches nothing anywhere, and the person sees
 * an app that is simply empty rather than an error that explains itself.
 *
 * claims_version is NOT set here. The user_roles insert fires
 * bump_claims_version, which takes it from 1 to 2 on its own — the same value
 * every existing staff account carries. Setting it by hand would be writing
 * down an answer the database already computes.
 */
import { createClient } from '@supabase/supabase-js';
import { issueInvite, deleteInvitedUser } from '@/lib/invite';
import type { AppRole } from '@/lib/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.SEED_ORIGIN ?? 'https://fydr.app';

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type Spec = { email: string; fullName: string; orgId: string; roles: AppRole[] };

const ORG_ASHCOMBE = 'a0000000-0000-4000-8000-000000000001';

const ACCOUNTS: Spec[] = [
  { email: 'o.hartnell@ashcomberfc.example', fullName: 'Owen Hartnell', orgId: ORG_ASHCOMBE, roles: ['strength_conditioning'] },
  { email: 's.mirza@ashcomberfc.example',    fullName: 'Sana Mirza',    orgId: ORG_ASHCOMBE, roles: ['nutritionist'] },
];

let failed = 0;
const issued: { email: string; roles: string; url: string }[] = [];

for (const spec of ACCOUNTS) {
  /* Refuse rather than adopt: an address that already exists belongs to an
     account somebody may already be using, and quietly granting it another role
     is not seeding, it is editing a person. */
  const { data: existing } = await admin
    .from('users')
    .select('id, full_name')
    .eq('email', spec.email)
    .maybeSingle();
  if (existing) {
    console.log(`  SKIP  ${spec.email} already exists (${existing.full_name}) — left untouched`);
    continue;
  }

  const invited = await issueInvite(admin, spec.email, spec.fullName, origin);
  if (!invited.ok) {
    console.log(`  FAIL  ${spec.email}: ${invited.error}`);
    failed += 1;
    continue;
  }
  const { userId, inviteUrl } = invited.invite;

  const { error: userErr } = await admin.from('users').insert({
    id: userId,
    org_id: spec.orgId,
    email: spec.email,
    full_name: spec.fullName,
    status: 'active',
  });
  if (userErr) {
    await deleteInvitedUser(admin, userId);
    console.log(`  FAIL  ${spec.email}: users row failed (${userErr.message}). Invite cancelled, nothing left behind.`);
    failed += 1;
    continue;
  }

  const { error: rolesErr } = await admin.from('user_roles').insert(
    spec.roles.map((role) => ({ org_id: spec.orgId, user_id: userId, role, granted_by: null })),
  );
  if (rolesErr) {
    await admin.from('users').delete().eq('id', userId);
    await deleteInvitedUser(admin, userId);
    console.log(`  FAIL  ${spec.email}: role grant failed (${rolesErr.message}). Both rows removed.`);
    failed += 1;
    continue;
  }

  console.log(`  OK    ${spec.email}  ${spec.fullName}  ${spec.roles.join(', ')}`);
  issued.push({ email: spec.email, roles: spec.roles.join(', '), url: inviteUrl });
}

if (issued.length) {
  console.log('\nInvite links — single use, and they set no password by themselves.');
  console.log('Following one confirms the address and signs that person in to choose their own:\n');
  for (const i of issued) console.log(`  ${i.roles}\n  ${i.email}\n  ${i.url}\n`);
}
process.exit(failed ? 1 : 0);
