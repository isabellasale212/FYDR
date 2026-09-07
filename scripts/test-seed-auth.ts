/* seed:auth has to make its own claim true, and only on scratch.
 *
 * WHAT WENT WRONG, on 2026-09-07. Verifying the sign-in audit needed a real
 * sign-in, and the password in .env.local did not work: `signInWithPassword`
 * returned "Invalid login credentials" for every seeded account on scratch. The
 * accounts existed and were confirmed. The passwords had simply drifted from
 * the value the file says they use.
 *
 * The cause is in seed-auth.ts's own output. It calls `createUser` per row,
 * counts an "already exists" error as `existing`, skips, and then prints:
 *
 *     Every one uses the password in SEED_USER_PASSWORD.
 *
 * which is false for exactly the accounts it skipped — and after the first run,
 * that is all of them. The script is named for seeding logins and it stops
 * short of making the logins usable, while saying it did.
 *
 * SO THE FIX IS THAT IT ENSURES, and this file pins both halves: the password
 * really is set on accounts that already exist, and the summary line describes
 * what happened rather than restating an intention.
 *
 * AND IT IS GUARDED, because "reset the password on every account" is a
 * sentence that must never run against production. The guard is the one
 * reset-scratch.mjs already reasons through, extracted so it can be driven with
 * real URL shapes here rather than read and believed.
 */
import { readFileSync } from 'node:fs';
import { describeTarget, SCRATCH_REF, PRODUCTION_REF } from './lib/scratch-guard.mjs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const seedRaw = readFileSync('scripts/seed-auth.ts', 'utf8');
/* Comments stripped for every assertion about BEHAVIOUR. The header quotes the
   old summary line verbatim to name what was wrong with it, and a naive search
   reads that quotation as the bug still being present — the same trap that made
   the launch-page test read its own explanatory comment as page copy. What the
   script says in prose and what it executes are different questions. */
const seed = seedRaw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

console.log('the target check knows both URL shapes, not just the host one');
{
  /* A direct connection carries the ref in the host; a pooler connection
     carries it in the USERNAME and its host names no project at all. Both
     projects are reachable both ways since the IPv4 pooler fallback, so a
     host-only check is wrong on live infrastructure, not in theory. */
  const direct = `https://${SCRATCH_REF}.supabase.co`;
  const directDb = `postgresql://postgres:pw@db.${SCRATCH_REF}.supabase.co:5432/postgres`;
  const pooler = `postgresql://postgres.${SCRATCH_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`;

  assert(describeTarget(direct).ok, 'scratch, direct https URL');
  assert(describeTarget(directDb).ok, 'scratch, direct postgres URL');
  assert(describeTarget(pooler).ok, 'scratch, POOLER URL — the ref is in the username, not the host');
}

console.log('\nand it refuses production in both of them');
{
  const prodDirect = `https://${PRODUCTION_REF}.supabase.co`;
  const prodPooler = `postgresql://postgres.${PRODUCTION_REF}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`;

  for (const [u, what] of [[prodDirect, 'direct'], [prodPooler, 'POOLER']] as const) {
    const v = describeTarget(u);
    assert(!v.ok, `production ${what} URL is refused`);
    assert(v.namesProduction, `  and is identified as production, not merely "not scratch"`);
    assert(/PRODUCTION/.test(v.reason), `  and the refusal says so`);
  }
}

console.log('\na URL that names nothing is refused too — "not production" is not "safe"');
{
  for (const u of ['', undefined, 'http://localhost:54321', 'https://example.supabase.co']) {
    const v = describeTarget(u);
    assert(!v.ok, `refused: ${JSON.stringify(u)}`);
    assert(!v.namesProduction && !v.namesScratch, '  named neither project');
  }
}

console.log('\nthe two refs are different, which every assertion above assumes');
{
  assert(SCRATCH_REF !== PRODUCTION_REF, 'scratch and production are not the same string');
  assert(
    describeTarget(`${SCRATCH_REF} ${PRODUCTION_REF}`).ok === false,
    'and a string carrying BOTH is refused — production wins the tie, never scratch',
  );
}

console.log('\nseed-auth resets the password on accounts that already exist');
{
  assert(/updateUserById/.test(seed), 'it calls updateUserById, so an existing account is repaired rather than skipped');
  assert(
    /already/i.test(seed) && /updateUserById/.test(seed),
    'on the "already exists" path specifically — that is the case that drifted',
  );
  assert(
    !/Every one uses the password in SEED_USER_PASSWORD\./.test(seed),
    'the old summary line is no longer PRINTED — it claimed something true only of newly created accounts',
  );
  assert(/reset|updated/i.test(seed), 'the summary counts what it actually changed');
  assert(
    /Every one uses the password in SEED_USER_PASSWORD\./.test(seedRaw),
    'while the header still quotes it, so the reason the passwords drifted stays on the record',
  );
}

console.log('\nand it will not do that to production');
{
  assert(/describeTarget/.test(seed), 'seed-auth uses the shared target check rather than its own');
  assert(/--confirm/.test(seed), 'a password reset needs --confirm, like reset-scratch.mjs');
  assert(
    /process\.exit\(1\)/.test(seed),
    'and a refused target exits non-zero rather than carrying on',
  );

  /* The npm script must point somewhere by default. Node's --env-file does not
     override variables already exported, so this is convenience rather than
     protection — the ref check above is what actually protects production, and
     saying which is which matters. */
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
  assert(/--env-file/.test(pkg.scripts['seed:auth'] ?? ''), 'npm run seed:auth names an env file rather than relying on an exported environment');
  assert(/\.env\.local/.test(pkg.scripts['seed:auth'] ?? ''), 'and it is .env.local, which is scratch');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
