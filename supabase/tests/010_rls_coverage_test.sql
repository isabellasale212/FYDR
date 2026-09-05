-- 010_rls_coverage_test.sql
--
-- Structural assertions about the access control layer itself, before any row is read.
-- These are the cheap checks that catch a whole class of mistake: a table added without
-- RLS, a policy file that stopped halfway, an update grant that crept onto an entry table.
--
-- Which spec sections this implements
--   10-roadmap.md §3 exit criteria: "every table has RLS enabled and at least one policy,
--     asserted automatically"
--   decisions/adr-005-immutable-entries.md: "there are no update grants on entry tables
--     for any application role"
--   04-data-model.md §13: audit_log is append only, "no update or delete grants on this
--     table for any application role"
--   04-data-model.md §17.9: the current revision views are security_invoker, so base table
--     policies apply unchanged
--
-- Table enumeration is dynamic. A table added tomorrow is in this suite tomorrow.

begin;
select * from no_plan();


-- ---------------------------------------------------------------------------
-- Every table in public has row level security enabled.
-- ---------------------------------------------------------------------------

select ok(
  (select c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = t),
  format('%s: row level security is enabled', t)
)
from tests.all_public_tables() t;


-- ---------------------------------------------------------------------------
-- Every table in public has at least one policy. RLS enabled with no policy denies
-- everything, which is safe but is almost always a half finished migration.
-- ---------------------------------------------------------------------------

select cmp_ok(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t)::int,
  '>=', 1,
  format('%s: has at least one policy', t)
)
from tests.all_public_tables() t;


-- ---------------------------------------------------------------------------
-- Every club data table has a policy that mentions auth_org_id.
--
-- CONTRACT.md rule 1 and 01-roles-and-permissions.md §6: every RLS policy begins by
-- matching org_id against the organisation on the authenticated session's claims. A policy
-- with no tenancy predicate is the single defect that produces a cross organisation read.
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(coalesce(p.qual, '') || coalesce(p.with_check, '') like '%auth_org_id%')
     from pg_policies p
    where p.schemaname = 'public' and p.tablename = t),
  format('%s: every policy filters on auth_org_id()', t)
)
from tests.club_tables() t;


-- ---------------------------------------------------------------------------
-- Entry tables are immutable. No update policy, no delete policy, and no update or delete
-- privilege granted to authenticated, for any of the three.
--
-- Belt and braces on purpose: the privilege is what PostgreSQL checks first, the missing
-- policy is what a reviewer reads, and either one alone would be enough.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t and p.cmd = 'UPDATE')::int,
  0,
  format('%s: has NO update policy, corrections are new revision rows (ADR-005)', t)
)
from unnest(array['wellness_entries', 'training_entries', 'nutrition_checkins']) t;

select is(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t and p.cmd = 'DELETE')::int,
  0,
  format('%s: has NO delete policy, athlete data is never hard deleted', t)
)
from unnest(array['wellness_entries', 'training_entries', 'nutrition_checkins']) t;

select is(
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = t
      and g.grantee = 'authenticated'
      and g.privilege_type in ('UPDATE', 'DELETE'))::int,
  0,
  format('%s: authenticated holds no UPDATE or DELETE privilege', t)
)
from unnest(array['wellness_entries', 'training_entries', 'nutrition_checkins']) t;


-- ---------------------------------------------------------------------------
-- audit_log is insert only. No role gets update or delete.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'audit_log'
      and p.cmd in ('UPDATE', 'DELETE'))::int,
  0,
  'audit_log: no update or delete policy exists for any role'
);

select is(
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.table_name = 'audit_log'
      and g.privilege_type in ('UPDATE', 'DELETE')
      and g.grantee in ('authenticated', 'anon', 'PUBLIC'))::int,
  0,
  'audit_log: no application role holds UPDATE or DELETE'
);


-- ---------------------------------------------------------------------------
-- Rows are never deleted from the tables that record what happened.
-- 04-data-model.md §17.13 for team_allocations, §9 for injuries, §1 for the rest.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = t and p.cmd = 'DELETE')::int,
  0,
  format('%s: has no delete policy', t)
)
from unnest(array['team_allocations', 'injuries', 'injury_clinical', 'availability',
                  'athletes', 'flags', 'flag_actions', 'threshold_revisions',
                  'rehab_assignments', 'nutrition_targets',
                  'exercises', 'programmes', 'programme_blocks', 'programme_sessions',
                  'programme_exercises', 'programme_assignments', 'gym_session_logs',
                  'gym_set_logs', 'gps_records', 'import_batches', 'vendor_profiles',
                  'test_definitions', 'test_results', 'body_composition']) t;


-- ---------------------------------------------------------------------------
-- anon reads nothing. An unauthenticated caller has no business in club data.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee = 'anon')::int,
  0,
  'anon holds no privilege on any table in public'
);


-- ---------------------------------------------------------------------------
-- The current revision views are security_invoker, so base table RLS applies. A view
-- created without it runs as its owner and silently bypasses row level security.
-- ---------------------------------------------------------------------------

select ok(
  (select 'security_invoker=true' = any(c.reloptions)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v),
  format('%s: is security_invoker, so RLS on the base table still applies', v)
)
from unnest(array['wellness_entries_current', 'training_entries_current',
                  'nutrition_checkins_current', 'athlete_age_view']) v;


-- ---------------------------------------------------------------------------
-- The sanitised clinical view does not have a clinical_notes column at all.
-- Not filtered, not nulled: absent. 01-roles-and-permissions.md §4 carve out 1.
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'injury_clinical_athlete_view'
      and column_name = 'clinical_notes')::int,
  0,
  'injury_clinical_athlete_view: clinical_notes is not a column of the view'
);

select is(
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'injury_clinical')::int,
  1,
  'injury_clinical: exactly one policy exists, and it is the medical only one'
);

select ok(
  (select p.roles::text[] = array['authenticated']
       and p.cmd = 'ALL'
       and p.qual like '%''medic''::app_role%'
       and p.qual not like '%''coach''%'
       and p.qual not like '%''sport_scientist''%'
       and p.qual not like '%''strength_conditioning''%'
       and p.qual not like '%''nutritionist''%'
     from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'injury_clinical'),
  'injury_clinical: the one policy is FOR ALL, requires medic, and names no other role'
);


select * from finish();
rollback;
