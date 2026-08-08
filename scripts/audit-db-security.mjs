/* A standing security audit, not a one-off script — run this after every
 * migration that adds a table or a function, not just once. It checks
 * the two boundary classes this build has found real gaps in before:
 *
 *   1. Function execute grants. A new function in the public schema gets
 *      execute granted to anon/authenticated/service_role automatically
 *      on this project (a genuine Supabase convention, not a bug) —
 *      correct for the RPC endpoints meant to be called directly, wrong
 *      for an internal SECURITY DEFINER helper that was never meant to
 *      be one. public.athlete_is_minor was exactly this: took an
 *      arbitrary athlete id with no auth_org_id() scoping check inside
 *      it, and a fully unauthenticated caller could ask it whether any
 *      specific athlete on the project is a minor (migrations 0035,
 *      0036). This script prints every SECURITY DEFINER function
 *      authenticated or anon can call directly, so a reviewer can check
 *      each one is either safe by construction (reads only the caller's
 *      own claims, like auth_org_id()) or genuinely internally scoped
 *      (like compute_leaderboard, which checks org_id and caller
 *      identity before returning a single row).
 *
 *   2. Table-level RLS coverage. Every table in `public` should have RLS
 *      enabled, with at least one policy, and no table should carry any
 *      grant to `anon` at all — this schema's own tenancy boundary
 *      (CLAUDE.md rule 1) depends on RLS, not on the application layer
 *      remembering to filter by org_id.
 *
 * A retention-style gap (migration 0034's own PUBLIC execute grant on
 * retention.nightly_preview, found by checking one new function's own
 * permissions right after writing it) is what prompted the wider sweep
 * this script now makes repeatable. Both fixed on discovery; this file
 * exists so the next one doesn't wait for a second, independent search
 * to notice it.
 *
 * Run with env vars loaded: `set -a && source .env.local && set +a && node scripts/audit-db-security.mjs`
 */

import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

console.log('=== Table-level RLS coverage ===\n');

const tables = await c.query(`
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
`);
const noRls = tables.rows.filter((row) => !row.rls_enabled);
console.log(`${tables.rows.length} tables checked, ${noRls.length} without RLS enabled.`);
for (const row of noRls) console.log(`  ✗ ${row.table_name} — RLS not enabled`);

const policyCounts = await c.query(`
  select c.relname as table_name, count(p.polname) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
  group by c.relname
  having count(p.polname) = 0
  order by c.relname
`);
console.log(`${policyCounts.rows.length} tables have RLS enabled but zero policies (silently inaccessible to everyone but the owner).`);
for (const row of policyCounts.rows) console.log(`  ⚠ ${row.table_name} — RLS on, no policies`);

const anonGrants = await c.query(`
  select distinct table_name from information_schema.table_privileges
  where grantee = 'anon' and table_schema = 'public'
  order by table_name
`);
console.log(`${anonGrants.rows.length} tables have any grant to anon (expect 0 — anonymous access should go through Storage policies, not table grants).`);
for (const row of anonGrants.rows) console.log(`  ⚠ ${row.table_name} — anon has a table-level grant`);

console.log('\n=== SECURITY DEFINER functions callable by authenticated or anon ===\n');

const funcs = await c.query(`
  select n.nspname as schema, p.proname as name,
         pg_get_function_identity_arguments(p.oid) as args,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'retention')
    and p.prosecdef = true
    and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))
  order by n.nspname, p.proname
`);
console.log(`${funcs.rows.length} SECURITY DEFINER functions are directly callable by authenticated and/or anon.`);
console.log('Each one below needs to either read only the caller\'s own JWT claims (safe by construction,');
console.log('like auth_org_id()) or explicitly check org/ownership internally before returning anything —');
console.log('confirm each by reading its definition, not just this list.\n');
for (const row of funcs.rows) {
  const callers = [row.authenticated_can_execute && 'authenticated', row.anon_can_execute && 'anon'].filter(Boolean).join(', ');
  console.log(`  ${row.schema}.${row.name}(${row.args})  — callable by: ${callers}`);
}

await c.end();
