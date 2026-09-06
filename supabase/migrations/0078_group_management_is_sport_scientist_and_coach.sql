-- Creating, editing and archiving a squad group narrows to the sport scientist
-- and the coach.
--
-- The specification confirms this as a firm decision on screens 55, 56 and 57:
-- "only sport scientist and coach may create, edit, or delete a group. Medic,
-- S&C and nutritionist stay view only." It was enforced in neither place.
-- /settings/groups/new and /settings/groups/[groupId] had no role check at all,
-- only requireStaff(); and these two policies admitted the medic, so the
-- database would not have caught what the screens let through.
--
-- THIS NARROWS THE MEDIC on both counts. That role can create and rename a
-- group today and cannot after this. Nothing else changes.
--
-- DELETE IS ARCHIVE, WHICH IS AN UPDATE. There is no DELETE policy on this table
-- and none is added: archiveGroup sets archived_at, so "delete" in the decision
-- is already covered by narrowing UPDATE. A group is retired, not erased, which
-- is the same shape as every other soft-deleted record in this schema.
--
-- SELECT IS UNTOUCHED, deliberately. groups_org_select carries no role list at
-- all, so every member of the organisation reads the group structure. "View
-- only" is exactly what the three excluded roles keep, and they need it: group
-- filters appear on the squad, nutrition, flags and report screens.
--
-- GROUP MEMBERSHIP IS NOT TOUCHED, and it is worth saying why since it looks
-- adjacent. group_memberships' own policies carry a rehab carve-out -- the medic
-- may write membership for any group, the coach and sport scientist for any
-- group that is not a rehab group -- which is a deliberate rule about allocation
-- rather than about who owns the squad's structure. It predates this decision,
-- the decision does not mention it, and folding it in here would be deciding
-- something nobody asked for.

drop policy if exists groups_staff_insert on public.groups;
create policy groups_staff_insert on public.groups
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])
  );

drop policy if exists groups_staff_update on public.groups;
create policy groups_staff_update on public.groups
  for update to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY['sport_scientist'::app_role, 'coach'::app_role])
  )
  with check (org_id = auth_org_id());
