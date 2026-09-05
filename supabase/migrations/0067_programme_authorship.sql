-- ---------------------------------------------------------------------------
-- 0067: who writes a gym programme, and who writes a rehab programme.
--
-- 0066 widened 70 policies mechanically, because array['coach','medic'] there
-- was one phrase meaning "any staff". These twelve are the ones it deliberately
-- skipped, and the reason matters: they do not use that pair at all. They use
-- two SEPARATE single-role tests, which is the whole point of migration 0022:
--
--     (coach AND programme_type <> 'rehab')  OR  (medic AND programme_type = 'rehab')
--
-- A coach writes gym work, a medic writes rehab work, and neither writes the
-- other. That split is real and survives untouched. What changes is only who
-- else stands on each side of it:
--
--     gym     coach   ->  sport_scientist, coach, strength_conditioning
--     rehab   medic   ->  sport_scientist, medic
--
-- Nobody loses anything. The coach keeps gym authorship and the medic keeps
-- rehab authorship; the S&C gains gym, which is the job the role was asked for,
-- and the sport scientist gains both, per §1's "Everything. The role with no
-- restrictions".
--
-- WHAT THIS DELIBERATELY DOES NOT DO. docs/access-matrix.md §3.3 reads
-- "Programme builder | VEC | V | V | VEC | V", which would take gym authorship
-- away from the coach entirely. An earlier draft of this migration did exactly
-- that and broke eleven assertions in the tenancy suite, all of them a coach
-- doing something a coach does today. That grid is a design rather than a
-- description of the built product, and it says so about itself: "the code has
-- four roles, not five". Removing an ability somebody uses, on the strength of
-- a cell in a document written to describe where the product is going, is a
-- decision to put to a person. docs/spec-gaps.md G-33.
--
-- Same generation technique as 0065 and 0066: each policy is its own installed
-- definition read back from pg_policies, with exactly one gym substitution and
-- one rehab substitution, both asserted at generation time. The USING clause of
-- each update policy is carried through untouched.
-- ---------------------------------------------------------------------------

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
  WHERE ((pe.id = exercise_overrides.programme_exercise_id) AND (p.org_id = auth_org_id()) AND (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

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
  WHERE ((pe.id = exercise_overrides.programme_exercise_id) AND (p.org_id = auth_org_id()) AND (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programmes_update on public.programmes;
create policy programmes_update on public.programmes
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (programme_type = 'rehab'::programme_type)))));

drop policy if exists programmes_write on public.programmes;
create policy programmes_write on public.programmes
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (programme_type = 'rehab'::programme_type)))));

drop policy if exists programme_blocks_update on public.programme_blocks;
create policy programme_blocks_update on public.programme_blocks
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_blocks.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_blocks_write on public.programme_blocks;
create policy programme_blocks_write on public.programme_blocks
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_blocks.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_sessions_update on public.programme_sessions;
create policy programme_sessions_update on public.programme_sessions
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (programme_blocks b
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((b.id = programme_sessions.block_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_sessions_write on public.programme_sessions;
create policy programme_sessions_write on public.programme_sessions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM (programme_blocks b
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((b.id = programme_sessions.block_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

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
  WHERE ((s.id = programme_exercises.programme_session_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_exercises_write on public.programme_exercises;
create policy programme_exercises_write on public.programme_exercises
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM ((programme_sessions s
     JOIN programme_blocks b ON ((b.id = s.block_id)))
     JOIN programmes p ON ((p.id = b.programme_id)))
  WHERE ((s.id = programme_exercises.programme_session_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_assignments_update on public.programme_assignments;
create policy programme_assignments_update on public.programme_assignments
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])))
  with check (((org_id = auth_org_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_assignments.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));

drop policy if exists programme_assignments_write on public.programme_assignments;
create policy programme_assignments_write on public.programme_assignments
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND (assigned_by = auth_user_id()) AND (EXISTS ( SELECT 1
   FROM programmes p
  WHERE ((p.id = programme_assignments.programme_id) AND (p.org_id = auth_org_id()) AND ((auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'strength_conditioning'::app_role]) AND (p.programme_type <> 'rehab'::programme_type)) OR (auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (p.programme_type = 'rehab'::programme_type))))))));