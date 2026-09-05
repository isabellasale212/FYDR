-- ---------------------------------------------------------------------------
-- 0069: the S&C and the nutritionist can see the squad.
--
-- Found by a failing positive control rather than by reading policies: a test
-- asserting that a nutritionist "DOES read the squad, or the role could do no
-- job at all" returned zero athletes.
--
-- 0066 rewrote the policies that named array['coach','medic']. These five name
-- array['coach','medic','sport_scientist'], so it left them alone, and they
-- happen to be the five reads the whole staff app is built on:
--
--     athletes, group_memberships, session_participants, teams, user_roles
--
-- Without them an S&C or a nutritionist signs in to an app with no squad, no
-- groups, no teams and no colleagues. Every screen would render empty and look
-- broken rather than refused. So this is the same restoration 0066 made: both
-- roles held `coach` the day before the migration and read all five then.
--
-- SELECT ONLY, deliberately. The insert and update policies on athletes, teams,
-- groups and seasons keep the role sets they have. §4.3 is explicit that an S&C
-- "cannot edit an athlete's biographical details", and widening a read to make
-- an app usable is a different act from widening a write.
-- ---------------------------------------------------------------------------

drop policy if exists athletes_staff_select on public.athletes;
create policy athletes_staff_select on public.athletes
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists group_memberships_staff_select on public.group_memberships;
create policy group_memberships_staff_select on public.group_memberships
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists session_participants_staff_select on public.session_participants;
create policy session_participants_staff_select on public.session_participants
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists teams_staff_select on public.teams;
create policy teams_staff_select on public.teams
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));

drop policy if exists user_roles_staff_select on public.user_roles;
create policy user_roles_staff_select on public.user_roles
  as permissive
  for select
  to authenticated
  using (((org_id = auth_org_id()) AND auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role, 'medic'::app_role, 'strength_conditioning'::app_role, 'nutritionist'::app_role])));