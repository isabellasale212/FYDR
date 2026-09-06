-- ---------------------------------------------------------------------------
-- 0073: the writes 0066 widened and 0070 never narrowed. G-43.
--
-- 0066 rewrote every policy naming array['coach','medic'], on the reasoning that
-- the pair meant "any staff" in the four-role model. That reasoning was right
-- for most tables and wrong for these seven, and 0070 only narrowed the five
-- rows somebody had actually been shown. So this is the seam between the two:
-- a sweep widened by pattern, and the correction was by exception.
--
-- Found by accident, which is the part worth remembering. A Run-level check
-- during unrelated work expected a medic to be refused a fixture edit, and they
-- were not. All twenty all-five-writable tables were then read one at a time
-- against the matrix column governing them, because an unchecked table looks
-- exactly like a checked-and-correct one until something trips over it.
--
--   fixtures                 §3.1 "Fixtures VEC VEC V V V"  -> sport scientist, coach
--   session_participants     §3.1 "New and edit session VEC VEC X X X"
--                                                          -> sport scientist, coach
--   exercises                §3.3 "Exercise library VEC V V VEC V"
--                                                          -> sport scientist, S&C
--   body_mass_target_ranges  §3.3 "Body mass target ranges VEC V V V VECD"
--                                                          -> sport scientist, nutritionist
--   test_definitions         to-do 2026-09-04: "created and completed by any
--   test_results             staff role except the nutritionist", which
--                            supersedes §3.4's V for the medic
--
-- BODY_COMPOSITION IS A DECISION, not a reading, and it is the one row the
-- documents could not settle between them. §3.1 gives the S&C and the
-- nutritionist VP on the athlete profile, which argues neither should log a
-- weigh-in. But a weigh-in is the input to the nutrition target the nutritionist
-- owns at VECD in §3.3, and the specification's own screen table lists "logs a
-- weigh in" among what the sport scientist does. Taken 2026-09-06 as the union
-- of what both documents claim rather than by picking one:
--
--   body_composition -> sport scientist, medic, S&C, nutritionist
--
-- The medic keeps it: body mass is clinical context during a return to play, and
-- §3.1 gives the medic VE on the athlete profile outright rather than the VP the
-- S&C and the nutritionist have. The COACH is the only staff role excluded. It is
-- the only narrowing here that is not a straight reading of a written rule, which
-- is why it is spelled out rather than listed with the others.
--
-- Nothing here touches injury or clinical data, and D-01 is unaffected. These
-- are roles able to change things the specification does not give them.
--
-- Generated as 0065 to 0072 were: each policy read back from pg_policies with
-- exactly the all-five role array replaced, so nothing else in the expression
-- can drift.
-- ---------------------------------------------------------------------------

drop policy if exists body_composition_staff_insert on public.body_composition;
create policy body_composition_staff_insert on public.body_composition
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role]) AND (recorded_by = auth_user_id())));

drop policy if exists body_composition_staff_update on public.body_composition;
create policy body_composition_staff_update on public.body_composition
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists body_mass_target_ranges_staff_insert on public.body_mass_target_ranges;
create policy body_mass_target_ranges_staff_insert on public.body_mass_target_ranges
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role]) AND (set_by = auth_user_id()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = body_mass_target_ranges.athlete_id) AND (a.org_id = auth_org_id()) AND (a.deleted_at IS NULL))))));

drop policy if exists body_mass_target_ranges_staff_update on public.body_mass_target_ranges;
create policy body_mass_target_ranges_staff_update on public.body_mass_target_ranges
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'nutritionist'::app_role])));

drop policy if exists exercises_staff_insert on public.exercises;
create policy exercises_staff_insert on public.exercises
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists exercises_staff_update on public.exercises;
create policy exercises_staff_update on public.exercises
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'strength_conditioning'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists fixtures_staff_insert on public.fixtures;
create policy fixtures_staff_insert on public.fixtures
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists fixtures_staff_update on public.fixtures;
create policy fixtures_staff_update on public.fixtures
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists session_participants_staff_delete on public.session_participants;
create policy session_participants_staff_delete on public.session_participants
  as permissive
  for delete
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists session_participants_staff_insert on public.session_participants;
create policy session_participants_staff_insert on public.session_participants
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists test_definitions_staff_insert on public.test_definitions;
create policy test_definitions_staff_insert on public.test_definitions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists test_definitions_staff_update on public.test_definitions;
create policy test_definitions_staff_update on public.test_definitions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists test_results_staff_insert on public.test_results;
create policy test_results_staff_insert on public.test_results
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role]) AND (recorded_by = auth_user_id())));

drop policy if exists test_results_staff_update on public.test_results;
create policy test_results_staff_update on public.test_results
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])))
  with check ((org_id = auth_org_id()));