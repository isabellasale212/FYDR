/* PATTERN-S8 D5, decision batch B1 (Isabella, 2026-09-13): deactivate IS the
 * revoke. Deactivating an account invalidates any outstanding invite or magic
 * link at the same moment; there is no separate Revoke control. The invite is
 * a Supabase token nothing in the application schema can see, so the only
 * thing that refuses it is a ban on the auth user — which is why the write
 * goes through a route with the service-role client and not the panel's own
 * RLS write. */
import { readFileSync } from 'node:fs';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the route');
{
  const route = strip(read('src/app/(staff)/settings/users/[userId]/status/route.ts'));
  assert(/hasAnyRole\(claims\.roles, SETTINGS_ADMIN\)/.test(route) && /userId === claims\.userId/.test(route), 'the sport scientist only, never on their own account');
  assert(/\.eq\('org_id', orgId\)\.eq\('id', userId\)/.test(route), 'the target is a user of the admin\'s own club (orgId from the session)');
  assert(/setUserStatus\(db, orgId, claims\.userId, actorRole, userId, status\)/.test(route), 'the application row goes through the same RLS write and refusal words');
  assert(/admin\.auth\.admin\.updateUserById\(userId, \{ ban_duration: status === 'deactivated' \? '876000h' : 'none' \}\)/.test(route), 'then the auth user is banned (or the ban lifted) — the invite and any magic link die with the account');
  assert(/'user\.invites_revoked' : 'user\.invites_restored'/.test(route) && /sign_in_blocked_at_auth: !banErr/.test(route), 'audited, recording whether the sign-in itself was blocked');
  assert(/an outstanding invite or magic link may still work/.test(route), 'a failed ban is said, not hidden behind a clean failure');
}

console.log('\n2. both panels use it; no separate Revoke control');
{
  for (const p of ['src/components/UserDetailPanel/UserDetailPanel.tsx', 'src/components/UserManagementPanel/UserManagementPanel.tsx']) {
    const src = strip(read(p));
    assert(/fetch\(`\/settings\/users\/\$\{user\.id\}\/status`/.test(src) && !/setUserStatus\(/.test(src), `${p.split('/').slice(-1)[0]}: the status write goes through the route`);
    assert(!/Revoke invite|Revoke link|revoke/i.test(src.replace(/S8 D5[^\n]*/g, '')), `${p.split('/').slice(-1)[0]}: no Revoke control`);
  }
  const detail = strip(read('src/components/UserDetailPanel/UserDetailPanel.tsx'));
  assert(/cancels any outstanding invite or magic link at the same moment/.test(detail) && /works again too, until it expires/.test(detail), 'the caption says both consequences before the press');
}

console.log('\n3. the specs');
{
  assert(/Deactivate is the revoke/.test(read('docs/screens/48-users.md')) && /deactivate is the revoke/.test(read('docs/screens/49-user-detail.md')), '48-users.md and 49-user-detail.md say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
