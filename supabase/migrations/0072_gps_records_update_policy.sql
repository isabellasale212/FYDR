-- ---------------------------------------------------------------------------
-- 0072: gps_records gets the UPDATE policy its own upsert needs.
--
-- G-35, and it is the fix for a bug that shipped inside a bug fix.
--
-- 0064 added `unique nulls not distinct (org_id, athlete_id, record_date,
-- session_id)` to stop a re-uploaded GPS file duplicating every row, and
-- lib/queries/gpsImport.ts switched from insert to upsert to go with it. The
-- conflict path of an upsert is an UPDATE. gps_records had an INSERT policy and
-- two SELECT policies and no UPDATE policy at all, so every re-import raised
--
--     42501 permission denied for table gps_records
--
-- for every real user. The duplicate bug was fixed and replaced with a total
-- failure of the same feature.
--
-- WHY IT WAS REPORTED AS VERIFIED, because that matters more than the one-line
-- fix. The original check ran over the `postgres` connection, which carries
-- rolbypassrls, so it never consulted a policy at all. It proved the constraint
-- and the upsert's SQL semantics and nothing whatever about whether a person
-- could do it. That is the same defect as G-32 and it is why every file in the
-- tenancy suite now opens with a canary asserting the session is subject to RLS
-- (G-38), and why 100_gps_import_test.sql now carries the re-import assertion
-- that would have caught this on the day.
--
-- MIRRORS THE INSERT POLICY EXACTLY, deliberately. The right to correct a GPS
-- row by re-uploading the file is the right to import it in the first place:
-- both are the same act from the operator's point of view, and §3.6 gives Import
-- GPS to the sport scientist alone. Anything wider would let a role edit
-- performance history it cannot create, through a screen it cannot open.
--
-- No DELETE policy is added and none is wanted. CLAUDE.md rule 4: athlete data
-- is never hard deleted, and a re-import replaces a row rather than removing it.
--
-- A POLICY IS NOT ENOUGH, and the first version of this migration was wrong for
-- exactly that reason. Adding the policy alone left the upsert failing with the
-- same 42501, because `authenticated` held no UPDATE grant on this table at all:
-- a missing GRANT reads "permission denied for table", where a policy refusal
-- reads "new row violates row-level security policy". Two different errors that
-- look alike at a glance, and only the second is about roles.
--
-- Table-level rather than column-level, which is the choice 0045 made the other
-- way for gym_session_logs: there an athlete may write exactly six columns of
-- their own row, so the grant is the restriction. Here the restriction is
-- entirely in the policy (sport scientist, own org), and a re-import must be
-- able to correct ANY measure it originally wrote, so enumerating columns would
-- be a list to forget to update the next time the importer gains one. This
-- matches sessions, thresholds and athletes, which all grant at table level and
-- restrict in the policy.
-- ---------------------------------------------------------------------------

grant update on public.gps_records to authenticated;

drop policy if exists gps_records_staff_update on public.gps_records;
create policy gps_records_staff_update on public.gps_records
  as permissive
  for update
  to authenticated
  using (
    (org_id = auth_org_id())
    and auth_has_any_role(array['sport_scientist'::app_role])
  )
  with check (
    (org_id = auth_org_id())
    and auth_has_any_role(array['sport_scientist'::app_role])
  );

comment on policy gps_records_staff_update on public.gps_records is
  'The conflict path of the import upsert (0064). Mirrors gps_records_staff_insert '
  'exactly: correcting a row by re-uploading is the same right as importing it. G-35.';
