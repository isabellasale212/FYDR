/* Seed a staff account, the way the app itself creates one.
 *
 * WHY THIS EXISTS. Production carried no strength_conditioning and no
 * nutritionist account, so two of migration 0073's narrowings had nobody who
 * could exercise them: exercises (sport scientist + S&C) and
 * body_mass_target_ranges (sport scientist + nutritionist) were, in practice,
 * sport-scientist-only. That is a gap in the test data, not in the policy.
 *
 * ARGUMENTS, since 16 September 2026. The script used to carry the two
 * fixture accounts as a hard-coded list and parse nothing — `--help` ran the
 * list — so nobody could use it for the account it exists to create. It now
 * takes one account on the command line:
 *
 *   node --env-file=<env file> --experimental-strip-types \
 *     --import ./scripts/lib/register-ts-aliases.mjs scripts/seed-staff-account.ts \
 *     --email <address> --name "<full name>" --role <role> --org <organisation id>
 *
 * With no arguments it does exactly what it always did — the two fixture
 * accounts below — so nothing that depends on that behaviour changes. `--help`
 * prints the usage and exits without touching anything (and without needing
 * the environment). The environment names the project it writes to; this
 * script is a production tool by design (the to-do list's sweep of 11 Sept)
 * and is run by the person who holds the production environment file, never
 * by the builder.
 *
 * WHAT "SAME PATTERN AS THE EXISTING 44" MEANS HERE, and the one place it
 * deliberately does not. Org, users row, status, role grant, email convention
 * and claims handling are all identical to what settings/users/create/route.ts
 * writes — this calls the same issueInvite() the route calls, so there is one
 * credential path in this codebase and this is not a second one.
 *
 * The existing 44 all carry a password, and these do not. That is the build
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

type Spec = { email: string; fullName: string; orgId: string; roles: AppRole[] };

const ORG_ASHCOMBE = 'a0000000-0000-4000-8000-000000000001';

/** The original behaviour: the two fixture accounts, when no argument is given. */
const FIXTURE_ACCOUNTS: Spec[] = [
  { email: 'o.hartnell@ashcomberfc.example', fullName: 'Owen Hartnell', orgId: ORG_ASHCOMBE, roles: ['strength_conditioning'] },
  { email: 's.mirza@ashcomberfc.example',    fullName: 'Sana Mirza',    orgId: ORG_ASHCOMBE, roles: ['nutritionist'] },
];

/** The staff roles an account may be seeded with — every app_role but the
 *  athlete's, which is not a staff account and is invited from the squad. */
const STAFF_ROLES: readonly AppRole[] = ['coach', 'medic', 'sport_scientist', 'strength_conditioning', 'nutritionist'];

const USAGE = `Seed a staff account: an auth user with no password, the users row, the role, and
an invite link that lands on the choose-a-password page.

Usage
  node --env-file=<env file> --experimental-strip-types \\
    --import ./scripts/lib/register-ts-aliases.mjs scripts/seed-staff-account.ts \\
    --email <address> --name "<full name>" --role <role> --org <organisation id>

  With no arguments: the two original fixture accounts (o.hartnell, s.mirza at
  Ashcombe), as before. An address that already exists is skipped, never edited.

Options
  --email  <address>          the address the invite is issued to
  --name   "<full name>"      the name as the app will show it
  --role   <role>             one of: ${STAFF_ROLES.join(', ')}
                              (repeat --role, or give a comma-separated list, for more than one)
  --org    <organisation id>  the organisation's uuid; it must exist
  --help                      this text, nothing run

Environment (the env file names the project this writes to)
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required
  SEED_ORIGIN                                           the app origin the link points at
                                                        (default https://fydr.app)
`;

/* ---------------------------------------------------------------------------
 * Arguments. Parsed before the environment is read, so --help and a usage
 * mistake cost nothing and touch nothing.
 * ------------------------------------------------------------------------- */
function parseArgs(argv: readonly string[]): { help: boolean; given: boolean; spec: Spec | null; problems: string[] } {
  const opts: Record<string, string[]> = {};
  const problems: string[] = [];
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') { help = true; continue; }
    const m = /^--(email|name|role|org)(?:=(.*))?$/.exec(arg);
    if (!m) { problems.push(`unknown argument: ${arg}`); continue; }
    const key = m[1]!;
    const value = m[2] !== undefined ? m[2] : argv[i + 1];
    if (m[2] === undefined) i += 1;
    if (value === undefined || value.startsWith('--')) { problems.push(`--${key} needs a value`); continue; }
    (opts[key] ??= []).push(value);
  }
  const given = Object.keys(opts).length > 0;
  if (help || !given) return { help, given, spec: null, problems };

  const email = (opts.email?.[0] ?? '').trim().toLowerCase();
  const fullName = (opts.name?.[0] ?? '').trim();
  const orgId = (opts.org?.[0] ?? '').trim();
  const roles = (opts.role ?? []).flatMap((r) => r.split(',')).map((r) => r.trim()).filter(Boolean);

  if (!email) problems.push('--email is required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push(`--email does not look like an address: ${email}`);
  if (!fullName) problems.push('--name is required');
  if (roles.length === 0) problems.push('--role is required');
  for (const r of roles) if (!(STAFF_ROLES as readonly string[]).includes(r)) problems.push(`--role ${r} is not a staff role (${STAFF_ROLES.join(', ')})`);
  if (!orgId) problems.push('--org is required');
  else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) problems.push(`--org is not a uuid: ${orgId}`);
  if (opts.email && opts.email.length > 1) problems.push('one --email only: the script seeds one account a run');

  if (problems.length > 0) return { help, given, spec: null, problems };
  return { help, given, spec: { email, fullName, orgId, roles: [...new Set(roles)] as AppRole[] }, problems };
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.help) {
  console.log(USAGE);
  process.exit(0);
}
if (parsed.problems.length > 0) {
  for (const p of parsed.problems) console.error(`  ${p}`);
  console.error(`\n${USAGE}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.SEED_ORIGIN ?? 'https://fydr.app';

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (an --env-file names the project).');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ACCOUNTS: Spec[] = parsed.spec ? [parsed.spec] : FIXTURE_ACCOUNTS;
const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
console.log(`project ${host} · links point at ${origin} · ${parsed.spec ? 'one account from the arguments' : 'the two fixture accounts (no arguments given)'}\n`);

let failed = 0;
const issued: { email: string; roles: string; url: string }[] = [];

for (const spec of ACCOUNTS) {
  /* The organisation must exist: a users row pointing at a missing org is a
     sign-in that resolves to nothing. Checked per account, cheaply. */
  const { data: org, error: orgErr } = await admin.from('organisations').select('id, name').eq('id', spec.orgId).is('deleted_at', null).maybeSingle();
  if (orgErr || !org) {
    console.log(`  FAIL  ${spec.email}: no organisation ${spec.orgId}${orgErr ? ` (${orgErr.message})` : ''}. Nothing created.`);
    failed += 1;
    continue;
  }

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

  console.log(`  OK    ${spec.email}  ${spec.fullName}  ${spec.roles.join(', ')}  (${org.name})`);
  issued.push({ email: spec.email, roles: spec.roles.join(', '), url: inviteUrl });
}

if (issued.length) {
  console.log('\nInvite links — single use, and they set no password by themselves.');
  console.log('Following one confirms the address and signs that person in to choose their own:\n');
  for (const i of issued) console.log(`  ${i.roles}\n  ${i.email}\n  ${i.url}\n`);
}
process.exit(failed ? 1 : 0);
