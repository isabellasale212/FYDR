/* A revoked role stops working on the next request, not up to an hour later.
 *
 * WHAT WAS WRONG. Roles live in the JWT: `custom_access_token_hook` (0010)
 * stamps org_id, roles, athlete_id and `cv` (users.claims_version) into every
 * token, and every RLS policy keys off those claims. So a token minted before a
 * role change carried the OLD authority for its whole life. Production runs a
 * 3600s access token, docs/05-architecture.md:456 specifies 30 minutes as the
 * "worst-case window of stale authority", and the compensating control
 * config.toml:78 advertised — "Role removal forces sign out through the
 * admin-set-role Edge Function" — did not exist: there is no supabase/functions
 * directory in this repo. Meanwhile `cv` was stamped into every token and read
 * by nothing.
 *
 * THE FIX. Every guard funnels through `base()` in src/lib/session.ts, so the
 * comparison lives there once: read users.claims_version for the session's own
 * user, compare it with the token's `cv`, and on a mismatch send the request to
 * /auth/stale-claims, which signs the session out. Revocation now bites on the
 * next request.
 *
 * THE TRAP THIS FILE EXISTS TO PIN. The hook writes `coalesce(v_cv, 1)`, so a
 * NULL claims_version in the database becomes 1 in the token. Compare the raw
 * column against the token and every user with a NULL claims_version mismatches
 * forever — a permanent sign-out loop for exactly the accounts nobody has
 * touched. `claimsStale` therefore applies the same coalesce, and that case is
 * asserted directly rather than trusted to a reading of the code.
 */
import { readFileSync } from 'node:fs';
import { claimsStale } from '@/lib/supabase/claims';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/* ---- the comparison itself, as behaviour rather than as source text ---- */
assert(claimsStale(1, 1) === false, 'matching versions are not stale');
assert(claimsStale(3, 3) === false, 'matching versions are not stale at any value');
assert(claimsStale(1, 2) === true, 'a bumped database version makes the token stale');
assert(claimsStale(2, 1) === true, 'a token ahead of the database is stale too (rollback, restore)');

/* THE COALESCE TRAP. The hook turns a NULL claims_version into 1, so a token
   holding 1 against a NULL column is CURRENT, not stale. */
assert(claimsStale(1, null) === false,
  'token cv 1 against a NULL claims_version is NOT stale (the hook coalesces NULL to 1)');
assert(claimsStale(2, null) === true,
  'but token cv 2 against a NULL claims_version IS stale');

/* FAIL CLOSED on a token with no cv at all. Unreachable in practice — base()
   redirects before the check unless org_id is present, which means the hook ran
   and always stamps cv (verified on a live production token: cv was a number) —
   so closing costs nothing and is the right default for an auth check. */
assert(claimsStale(null, 1) === true, 'a token with no cv at all is treated as stale (fail closed)');
assert(claimsStale(null, null) === true, 'and so is one with neither side present');

/* ---- the wiring ---- */
const claims = blank(readFileSync('src/lib/supabase/claims.ts', 'utf8'));
const session = blank(readFileSync('src/lib/session.ts', 'utf8'));
assert(/claimsVersion/.test(claims), 'FydrClaims carries claimsVersion');
assert(/\bcv\b/.test(claims), 'and it is parsed from the token\'s app_metadata.cv');

const base = /async function base\(\)\s*\{([\s\S]*?)\n\}/.exec(session)?.[1] ?? '';
assert(base.length > 0, 'base() is still the shared root of the guards');
assert(/claims_version/.test(base), 'base() reads users.claims_version at request time');
assert(/claimsStale/.test(base), 'and decides with claimsStale, not an inline comparison');
assert(/\/auth\/stale-claims/.test(base), 'a mismatch redirects to /auth/stale-claims');

/* Every guard must inherit it. requireStaff and requireAthlete call base()
   directly; the rest are built on requireStaff. */
for (const g of ['requireStaff', 'requireAthlete']) {
  const body = new RegExp(`export async function ${g}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(session)?.[1] ?? '';
  assert(/await base\(\)/.test(body), `${g} funnels through base()`);
}
for (const g of ['requireInjuryAccess', 'requirePlatformStaff', 'requireReportAccess']) {
  const body = new RegExp(`export async function ${g}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(session)?.[1] ?? '';
  assert(/await requireStaff\(\)/.test(body), `${g} inherits it via requireStaff()`);
}

/* ---- the sign-out route ---- */
const route = blank(readFileSync('src/app/auth/stale-claims/route.ts', 'utf8'));
assert(/export async function GET/.test(route), 'the route answers GET, which is what redirect() issues');
assert(/signOut\(\)/.test(route), 'it signs the session out');
assert(/claimsStale|claims_version/.test(route),
  're-verifies staleness first, so a stray GET on a healthy session is a no-op rather than a forced sign-out');
assert(/\/login/.test(route), 'and lands on /login');

/* ---- the docs must no longer ADVERTISE a control that does not exist ----
   A bare "does this string appear" check is wrong here, and getting it wrong
   first is what proved it: the corrected comment necessarily QUOTES the claim
   in order to retract it, so any substring match fires on the retraction. Same
   trap as counting tombstone comments as live CSS rules. Test the intent
   instead — the real mechanism is named, and every mention of the Edge Function
   is marked as non-existent rather than presented as a control. */
const toml = readFileSync('supabase/config.toml', 'utf8');
assert(/claims_version/.test(toml),
  'config.toml points at the mechanism that actually enforces revocation');
const edgeMentioned = /admin-set-role Edge Function/.test(toml);
assert(!edgeMentioned || /DOES NOT EXIST|does not exist/.test(toml),
  'and any mention of the admin-set-role Edge Function is marked as non-existent, not advertised');

const arch = readFileSync('docs/05-architecture.md', 'utf8');
assert(/base\(\)/.test(arch) && /claimsStale|claims_version/.test(arch),
  '05-architecture.md documents the request-time comparison that now does the work');
assert(/only two of them existed|only two|Removed from this table/i.test(arch),
  'and records which of its claimed controls were never built rather than quietly dropping them');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
