/* Every function the app calls as the service role has to be executable by it.
 *
 * WHY THIS EXISTS. 0048 created login_attempt_gate and login_attempt_record_result,
 * revoked EXECUTE from public/anon/authenticated — correctly, and its own comment
 * explains why the revoke has to be explicit — and never granted it back to
 * service_role, which had held it only through the PUBLIC grant just revoked. The
 * two functions ended up executable by their owner and nobody else, including the
 * one caller in the application.
 *
 * IT SURVIVED FOR MONTHS BECAUSE THE ROUTE FAILS OPEN ON PURPOSE. /auth/sign-in
 * catches an error from the limiter and continues to a normal sign-in, since
 * rate-limiting infrastructure breaking should degrade to "not currently rate
 * limited" rather than "nobody can sign in". Right call, and it means a limiter
 * that has never run once is indistinguishable from a healthy one with nothing
 * to do — except for a line in the function log that nobody reads.
 *
 * On 2026-09-07 scratch returned 42501 for both, three failed sign-ins through
 * the real route produced zero rows, and production worked only because the
 * grant had been applied there by hand and was in no migration at all. The
 * repository was not the source of truth for a security control.
 *
 * SO THE RULE IS DERIVED FROM THE CODE, not from a list. Whatever the app calls
 * through the admin client is what must be granted; adding a third admin RPC
 * without a grant fails this. A list would have to be remembered, which is the
 * thing that already failed once.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const walk = (dir: string, ext: string[]): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.some((x) => p.endsWith(x)) ? [p] : [];
  });

const migrations = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join('supabase/migrations', f), 'utf8'))
  .join('\n');

console.log('every RPC called through the service-role client is granted to it');
{
  /* The admin client is the service-role one — createAdminClient(). Its call
     sites are found rather than listed, so a third one cannot be added without
     either a grant or a failure here. */
  const sources = walk('src', ['.ts', '.tsx']);
  const called = new Set<string>();
  for (const p of sources) {
    const src = readFileSync(p, 'utf8');
    if (!/createAdminClient/.test(src)) continue;
    for (const m of src.matchAll(/\badmin\s*\.\s*rpc\(\s*'([a-z_]+)'/g)) called.add(m[1]!);
  }

  assert(called.size >= 2, `found ${called.size} service-role RPC call site(s) — the sweep is looking`);
  assert(called.has('login_attempt_gate'), 'login_attempt_gate is among them');

  for (const fn of [...called].sort()) {
    /* The grant may name several roles on one statement, and may wrap across
       lines, so the match is "a grant execute on this function whose role list
       mentions service_role". */
    const granted = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${fn}\\s*\\([^)]*\\)\\s*to\\s+[^;]*service_role`,
      'i',
    ).test(migrations);
    assert(granted, `${fn} has an explicit service_role grant in a migration`);
  }
}

console.log('\nand the revoke it was hiding behind is still there');
{
  /* The grant must not have been achieved by loosening the revoke. anon and
     authenticated are the browser; the gate would let a caller enumerate which
     emails are locked out, and record_result is the table's only writer, so a
     client that could reach it could clear its own failure streak. */
  for (const fn of ['login_attempt_gate', 'login_attempt_record_result']) {
    for (const role of ['anon', 'authenticated', 'public']) {
      assert(
        new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+${role}`, 'i').test(migrations),
        `${fn} is still revoked from ${role}`,
      );
    }
    assert(
      !new RegExp(`grant\\s+execute\\s+on\\s+function\\s+(?:public\\.)?${fn}\\s*\\([^)]*\\)\\s*to\\s+[^;]*\\b(anon|authenticated)\\b`, 'i').test(migrations),
      `and never granted back to the browser`,
    );
  }
}

console.log('\nthe fix is a migration, not something applied by hand');
{
  /* The whole finding was that production had the grant and no migration did.
     A grant that exists only in somebody's psql history is not a grant this
     project has. */
  const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'));
  const withGrant = files.filter((f) =>
    /grant\s+execute\s+on\s+function\s+(?:public\.)?login_attempt_gate/i.test(
      readFileSync(join('supabase/migrations', f), 'utf8'),
    ),
  );
  assert(withGrant.length > 0, `a migration carries the grant (${withGrant.join(', ') || 'none'})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
