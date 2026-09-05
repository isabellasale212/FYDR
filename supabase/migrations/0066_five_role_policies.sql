-- ---------------------------------------------------------------------------
-- 0066: the policies catch up with the five-role model.
--
-- 0063 renamed the enum and 0065 repaired the function bodies the rename could
-- not reach. Both were vocabulary. This one is about MEANING, and it is the
-- database half of docs/spec-gaps.md G-29.
--
-- WHAT WAS WRONG. 76 policies gated on array['coach','medic']. In the four-role
-- model that pair was not a coach check and a medic check: it was the phrase
-- "any staff member who is not an admin", because coach and medic were the only
-- two non-admin staff values that existed. seed.sql said so in its own comment,
-- giving the S&C lead and the nutritionist the `coach` role for want of
-- anything better.
--
-- The moment those two people got their own roles, that phrase stopped meaning
-- what it said, and both of them silently lost access to 37 tables: gym logs,
-- GPS, wellness, testing, nutrition, programmes, the schedule. Fail-closed, so
-- nothing leaked, but an S&C coach could not read the gym data that is their
-- entire job.
--
-- WHAT THIS DOES. Every one of those 70 policies is re-created with the role
-- array widened to the five staff roles, which RESTORES the access those people
-- had the day before 0063 rather than granting anything new.
--
-- THE EXCEPTION, and it is the point of the whole exercise. Four tables hold
-- injury and availability data:
--
--     availability, injuries, rehab_assignments, team_allocations
--
-- On those, the nutritionist is left out, which is D-01: "the medic and injury
-- information is limited in all pages and only viewed by coach, medic, S&C and
-- sport scientist, not nutritionist". docs/access-matrix.md §3.2 is X in the
-- nutritionist column on every row. This is the first time that rule has been
-- enforced anywhere in the database, because until now there was no role to
-- enforce it against.
--
-- injury_clinical is deliberately NOT in this migration. It is medic-only, it
-- always was, and §4.1 explains why that boundary is stronger than the rest of
-- the matrix: it is a database rule that no role setting can open.
--
-- FLAGS ARE NOT AN INJURY TABLE, checked rather than assumed. §4.2 says a
-- nutritionist must not see "any flag whose domain is injury or availability".
-- The flag_domain enum has no such value: it is wellness, gym, gps, nutrition,
-- compliance, testing and training. So there is no injury flag to withhold and
-- the table widens with the rest. If an injury domain is ever added, that
-- sentence becomes real work and this comment is where to start.
--
-- Each policy below is its own installed definition read back from pg_policies,
-- with one substitution of the role array and nothing else changed: the same
-- generate-from-the-database technique 0065 used, so the diff cannot carry an
-- accidental change to an org_id predicate or a with-check.
-- ---------------------------------------------------------------------------

drop policy if exists availability_staff_select on public.availability;
create policy availability_staff_select on public.availability
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists body_composition_staff_insert on public.body_composition;
create policy body_composition_staff_insert on public.body_composition
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (recorded_by = auth_user_id())));

drop policy if exists body_composition_staff_select on public.body_composition;
create policy body_composition_staff_select on public.body_composition
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists body_composition_staff_update on public.body_composition;
create policy body_composition_staff_update on public.body_composition
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists body_mass_target_ranges_staff_insert on public.body_mass_target_ranges;
create policy body_mass_target_ranges_staff_insert on public.body_mass_target_ranges
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (set_by = auth_user_id()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = body_mass_target_ranges.athlete_id) AND (a.org_id = auth_org_id()) AND (a.deleted_at IS NULL))))));

drop policy if exists body_mass_target_ranges_staff_select on public.body_mass_target_ranges;
create policy body_mass_target_ranges_staff_select on public.body_mass_target_ranges
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists body_mass_target_ranges_staff_update on public.body_mass_target_ranges;
create policy body_mass_target_ranges_staff_update on public.body_mass_target_ranges
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists compliance_staff_insert on public.compliance_expectations;
create policy compliance_staff_insert on public.compliance_expectations
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists compliance_staff_select on public.compliance_expectations;
create policy compliance_staff_select on public.compliance_expectations
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists compliance_staff_update on public.compliance_expectations;
create policy compliance_staff_update on public.compliance_expectations
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists exercise_overrides_staff_select on public.exercise_overrides;
create policy exercise_overrides_staff_select on public.exercise_overrides
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

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
  WHERE ((pe.id = exercise_overrides.programme_exercise_id) AND (p.org_id = auth_org_id()) AND (auth_has_any_role(ARRAY['coach'::app_role]) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists exercises_staff_insert on public.exercises;
create policy exercises_staff_insert on public.exercises
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists exercises_staff_update on public.exercises;
create policy exercises_staff_update on public.exercises
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists fixtures_staff_insert on public.fixtures;
create policy fixtures_staff_insert on public.fixtures
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists fixtures_staff_update on public.fixtures;
create policy fixtures_staff_update on public.fixtures
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists flag_actions_staff_insert on public.flag_actions;
create policy flag_actions_staff_insert on public.flag_actions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (taken_by = auth_user_id())));

drop policy if exists flag_actions_staff_select on public.flag_actions;
create policy flag_actions_staff_select on public.flag_actions
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists flags_staff_insert on public.flags;
create policy flags_staff_insert on public.flags
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists flags_staff_select on public.flags;
create policy flags_staff_select on public.flags
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists flags_staff_update on public.flags;
create policy flags_staff_update on public.flags
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists gps_records_staff_insert on public.gps_records;
create policy gps_records_staff_insert on public.gps_records
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists gps_records_staff_select on public.gps_records;
create policy gps_records_staff_select on public.gps_records
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists gym_session_logs_staff_select on public.gym_session_logs;
create policy gym_session_logs_staff_select on public.gym_session_logs
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists gym_set_logs_staff_select on public.gym_set_logs;
create policy gym_set_logs_staff_select on public.gym_set_logs
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists import_batches_staff_insert on public.import_batches;
create policy import_batches_staff_insert on public.import_batches
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (imported_by = auth_user_id())));

drop policy if exists import_batches_staff_select on public.import_batches;
create policy import_batches_staff_select on public.import_batches
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists injuries_staff_select on public.injuries;
create policy injuries_staff_select on public.injuries
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists leaderboard_opt_outs_staff_select on public.leaderboard_opt_outs;
create policy leaderboard_opt_outs_staff_select on public.leaderboard_opt_outs
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists leaderboard_opt_outs_staff_update on public.leaderboard_opt_outs;
create policy leaderboard_opt_outs_staff_update on public.leaderboard_opt_outs
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists leaderboards_staff_insert on public.leaderboards;
create policy leaderboards_staff_insert on public.leaderboards
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists leaderboards_staff_select on public.leaderboards;
create policy leaderboards_staff_select on public.leaderboards
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists leaderboards_staff_update on public.leaderboards;
create policy leaderboards_staff_update on public.leaderboards
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists meal_library_staff_select on public.meal_library;
create policy meal_library_staff_select on public.meal_library
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists meal_library_items_staff_select on public.meal_library_items;
create policy meal_library_items_staff_select on public.meal_library_items
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists nutrition_checkins_staff_select on public.nutrition_checkins;
create policy nutrition_checkins_staff_select on public.nutrition_checkins
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists nutrition_rules_staff_select on public.nutrition_rules;
create policy nutrition_rules_staff_select on public.nutrition_rules
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists nutrition_targets_staff_select on public.nutrition_targets;
create policy nutrition_targets_staff_select on public.nutrition_targets
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists programme_assignments_staff_select on public.programme_assignments;
create policy programme_assignments_staff_select on public.programme_assignments
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_assignments.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['coach'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_blocks_staff_select on public.programme_blocks;
create policy programme_blocks_staff_select on public.programme_blocks
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists programme_blocks_update on public.programme_blocks;
create policy programme_blocks_update on public.programme_blocks
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_blocks.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['coach'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_exercises_staff_select on public.programme_exercises;
create policy programme_exercises_staff_select on public.programme_exercises
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

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
  WHERE ((s.id = programme_exercises.programme_session_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['coach'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_sessions_staff_select on public.programme_sessions;
create policy programme_sessions_staff_select on public.programme_sessions
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists programme_sessions_update on public.programme_sessions;
create policy programme_sessions_update on public.programme_sessions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (programme_blocks b
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((b.id = programme_sessions.block_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['coach'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programmes_staff_select on public.programmes;
create policy programmes_staff_select on public.programmes
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists programmes_update on public.programmes;
create policy programmes_update on public.programmes
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['coach'::app_role]) AND (programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['medic'::app_role]) AND (programme_type = 'rehab'::programme_type)))));

drop policy if exists rehab_assignments_staff_select on public.rehab_assignments;
create policy rehab_assignments_staff_select on public.rehab_assignments
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists session_attendance_staff_insert on public.session_attendance;
create policy session_attendance_staff_insert on public.session_attendance
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists session_attendance_staff_select on public.session_attendance;
create policy session_attendance_staff_select on public.session_attendance
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists session_attendance_staff_update on public.session_attendance;
create policy session_attendance_staff_update on public.session_attendance
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists session_participants_staff_delete on public.session_participants;
create policy session_participants_staff_delete on public.session_participants
  as permissive
  for delete
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists session_participants_staff_insert on public.session_participants;
create policy session_participants_staff_insert on public.session_participants
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists sessions_staff_insert on public.sessions;
create policy sessions_staff_insert on public.sessions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists sessions_staff_update on public.sessions;
create policy sessions_staff_update on public.sessions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists team_allocations_staff_select on public.team_allocations;
create policy team_allocations_staff_select on public.team_allocations
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists test_definitions_staff_insert on public.test_definitions;
create policy test_definitions_staff_insert on public.test_definitions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists test_definitions_staff_update on public.test_definitions;
create policy test_definitions_staff_update on public.test_definitions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists test_results_staff_insert on public.test_results;
create policy test_results_staff_insert on public.test_results
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (recorded_by = auth_user_id())));

drop policy if exists test_results_staff_select on public.test_results;
create policy test_results_staff_select on public.test_results
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists test_results_staff_update on public.test_results;
create policy test_results_staff_update on public.test_results
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists training_staff_insert on public.training_entries;
create policy training_staff_insert on public.training_entries
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (source = 'staff_entered'::data_source) AND (created_by = auth_user_id())));

drop policy if exists training_staff_select on public.training_entries;
create policy training_staff_select on public.training_entries
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists vendor_profiles_staff_select on public.vendor_profiles;
create policy vendor_profiles_staff_select on public.vendor_profiles
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists week_templates_staff_insert on public.week_templates;
create policy week_templates_staff_insert on public.week_templates
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists week_templates_staff_select on public.week_templates;
create policy week_templates_staff_select on public.week_templates
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists week_templates_staff_update on public.week_templates;
create policy week_templates_staff_update on public.week_templates
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists wellness_staff_insert on public.wellness_entries;
create policy wellness_staff_insert on public.wellness_entries
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (source = 'staff_entered'::data_source) AND (created_by = auth_user_id())));

drop policy if exists wellness_staff_select on public.wellness_entries;
create policy wellness_staff_select on public.wellness_entries
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));