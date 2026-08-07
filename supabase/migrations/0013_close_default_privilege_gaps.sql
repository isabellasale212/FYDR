-- 0013_close_default_privilege_gaps.sql
--
-- What this does
--   Closes a gap left by 0012: Supabase provisions every project with default privileges
--   that grant `anon` and `authenticated` full CRUD on any table created afterwards
--   (`pg_default_acl`, role postgres, every object in schema public). 0012's revoke loop
--   stripped that default grant from `public` and `anon` on the 29 base tables, but never
--   from `authenticated`, and never touched the five views 0009 and 0010 created. Postgres
--   GRANT is additive, not a reset, so every narrower `grant select, insert to authenticated`
--   already in 0012 landed on top of the untouched default `arwdDxtm`, not in place of it.
--   Found by running `npm run test:tenancy` against a real hosted project for the first
--   time (HANDOVER.md: "no query has ever hit a real database"): tests 93 to 97 and 106 in
--   010_rls_coverage_test.sql.
--
-- Which spec sections this implements
--   The same ones 0012 does: CONTRACT.md rule 2, 04-data-model.md §14, 01-roles-and-
--   permissions.md §6. This migration does not change intent, it makes 0012's own stated
--   intent ("the privileges below grant insert and select and nothing else", line 878)
--   actually true.
--
-- Why a new migration and not an edit to 0012
--   CLAUDE.md §5: "migrations are additive. Never rewrite an applied migration." 0012 is
--   already applied. This repeats its revoke pattern, extended to authenticated and to the
--   five views, then re-issues the exact grants 0012 and 0009/0010 already declared, so the
--   end state matches what those files always said they intended.

-- ===========================================================================
-- 1. authenticated: revoke the default grant, then restore exactly what 0012 intended.
--    Same 29 tables, same order, so this reads next to 0012 §0 and stays in sync with it.
-- ===========================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'organisations', 'users', 'user_roles', 'athletes', 'athlete_consents',
    'groups', 'group_memberships',
    'seasons', 'fixtures', 'sessions', 'session_participants', 'session_attendance',
    'week_templates', 'teams', 'team_allocations',
    'wellness_entries', 'training_entries', 'nutrition_checkins',
    'injuries', 'injury_clinical', 'availability',
    'thresholds', 'threshold_revisions', 'flags', 'flag_actions',
    'compliance_expectations', 'audit_log',
    'notification_preferences', 'push_tokens'
  ]
  loop
    execute format('revoke all on public.%I from authenticated', t);
  end loop;
end $$;

grant select, update on public.organisations to authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update on public.athletes to authenticated;
grant select, insert, update on public.athlete_consents to authenticated;
grant select, insert, update on public.groups to authenticated;
grant select, insert, update on public.group_memberships to authenticated;
grant select, insert, update on public.seasons to authenticated;
grant select, insert, update on public.fixtures to authenticated;
grant select, insert, update on public.sessions to authenticated;
grant select, insert, update, delete on public.session_participants to authenticated;
grant select, insert, update on public.session_attendance to authenticated;
grant select, insert, update on public.week_templates to authenticated;
grant select, insert, update on public.teams to authenticated;
grant select, insert, update on public.team_allocations to authenticated;
grant select, insert on public.wellness_entries to authenticated;
grant select, insert on public.training_entries to authenticated;
grant select, insert on public.nutrition_checkins to authenticated;
grant select, insert, update on public.injuries to authenticated;
grant select, insert, update on public.injury_clinical to authenticated;
grant select, insert, update on public.availability to authenticated;
grant select, insert, update on public.thresholds to authenticated;
grant select, insert on public.threshold_revisions to authenticated;
grant select, insert, update on public.flags to authenticated;
grant select, insert on public.flag_actions to authenticated;
grant select, insert, update on public.compliance_expectations to authenticated;
grant select, insert on public.audit_log to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- audit_log's bigserial sequence, restated because the table-level revoke above does not
-- touch it, but stating it again is free and keeps this file a complete record on its own.
grant usage, select on sequence public.audit_log_id_seq to authenticated;

-- ===========================================================================
-- 2. The five *_current / *_view views from 0009 and 0010. Never covered by 0012's loop
--    at all, so anon, public and authenticated all still hold the untouched default grant.
--    Read only for authenticated; nobody else gets anything, matching 010_rls_coverage_
--    test.sql's "is security_invoker, so RLS on the base table still applies" assertions,
--    which are pointless to hold if the view's own privileges are wide open.
-- ===========================================================================

do $$
declare
  v text;
begin
  foreach v in array array[
    'wellness_entries_current', 'training_entries_current', 'nutrition_checkins_current',
    'athlete_age_view', 'injury_clinical_athlete_view'
  ]
  loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
