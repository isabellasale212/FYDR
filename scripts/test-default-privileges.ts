/* Every table created in schema public must revoke the default grant first.
 *
 * WHY THIS EXISTS. Supabase provisions the project with default privileges that
 * hand anon, authenticated and service_role all seven privileges on any table
 * created afterwards in public (pg_default_acl, role postgres: anon=arwdDxtm).
 * GRANT is additive, so a migration that writes `grant select, insert ... to
 * authenticated` and nothing else lands its narrow grant ON TOP OF the wide
 * default rather than in place of it. The table then reads as locked down in the
 * migration and is wide open in the database.
 *
 * This has now happened twice. 0013 closed it for the 29 tables that existed
 * then, and its header says it was found only by running the tests against a
 * real hosted project for the first time. 0080 created injury_timeline_event and
 * reopened it, and that went unseen for the same reason in a new form: the
 * assertions that catch it live in pgTAP (010 and 400), and pgTAP could not be
 * run on this machine until psql was installed. Prebuild runs; pgTAP did not.
 *
 * So the check moved to where it actually executes. 0090 fixes the live grant;
 * this stops the third one.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const DIR = 'supabase/migrations';

/** Comments are stripped before anything is matched. A migration that discusses
 *  a revoke in prose must not be credited with performing one — the same trap
 *  that has produced a passing-for-the-wrong-reason test in this repo before. */
export function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Tables a migration creates in public, whether or not it qualifies the name.
 *  An unqualified CREATE TABLE lands in public too, which is the whole point. */
export function tablesCreated(sql: string): string[] {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  return [...stripComments(sql).matchAll(re)].map((m) => (m[1] ?? '').toLowerCase()).filter(Boolean);
}

/** Tables a migration revokes from `role`. Both roles have to be asked about
 *  separately, because the bug this guard exists for is a revoke that named one
 *  and not the other: 0032 and 0048 both wrote `from public, anon` and left
 *  authenticated holding the full default set.
 *
 *  ONE TARGET LIST PER STATEMENT, and that matters: 0032's revoke names two
 *  tables in a single statement, `revoke all on public.sar_requests,
 *  public.sar_clinical_reviews from public, anon`. An earlier draft of this
 *  parser captured only the first and reported the second as unrevoked. */
export function tablesRevokedFrom(sql: string, role: 'anon' | 'authenticated'): string[] {
  const body = stripComments(sql);
  const out: string[] = [];
  for (const m of body.matchAll(/revoke\s+[\s\S]*?\s+on\s+(?:table\s+)?([a-z_0-9.,\s"]+?)\s+from\s+([^;]+);/gi)) {
    const targets = m[2] ?? '';
    if (!new RegExp(`\\b${role}\\b`, 'i').test(targets)) continue;
    for (const t of (m[1] ?? '').split(',')) {
      const name = t.trim().replace(/^public\./i, '').replace(/"/g, '');
      if (/^[a-z_][a-z0-9_]*$/.test(name)) out.push(name.toLowerCase());
    }
  }
  /* 0013's shape: a loop over an array of names, revoking inside a do block.
     Matched separately because the table names are data there, not syntax. */
  if (new RegExp(`revoke\\s+all[\\s\\S]{0,200}?from\\s+[^;]*\\b${role}\\b`, 'i').test(body)) {
    for (const m of body.matchAll(/'([a-z_][a-z0-9_]*)'/g)) out.push((m[1] ?? '').toLowerCase());
  }
  return out;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

console.log('the guard reads SQL, not the prose around it');
{
  const prose = "-- revoke all on public.thing from anon;\ncreate table public.thing (id uuid);";
  assert(tablesRevokedFrom(prose, 'anon').length === 0, 'a revoke inside a comment is not a revoke');
  assert(tablesCreated(prose).includes('thing'), 'but the create outside it still counts');
  assert(
    tablesCreated('-- create table public.ghost (id uuid);').length === 0,
    'and a create inside a comment is not a create either',
  );
}

console.log('\nit recognises the shapes the repository actually uses');
{
  assert(
    tablesRevokedFrom('revoke all on public.a from public, anon, authenticated;', 'anon').includes('a'),
    "0045's shape: revoke all on public.x from public, anon, authenticated",
  );
  {
    /* 0032's shape, and the case that broke the first version of this parser. */
    const two = 'revoke all on public.sar_requests, public.sar_clinical_reviews from public, anon;';
    const got = tablesRevokedFrom(two, 'anon');
    assert(
      got.includes('sar_requests') && got.includes('sar_clinical_reviews'),
      'a revoke naming two tables in one statement covers BOTH of them',
    );
    assert(
      tablesRevokedFrom(two, 'authenticated').length === 0,
      'and that same statement revokes nothing from authenticated, which is 0032\'s actual bug',
    );
  }
  assert(
    tablesCreated('create table if not exists sar_requests (id uuid);').includes('sar_requests'),
    'an unqualified create table, which lands in public just the same',
  );
  assert(
    tablesRevokedFrom('revoke select on public.b from anon;', 'anon').includes('b'),
    'and a narrower revoke naming anon',
  );
  assert(
    !tablesRevokedFrom('revoke update on public.c from authenticated;', 'anon').includes('c'),
    'but not one that never mentions anon — that is the gap 0013 was written to close',
  );
}

console.log('\nit would have caught 0080, which is the regression it exists for');
{
  const eighty = readFileSync(join(DIR, '0080_injury_timeline.sql'), 'utf8');
  assert(
    tablesCreated(eighty).includes('injury_timeline_event'),
    '0080 creates injury_timeline_event',
  );
  assert(
    !tablesRevokedFrom(eighty, 'anon').includes('injury_timeline_event'),
    'and never revokes the default grant from anon, which is exactly the bug',
  );
  const ninety = readFileSync(join(DIR, '0090_close_default_privilege_gaps_again.sql'), 'utf8');
  assert(
    tablesRevokedFrom(ninety, 'anon').includes('injury_timeline_event'),
    'and 0090 is the migration that does revoke it',
  );
  for (const t of ['login_attempts', 'sar_requests', 'sar_clinical_reviews']) {
    assert(
      tablesRevokedFrom(ninety, 'authenticated').includes(t),
      `0090 also revokes ${t} from authenticated, which 0032 and 0048 never did`,
    );
  }
}

console.log('\nevery table created in public is revoked from BOTH roles somewhere');
{
  /* Both, separately. Asking only about anon is how 0032 and 0048 passed review:
     they do revoke, they revoke from the wrong half of the pair. */
  const bodies = files.map((f) => [f, readFileSync(join(DIR, f), 'utf8')] as const);
  for (const role of ['anon', 'authenticated'] as const) {
    const revoked = new Set(bodies.flatMap(([, b]) => tablesRevokedFrom(b, role)));
    const gaps: string[] = [];
    for (const [f, b] of bodies) {
      for (const t of tablesCreated(b)) if (!revoked.has(t)) gaps.push(`${t} (${f})`);
    }
    assert(
      gaps.length === 0,
      gaps.length === 0
        ? `no table is left holding the default ${role} grant`
        : `never revoked from ${role}: ${gaps.join(', ')}`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
