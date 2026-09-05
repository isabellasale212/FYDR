-- ---------------------------------------------------------------------------
-- 0068: the policies that name a single role, one at a time.
--
-- 0066 handled the 70 where array['coach','medic'] meant "any staff", and 0067
-- the twelve where coach and medic meant two different jobs. What is left names
-- ONE role, and there is no mechanical rule for those: each is its own row in
-- docs/access-matrix.md §3. So this is a hand-written map and every entry cites
-- the row it comes from.
--
-- EVERY CHANGE HERE IS A WIDENING. Nobody loses a write they have today. The
-- sport scientist joins each set, because §1 gives that role everything; the
-- S&C joins rehab grouping and threshold reading; the nutritionist joins the
-- nutrition tables that are the reason the role exists.
--
--   injuries_medical_insert -> injuries_staff_insert. §3.2 has two rows for
--     what looks like one thing: "Injuries list | V | VP | VECD | VP | X" keeps
--     edit and delete with the medic alone, but "New injury | VC | VC | VC | VC
--     | X" gives all four roles the create. This policy only creates. The
--     update policy is untouched and stays medic-only.
--
--   nutrition_targets and nutrition_rules keep BOTH their write paths. The
--     coach path gains the sport scientist and the nutritionist; the medic path
--     gains the sport scientist. They are not redundant: the medic path is
--     scoped to personal targets and the coach path is not, and collapsing them
--     would quietly widen the medic from one to the other.
--
--   thresholds: writing gains the sport scientist, reading widens from the
--     coach alone to the medic and the S&C, which is §3.6's V column. The
--     nutritionist stays out, which is that row's X.
--
-- POLICIES ARE RENAMED where the role in the name is no longer the only role in
-- the expression. A policy called thresholds_coach_select that also admits the
-- medic and the S&C is a trap for whoever reads it next.
--
-- NOT TOUCHED, deliberately:
--   injury_clinical.clinical_medical_only  §4.1, the one boundary stronger than
--     the rest of the matrix. Medic only, enforced in the database, and no role
--     setting opens it.
--   availability_medical_insert/update     §4.4, "a medic decides whether an
--     athlete is available".
--   problem_reports, problem_report_notes, sar_clinical_reviews  clinical
--     triage, medic only.
--   leaderboard_opt_outs_medical_insert    a medical suppression must stay
--     indistinguishable from a self opt-out, per 0016's own comment.
--
-- Generated as 0065 to 0067 were: each policy is its own installed definition
-- with exactly one role array replaced, asserted at generation time.
-- ---------------------------------------------------------------------------

drop policy if exists injuries_medical_insert on public.injuries;
create policy injuries_staff_insert on public.injuries
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists rehab_assignments_medical_insert on public.rehab_assignments;
create policy rehab_assignments_medical_insert on public.rehab_assignments
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role]) AND (set_by = auth_user_id())));

drop policy if exists rehab_assignments_medical_update on public.rehab_assignments;
create policy rehab_assignments_medical_update on public.rehab_assignments
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists team_allocations_coach_insert on public.team_allocations;
create policy team_allocations_coach_insert on public.team_allocations
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists team_allocations_coach_update on public.team_allocations;
create policy team_allocations_coach_update on public.team_allocations
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists availability_coach_insert_noninjury on public.availability;
create policy availability_coach_insert_noninjury on public.availability
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role]) AND (set_by = auth_user_id()) AND (injury_id IS NULL) AND (reason_category IS NOT NULL) AND (reason_category IS DISTINCT FROM 'injury'::availability_reason)));

drop policy if exists availability_coach_update_noninjury on public.availability;
create policy availability_coach_update_noninjury on public.availability
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role]) AND (injury_id IS NULL) AND (reason_category IS DISTINCT FROM 'injury'::availability_reason)))
  with check (((org_id = auth_org_id()) AND (injury_id IS NULL) AND (reason_category IS DISTINCT FROM 'injury'::availability_reason)));

drop policy if exists thresholds_coach_insert on public.thresholds;
create policy thresholds_coach_insert on public.thresholds
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])));

drop policy if exists thresholds_coach_update on public.thresholds;
create policy thresholds_coach_update on public.thresholds
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists thresholds_coach_select on public.thresholds;
create policy thresholds_staff_select on public.thresholds
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists threshold_revisions_coach_insert on public.threshold_revisions;
create policy threshold_revisions_coach_insert on public.threshold_revisions
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role]) AND (changed_by = auth_user_id())));

drop policy if exists threshold_revisions_coach_select on public.threshold_revisions;
create policy threshold_revisions_staff_select on public.threshold_revisions
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role])));

drop policy if exists nutrition_targets_coach_insert on public.nutrition_targets;
create policy nutrition_targets_coach_insert on public.nutrition_targets
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role]) AND (created_by = auth_user_id())));

drop policy if exists nutrition_targets_coach_update on public.nutrition_targets;
create policy nutrition_targets_coach_update on public.nutrition_targets
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_rules_coach_insert on public.nutrition_rules;
create policy nutrition_rules_coach_insert on public.nutrition_rules
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role]) AND (created_by = auth_user_id())));

drop policy if exists nutrition_rules_coach_update on public.nutrition_rules;
create policy nutrition_rules_coach_update on public.nutrition_rules
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_targets_medical_insert on public.nutrition_targets;
create policy nutrition_targets_medical_insert on public.nutrition_targets
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (created_by = auth_user_id()) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.athlete_id = nutrition_targets.athlete_id) AND (i.org_id = auth_org_id()) AND (i.status <> 'closed'::injury_status))))));

drop policy if exists nutrition_targets_medical_update on public.nutrition_targets;
create policy nutrition_targets_medical_update on public.nutrition_targets
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.athlete_id = nutrition_targets.athlete_id) AND (i.org_id = auth_org_id()) AND (i.status <> 'closed'::injury_status))))))
  with check ((org_id = auth_org_id()));

drop policy if exists nutrition_rules_medical_insert on public.nutrition_rules;
create policy nutrition_rules_medical_insert on public.nutrition_rules
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (created_by = auth_user_id()) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.athlete_id = nutrition_rules.athlete_id) AND (i.org_id = auth_org_id()) AND (i.status <> 'closed'::injury_status))))));

drop policy if exists nutrition_rules_medical_update on public.nutrition_rules;
create policy nutrition_rules_medical_update on public.nutrition_rules
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'medic'::app_role]) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM injuries i
  WHERE ((i.athlete_id = nutrition_rules.athlete_id) AND (i.org_id = auth_org_id()) AND (i.status <> 'closed'::injury_status))))))
  with check ((org_id = auth_org_id()));

drop policy if exists meal_library_coach_insert on public.meal_library;
create policy meal_library_coach_insert on public.meal_library
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role]) AND (created_by = auth_user_id())));

drop policy if exists meal_library_coach_update on public.meal_library;
create policy meal_library_coach_update on public.meal_library
  as permissive
  for update
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role])))
  with check ((org_id = auth_org_id()));

drop policy if exists meal_library_items_coach_insert on public.meal_library_items;
create policy meal_library_items_coach_insert on public.meal_library_items
  as permissive
  for insert
  to authenticated
  with check (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'nutritionist'::app_role]) AND (EXISTS ( SELECT 1
   FROM meal_library m
  WHERE ((m.id = meal_library_items.meal_id) AND (m.org_id = auth_org_id()) AND (m.deleted_at IS NULL))))));