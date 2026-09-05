-- ===========================================================================
-- BLOCKER CLEARED 2026-09-05. Safe to apply. Kept rather than deleted, because
-- the reason it was blocked is the reason the guards exist.
--
-- This migration narrows five sets of writes. Screens still OFFERED those
-- writes to roles it removes, and an UPDATE that RLS filters does not raise: it
-- matches nothing, returns no error, and the app reports success. Applying this
-- alone would have turned working buttons into buttons that lie.
--
-- docs/spec-gaps.md G-34 has the detail. Every affected control is now resolved
-- from lib/access.ts, and every affected write asks for its affected rows, so
-- the next mismatch raises instead of failing silently. Verified as a signed-in
-- medic and a signed-in coach, both directions.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0070: the five G-33 rows, decided.
--
-- 0066 to 0069 were carried out WIDEN ONLY. Where the access matrix would have
-- taken an ability away from somebody using it, the migration stopped and the
-- row was written up as docs/spec-gaps.md G-33 instead, because an earlier
-- draft that did apply one of them broke eleven tenancy assertions, every one a
-- coach doing something a coach does today.
--
-- All five came back decided on 2026-09-05. Three are narrowed as written, one
-- is narrowed for a different reason than the matrix gave, and one is SPLIT
-- rather than taken as written. The distinction between the last two is the
-- whole value of having asked:
--
--   New and edit session      NARROWED. The medic loses scheduling. Not an
--                             intentional permission: the same "coach or medic
--                             actually meant not-admin" artefact 0066 found
--                             everywhere else, so this is a bug fix. Applied to
--                             week_templates as well, which is the same act of
--                             scheduling under another name and would otherwise
--                             leave a medic unable to create a session but able
--                             to create a week of them.
--
--   Leaderboard               SPLIT. The medic loses create, same artefact. The
--                             coach KEEPS it, because that one is a real
--                             permission somebody chose rather than a carried
--                             over bug, and the matrix was WRONG to say
--                             otherwise. docs/access-matrix.md §3.4 has been
--                             corrected to VECD in the coach column rather than
--                             the code being written against a cell nobody
--                             meant.
--
--   Nutrition targets         NARROWED as written. The coach and the medic both
--                             become read-only, and the medic's parallel write
--                             path is dropped rather than repointed. This was
--                             specialist territory in the original spec, not a
--                             casualty of the four-role bug.
--
--   Programme builder         NARROWED as written. Gym authorship is the sport
--                             scientist's and the S&C's. The rehab branch is
--                             untouched: still the medic's, plus the sport
--                             scientist, exactly as 0022 and 0067 left it.
--
--   Import GPS                NARROWED as written. The sport scientist alone,
--                             on both the batch and the rows it writes.
--
-- THE LEAN CLUB, and why it does not argue for a wider default.
--
-- The obvious objection to the last two is a club with no dedicated S&C: narrow
-- the base role and somebody is locked out of a screen the day it ships. The
-- answer is that Fydr already lets one account hold several roles. A coach who
-- also does the S&C work holds both, and the S&C role satisfies the check. That
-- is the same additive property §2 of the matrix warns about from the other
-- direction, where a nutritionist who also holds coach can see injury data.
--
-- Asserted rather than assumed, because "it already works" is exactly the kind
-- of claim this project has been wrong about before:
-- supabase/tests/070_programmes_test.sql now carries a fixture user holding
-- coach and strength_conditioning together and checks they can author a gym
-- programme that neither a plain coach nor a plain medic can.
--
-- Generated as 0065 to 0069 were: each policy is its own installed definition
-- read back from pg_policies with exactly one role array replaced, asserted at
-- generation time, so nothing else in the expression can drift.
-- ---------------------------------------------------------------------------

drop policy if exists sessions_staff_insert on public.sessions;
create policy sessions_staff_insert on public.sessions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists sessions_staff_update on public.sessions;
create policy sessions_staff_update on public.sessions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists week_templates_staff_insert on public.week_templates;
create policy week_templates_staff_insert on public.week_templates
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists week_templates_staff_update on public.week_templates;
create policy week_templates_staff_update on public.week_templates
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists leaderboards_staff_insert on public.leaderboards;
create policy leaderboards_staff_insert on public.leaderboards
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists leaderboards_staff_update on public.leaderboards;
create policy leaderboards_staff_update on public.leaderboards
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_targets_coach_insert on public.nutrition_targets;
create policy nutrition_targets_nutrition_insert on public.nutrition_targets
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role]) AND (created_by = auth_user_id())));

drop policy if exists nutrition_targets_coach_update on public.nutrition_targets;
create policy nutrition_targets_nutrition_update on public.nutrition_targets
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_rules_coach_insert on public.nutrition_rules;
create policy nutrition_rules_nutrition_insert on public.nutrition_rules
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role]) AND (created_by = auth_user_id())));

drop policy if exists nutrition_rules_coach_update on public.nutrition_rules;
create policy nutrition_rules_nutrition_update on public.nutrition_rules
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_targets_medical_insert on public.nutrition_targets;

drop policy if exists nutrition_targets_medical_update on public.nutrition_targets;

drop policy if exists nutrition_rules_medical_insert on public.nutrition_rules;

drop policy if exists nutrition_rules_medical_update on public.nutrition_rules;

drop policy if exists exercise_overrides_update on public.exercise_overrides;
create policy exercise_overrides_update on public.exercise_overrides
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (((programme_exercises pe
     JOIN programme_sessions s ON ((s.id = pe.programme_session_id)))
     JOIN programme_blocks b ON ((b.id = s.block_id)))
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((pe.id = exercise_overrides.programme_exercise_id) AND (p.org_id = auth_org_id()) AND (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists exercise_overrides_write on public.exercise_overrides;
create policy exercise_overrides_write on public.exercise_overrides
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (created_by = auth_user_id()) AND (EXISTS ( SELECT 1
   FROM (((programme_exercises pe
     JOIN programme_sessions s ON ((s.id = pe.programme_session_id)))
     JOIN programme_blocks b ON ((b.id = s.block_id)))
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((pe.id = exercise_overrides.programme_exercise_id) AND (p.org_id = auth_org_id()) AND (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programmes_update on public.programmes;
create policy programmes_update on public.programmes
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (programme_type = 'rehab'::programme_type)))));

drop policy if exists programmes_write on public.programmes;
create policy programmes_write on public.programmes
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (programme_type = 'rehab'::programme_type)))));

drop policy if exists programme_blocks_update on public.programme_blocks;
create policy programme_blocks_update on public.programme_blocks
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_blocks.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_blocks_write on public.programme_blocks;
create policy programme_blocks_write on public.programme_blocks
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_blocks.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_sessions_update on public.programme_sessions;
create policy programme_sessions_update on public.programme_sessions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (programme_blocks b
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((b.id = programme_sessions.block_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_sessions_write on public.programme_sessions;
create policy programme_sessions_write on public.programme_sessions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (programme_blocks b
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((b.id = programme_sessions.block_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_exercises_update on public.programme_exercises;
create policy programme_exercises_update on public.programme_exercises
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM ((programme_sessions s
     JOIN programme_blocks b ON ((b.id = s.block_id)))
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((s.id = programme_exercises.programme_session_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_exercises_write on public.programme_exercises;
create policy programme_exercises_write on public.programme_exercises
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM ((programme_sessions s
     JOIN programme_blocks b ON ((b.id = s.block_id)))
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((s.id = programme_exercises.programme_session_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_assignments.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_assignments_write on public.programme_assignments;
create policy programme_assignments_write on public.programme_assignments
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (assigned_by = auth_user_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_assignments.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists import_batches_staff_insert on public.import_batches;
create policy import_batches_staff_insert on public.import_batches
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role]) AND (imported_by = auth_user_id())));

drop policy if exists gps_records_staff_insert on public.gps_records;
create policy gps_records_staff_insert on public.gps_records
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role])));