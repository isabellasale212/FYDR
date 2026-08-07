-- 0012_rls_policies.sql
--
-- What this does
--   Enables row level security on every table created by 0002 to 0008, sets the table
--   privileges the policies then narrow, and writes the policies themselves.
--
-- Which spec sections this implements
--   04-data-model.md §14 (the RLS pattern, the clinical detail policy)
--   04-data-model.md §17.12, §17.13, §17.15 (policies for the newer tables)
--   01-roles-and-permissions.md §2 (the permission matrix, which is normative)
--   01-roles-and-permissions.md §4 (medical data handling)
--   01-roles-and-permissions.md §6 (cross organisation isolation: absolute)
--   CONTRACT.md rules 1 to 4
--
-- Reading the matrix, 01-roles-and-permissions.md §2
--   Y full access · A aggregate or availability level only · S own data only · no access
--
--   Admin is the surprising one and it is deliberate. An admin manages the organisation
--   and has LESS data access than staff by default: no wellness, no nutrition, no gym, no
--   GPS, no medical detail. The club chairman does not need to read a player's sleep
--   scores. An admin who also needs squad data holds the coach role as well, which makes
--   data access an explicit grant rather than a side effect of paying the invoice.
--
-- The four properties every policy in this file has
--   1. It opens with org_id = auth_org_id(). There is no legitimate cross organisation
--      read in Fydr (01 §6), so no policy omits it, including on tables an athlete can
--      only ever see one row of anyway.
--   2. Roles come from auth_has_any_role, which reads the JWT claim. No policy queries
--      user_roles: that recurses and destroys query planning (04 §14).
--   3. Entry tables get no update policy and no delete policy, for anyone. Corrections are
--      new rows (ADR-005) and athlete data is never hard deleted (CLAUDE.md rule 4).
--   4. Where a rule is "this role cannot", the policy has no clause for that role at all,
--      rather than a clause with a negative condition in it. A missing clause cannot be
--      accidentally loosened by a later edit to a boolean.

-- ===========================================================================
-- 0. Privileges
--
-- RLS narrows what a role can see. It does not grant anything. anon gets nothing at all;
-- an unauthenticated caller has no business reading club data. service_role bypasses RLS
-- and is used only by scheduled jobs, each of which filters org_id itself
-- (05-architecture.md §5 service role rules).
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
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- audit_log has a bigserial primary key, so service_role needs the sequence too.
grant usage, select on sequence public.audit_log_id_seq to service_role;
grant usage, select on sequence public.audit_log_id_seq to authenticated;


-- ===========================================================================
-- 1. organisations
--
-- Matrix: "Manage org settings" admin only. Every role reads its own organisation,
-- because the timezone, the sport and the tier drive rendering on every screen.
-- ===========================================================================

grant select, update on public.organisations to authenticated;

create policy organisations_member_select on public.organisations for select
  to authenticated
  using (id = auth_org_id());

-- Rule: "Manage organisation settings: name, timezone, sport, season dates, branding" is
-- admin only. 01-roles-and-permissions.md §1 and §2.
create policy organisations_admin_update on public.organisations for update
  to authenticated
  using (id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]))
  with check (id = auth_org_id());

-- No insert and no delete policy. An organisation is created by the platform, not by a
-- tenant, and is never deleted by one.


-- ===========================================================================
-- 2. users
--
-- Everyone in an organisation may read the staff and squad directory: an availability row
-- says "set by", a flag says "acknowledged by", and a name with no row behind it renders
-- as a uuid. It carries no performance data.
-- Matrix: "Invite/manage users" admin only.
-- ===========================================================================

grant select, insert, update on public.users to authenticated;

create policy users_org_select on public.users for select
  to authenticated
  using (org_id = auth_org_id());

-- Rule: admins invite, deactivate and reassign. No other role creates a user.
create policy users_admin_insert on public.users for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

create policy users_admin_update on public.users for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]))
  with check (org_id = auth_org_id());

-- Rule: "Edit their own profile: name, contact details, notification preferences" is
-- something every role can do for their own account. 01-roles-and-permissions.md §1.
create policy users_self_update on public.users for update
  to authenticated
  using (org_id = auth_org_id() and id = auth_user_id())
  with check (org_id = auth_org_id() and id = auth_user_id());

-- No delete policy. CLAUDE.md rule 4: deactivation sets status, it does not remove a row.


-- ===========================================================================
-- 3. user_roles
--
-- Matrix: "Invite/manage users" is admin only, and a role grant is the sharpest form of
-- it. Everyone reads their own roles so a client can render without a second round trip;
-- staff read the organisation's grants so a coach can see who the physio is.
-- Every write here bumps users.claims_version (0010) and is a mandatory audit event.
-- ===========================================================================

grant select, insert, update, delete on public.user_roles to authenticated;

create policy user_roles_self_select on public.user_roles for select
  to authenticated
  using (org_id = auth_org_id() and user_id = auth_user_id());

create policy user_roles_staff_select on public.user_roles for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]));

create policy user_roles_admin_insert on public.user_roles for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

create policy user_roles_admin_update on public.user_roles for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]))
  with check (org_id = auth_org_id());

-- The one delete in the schema, and it is deliberate: a revoked role must stop existing,
-- not linger with an end date that a policy might forget to check. Role removal also
-- forces sign out through the admin-set-role Edge Function (05-architecture.md §5).
create policy user_roles_admin_delete on public.user_roles for delete
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));


-- ===========================================================================
-- 4. athletes
--
-- Matrix: admin manages "groups and squad structure", coach manages the squad. Medical
-- reads for context and does not edit the roster. An athlete reads their own row.
-- ===========================================================================

grant select, insert, update on public.athletes to authenticated;

create policy athletes_staff_select on public.athletes for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]));

create policy athletes_self_select on public.athletes for select
  to authenticated
  using (org_id = auth_org_id() and id = auth_athlete_id());

create policy athletes_manage_insert on public.athletes for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','admin']::app_role[]));

create policy athletes_manage_update on public.athletes for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','admin']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy. Erasure is an explicit audited admin process run with service_role,
-- not a row a client can remove. CLAUDE.md rule 4.


-- ===========================================================================
-- 5. athlete_consents, gap G-11
--
-- A consent is the athlete's, so the athlete grants and withdraws it. An admin reads and
-- records because "configure data retention and run erasure requests" is theirs, and
-- because a club that requires parental involvement records it through an admin.
-- Coach and medical get nothing: a consent state is not performance data and knowing that
-- an athlete declined HealthKit sync tells a coach nothing they are entitled to act on.
-- ===========================================================================

grant select, insert, update on public.athlete_consents to authenticated;

create policy athlete_consents_self_select on public.athlete_consents for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy athlete_consents_admin_select on public.athlete_consents for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

create policy athlete_consents_self_insert on public.athlete_consents for insert
  to authenticated
  with check (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy athlete_consents_self_update on public.athlete_consents for update
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id())
  with check (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy athlete_consents_admin_write on public.athlete_consents for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

create policy athlete_consents_admin_update on public.athlete_consents for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]))
  with check (org_id = auth_org_id());


-- ===========================================================================
-- 6. groups and group_memberships
--
-- Matrix "Manage groups": no · Y · Y · Y. Groups filter views, they do not restrict
-- access (01 §5), so reading the list of group names is harmless and an athlete needs it
-- to know they are in the Rehab group.
-- ===========================================================================

grant select, insert, update on public.groups to authenticated;

create policy groups_org_select on public.groups for select
  to authenticated
  using (org_id = auth_org_id());

create policy groups_staff_insert on public.groups for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical','admin']::app_role[]));

create policy groups_staff_update on public.groups for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.group_memberships to authenticated;

create policy group_memberships_staff_select on public.group_memberships for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]));

-- An athlete sees which groups they are in and no one else's membership. The squad list
-- is a staff surface.
create policy group_memberships_self_select on public.group_memberships for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy group_memberships_staff_insert on public.group_memberships for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical','admin']::app_role[]));

-- Update rather than delete: membership is history preserving, so leaving a group sets
-- removed_at. 04-data-model.md §3.
create policy group_memberships_staff_update on public.group_memberships for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]))
  with check (org_id = auth_org_id());


-- ===========================================================================
-- 7. Schedule: seasons, fixtures, sessions, participants, attendance, templates
--
-- Matrix "Create/edit schedule and sessions": no · Y · Y · no.
-- Athletes read the schedule because it is their week. They write none of it.
-- ===========================================================================

grant select, insert, update on public.seasons to authenticated;

create policy seasons_org_select on public.seasons for select
  to authenticated
  using (org_id = auth_org_id());

create policy seasons_staff_insert on public.seasons for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical','admin']::app_role[]));

create policy seasons_staff_update on public.seasons for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.fixtures to authenticated;

create policy fixtures_org_select on public.fixtures for select
  to authenticated
  using (org_id = auth_org_id());

create policy fixtures_staff_insert on public.fixtures for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

create policy fixtures_staff_update on public.fixtures for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.sessions to authenticated;

create policy sessions_org_select on public.sessions for select
  to authenticated
  using (org_id = auth_org_id());

create policy sessions_staff_insert on public.sessions for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

create policy sessions_staff_update on public.sessions for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update, delete on public.session_participants to authenticated;

create policy session_participants_staff_select on public.session_participants for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]));

-- An athlete sees a participation row that names them, or one that names a group they are
-- currently in. The group_memberships subquery is safe here: that table's policies do not
-- reference session_participants, so there is no recursion, and it never touches
-- user_roles, so rule 2 at the top of this file holds.
create policy session_participants_self_select on public.session_participants for select
  to authenticated
  using (
    org_id = auth_org_id()
    and (
      athlete_id = auth_athlete_id()
      or group_id in (
        select gm.group_id from public.group_memberships gm
        where gm.athlete_id = auth_athlete_id()
          and gm.removed_at is null
      )
    )
  );

create policy session_participants_staff_insert on public.session_participants for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

-- Unassigning an athlete from a session is a delete rather than a soft delete: a
-- participation row is a plan, not athlete submitted data, so CLAUDE.md rule 4 is not
-- engaged. The attendance record of what actually happened is a different table.
create policy session_participants_staff_delete on public.session_participants for delete
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

grant select, insert, update on public.session_attendance to authenticated;

create policy session_attendance_staff_select on public.session_attendance for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy session_attendance_self_select on public.session_attendance for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy session_attendance_staff_insert on public.session_attendance for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

create policy session_attendance_staff_update on public.session_attendance for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.week_templates to authenticated;

-- A week template is a planning artefact. Athletes have no reason to read one and it is
-- not on any athlete route in 20-route-map.md §2.2.
create policy week_templates_staff_select on public.week_templates for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy week_templates_staff_insert on public.week_templates for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

create policy week_templates_staff_update on public.week_templates for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());


-- ===========================================================================
-- 8. teams and team_allocations, 04-data-model.md §17.13
--
-- Three properties a reviewer must check, from §17.13:
--   1. No athlete readable path to another athlete's allocation, published or not.
--   2. medical cannot insert. Allocation is a coaching decision; medical's power over it
--      is availability, which they already own.
--   3. override_reason is coach authored, coach visible, and never a clinical field.
-- ===========================================================================

grant select, insert, update on public.teams to authenticated;

create policy teams_staff_select on public.teams for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical','admin']::app_role[]));

-- An athlete reads the teams referenced by their own published allocations, and their own
-- default team. Not the full team list: which teams a club runs is squad structure.
create policy teams_athlete_select on public.teams for select
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_athlete_id() is not null
    and (
      id in (select a.default_team_id from public.athletes a
             where a.id = auth_athlete_id())
      or id in (select ta.team_id from public.team_allocations ta
                where ta.athlete_id = auth_athlete_id()
                  and ta.status = 'published'
                  and ta.deleted_at is null)
    )
  );

-- Squad structure. Admin manages it without gaining any performance data, which is
-- exactly the split in 01-roles-and-permissions.md §1. Not medical.
create policy teams_manage_insert on public.teams for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','admin']::app_role[]));

create policy teams_manage_update on public.teams for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','admin']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.team_allocations to authenticated;

create policy team_allocations_staff_select on public.team_allocations for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- An athlete must never read a draft row. A coach half way through picking sides is not
-- communicating a decision. Whether an athlete may see the whole published team list is a
-- product decision and is O-804, so the default here is their own row only.
create policy team_allocations_self_select on public.team_allocations for select
  to authenticated
  using (org_id = auth_org_id()
         and athlete_id = auth_athlete_id()
         and status = 'published'
         and deleted_at is null);

-- coach only. medical has read access for context and cannot allocate.
create policy team_allocations_coach_insert on public.team_allocations for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach']::app_role[]));

create policy team_allocations_coach_update on public.team_allocations for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy at all. Withdrawal sets status = 'withdrawn' and supersession sets
-- superseded_by. 04-data-model.md §17.13 states this explicitly.


-- ===========================================================================
-- 9. wellness_entries, 04-data-model.md §14 and §5
--
-- Matrix: "View other athletes' wellness" no · Y · Y · no. Admin gets nothing.
-- ===========================================================================

-- Note the grant: select and insert only. No update privilege is granted to authenticated
-- on any entry table, so even a policy added by mistake could not enable an in place edit.
grant select, insert on public.wellness_entries to authenticated;

create policy wellness_athlete_select on public.wellness_entries for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy wellness_staff_select on public.wellness_entries for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- Athletes insert only for themselves, only self_report. athlete_id = auth_athlete_id()
-- is the whole submit for someone else defence: a client that posts another athlete's id
-- is rejected by the database, not by a handler. source = 'self_report' stops an athlete
-- laundering their own entry as a staff observation.
create policy wellness_athlete_insert on public.wellness_entries for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and source = 'self_report'
    and created_by = auth_user_id()
  );

-- Coaches and medical may record on an athlete's behalf, and that row is stamped
-- staff_entered so it is distinguishable in analysis and in an export.
-- 01-roles-and-permissions.md §1: "Enter data on behalf of an athlete, recorded with
-- provenance staff_entered".
create policy wellness_staff_insert on public.wellness_entries for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach','medical']::app_role[])
    and source = 'staff_entered'
    and created_by = auth_user_id()
  );

-- NO UPDATE POLICY. NO DELETE POLICY. For any role, deliberately.
-- ADR-005: a correction inserts a revision row through revise_wellness_entry, which is the
-- only thing in the database permitted to stamp superseded_by.


-- ===========================================================================
-- 10. training_entries
-- ===========================================================================

grant select, insert on public.training_entries to authenticated;

create policy training_athlete_select on public.training_entries for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy training_staff_select on public.training_entries for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy training_athlete_insert on public.training_entries for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and source = 'self_report'
    and created_by = auth_user_id()
  );

create policy training_staff_insert on public.training_entries for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach','medical']::app_role[])
    and source = 'staff_entered'
    and created_by = auth_user_id()
  );

-- NO UPDATE POLICY. NO DELETE POLICY.


-- ===========================================================================
-- 11. nutrition_checkins, 04-data-model.md §17.15
--
-- The one entry table with NO staff insert path, deliberately. A coach guessing whether a
-- player hit their protein target is not a self report, and a variable that mixes the two
-- is worse than a variable with gaps in it.
--
-- The three week window is enforced on WRITE, not filtered on read: a row outside the
-- window must not exist, rather than exist and be hidden. It cannot be a check constraint
-- because it depends on now(), and check constraints must be immutable.
--
-- admin has no access, matching 01-roles-and-permissions.md §1 for athlete submitted data.
-- ===========================================================================

grant select, insert on public.nutrition_checkins to authenticated;

create policy nutrition_checkins_athlete_select on public.nutrition_checkins for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy nutrition_checkins_staff_select on public.nutrition_checkins for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy nutrition_checkins_athlete_insert on public.nutrition_checkins for insert
  to authenticated
  with check (
    org_id     = auth_org_id()
    and athlete_id = auth_athlete_id()
    and source     = 'self_report'
    and created_by = auth_user_id()
    and week_start = date_trunc('week', week_start)::date
    -- Never for a future week.
    and week_start <= date_trunc('week', (now() at time zone auth_org_timezone()))::date
    -- The ISO week just ended and the two before it. ADR-004 caps backdating at 14 days
    -- (O-27); three ISO weeks is the same bound expressed at weekly grain.
    and week_start >= date_trunc('week', (now() at time zone auth_org_timezone()))::date
                      - interval '14 days'
  );

-- NO UPDATE POLICY. NO DELETE POLICY. NO STAFF INSERT POLICY.


-- ===========================================================================
-- 12. injuries
--
-- Matrix "View injury, availability level": S · Y · Y · A. Admin's A is an aggregate
-- count delivered by a function, never a row, so admin gets no select policy here.
-- Matrix "Create/edit injury record": no · no · Y · no. Medical only, and that includes
-- coaches: a coach cannot open an injury record even for an injury they watched happen.
-- ===========================================================================

grant select, insert, update on public.injuries to authenticated;

create policy injuries_staff_select on public.injuries for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy injuries_self_select on public.injuries for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy injuries_medical_insert on public.injuries for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['medical']::app_role[]));

create policy injuries_medical_update on public.injuries for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['medical']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy. An injury is closed, never deleted. 01-roles-and-permissions.md §1.


-- ===========================================================================
-- 13. injury_clinical, THE ONE TO GET RIGHT
--
-- CONTRACT.md rule 3: clinical detail lives here and is medical only. Coaches never join
-- to it. 01-roles-and-permissions.md §4: coaching staff see what an athlete can do,
-- medical staff see why.
--
-- ONE POLICY. FOR ALL. MEDICAL ONLY.
--
-- There is deliberately no athlete select policy, which is a considered departure from the
-- sketch in 04-data-model.md §14 and is explained in full on
-- injury_clinical_athlete_view in 0010. In short: coach, medical, athlete and admin all
-- connect as the single database role authenticated, so column privileges cannot separate
-- them, and an athlete select policy on this table would expose clinical_notes through a
-- plain PostgREST select. The athlete's path is the view, which excludes that column.
--
-- The privilege grant matters as much as the policy. authenticated gets select, insert and
-- update because a physio is an authenticated user; the policy is what limits that to
-- physios. The view in 0010 is owner rights, so it does not depend on this grant.
-- ===========================================================================

grant select, insert, update on public.injury_clinical to authenticated;

create policy clinical_medical_only on public.injury_clinical for all
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['medical']::app_role[]))
  with check (org_id = auth_org_id() and auth_has_any_role(array['medical']::app_role[]));

-- No delete policy. A clinical record is closed with its injury, never removed.


-- ===========================================================================
-- 14. availability
--
-- 01-roles-and-permissions.md §2 and §4: "Set availability status: no · no · Y · no".
-- Medical is the ONLY role that can create or change an availability row. Coaches read it
-- and act on it, which is the entire point of the coach and medical split.
--
-- There is no coach insert policy on this table. Not a restricted one, not one gated on a
-- column: none. A reviewer looking for a way a coach could write here should find nothing
-- to read.
-- ===========================================================================

grant select, insert, update on public.availability to authenticated;

create policy availability_staff_select on public.availability for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- An athlete sees their own availability status and any restrictions placed on them, and
-- cannot modify it. 01-roles-and-permissions.md §1.
create policy availability_self_select on public.availability for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy availability_medical_insert on public.availability for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['medical']::app_role[])
              and set_by = auth_user_id());

-- Update exists only to close an interval by setting effective_to. Medical only, for the
-- same reason as insert.
create policy availability_medical_update on public.availability for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['medical']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy.


-- ===========================================================================
-- 15. thresholds and threshold_revisions
--
-- Matrix "Set thresholds": no · Y · no · no. Coach only, and 04-data-model.md §17.12
-- repeats it: "medical has no threshold access per the matrix". That is recorded as open
-- questions O-53, O-366 and O-392 and until one of them is resolved the matrix governs.
-- ===========================================================================

grant select, insert, update on public.thresholds to authenticated;

create policy thresholds_coach_select on public.thresholds for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]));

create policy thresholds_coach_insert on public.thresholds for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]));

create policy thresholds_coach_update on public.thresholds for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert on public.threshold_revisions to authenticated;

create policy threshold_revisions_coach_select on public.threshold_revisions for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]));

-- Append only in practice: a revision records what a rule used to be, so editing one
-- would defeat the reason the table exists. No update policy, no delete policy.
create policy threshold_revisions_coach_insert on public.threshold_revisions for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach']::app_role[])
              and changed_by = auth_user_id());


-- ===========================================================================
-- 16. flags and flag_actions
--
-- Matrix "View flags": S · Y · Y · no. "Acknowledge/resolve flags": no · Y · Y · no.
--
-- Carve out 2, 01-roles-and-permissions.md §3: a flag raised on an athlete is visible to
-- that athlete AFTER a staff member has acknowledged it, not at the moment it fires. An
-- athlete should learn "your sleep has dropped for four days, we have adjusted your load"
-- from a coach, not from a red badge at 06:00. That is the athlete_visible_at predicate
-- below, and it lives in the database rather than in a client filter because a client
-- filter is one forgotten where clause away from a 6am notification.
-- O-2 asks whether this should be configurable per organisation. Delayed visibility is
-- the default until it is answered.
-- ===========================================================================

grant select, insert, update on public.flags to authenticated;

create policy flags_staff_select on public.flags for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy flags_self_select on public.flags for select
  to authenticated
  using (org_id = auth_org_id()
         and athlete_id = auth_athlete_id()
         and athlete_visible_at is not null);

-- Flags are normally raised by the per entry evaluator running as service_role
-- (05-architecture.md §7). Staff insert exists for a manually raised concern.
create policy flags_staff_insert on public.flags for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

create policy flags_staff_update on public.flags for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert on public.flag_actions to authenticated;

create policy flag_actions_staff_select on public.flag_actions for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- An action is a record of what a human did. It is never edited and never deleted, so
-- there is no update or delete policy. A mistaken action is followed by another action.
create policy flag_actions_staff_insert on public.flag_actions for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[])
              and taken_by = auth_user_id());


-- ===========================================================================
-- 17. compliance_expectations
--
-- Generated nightly by a job running as service_role. Staff read and waive; an athlete
-- reads their own so the app can say "you still owe an RPE for last night".
-- ===========================================================================

grant select, insert, update on public.compliance_expectations to authenticated;

create policy compliance_staff_select on public.compliance_expectations for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy compliance_self_select on public.compliance_expectations for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy compliance_staff_insert on public.compliance_expectations for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[]));

-- Waiving is an update: an expectation is waived with a reason rather than deleted, so
-- the denominator keeps telling the truth about what was asked of the athlete.
create policy compliance_staff_update on public.compliance_expectations for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());


-- ===========================================================================
-- 18. audit_log
--
-- Matrix "View audit log": no · no · no · Y. Admin only, and only their own organisation.
--
-- INSERT ONLY. No role gets update or delete: not admin, not medical, not service_role
-- through a policy. The privileges below grant insert and select and nothing else, the
-- policies below cover insert and select and nothing else, and the trigger in 0007 refuses
-- an update or a delete even if both of those were changed.
-- ===========================================================================

grant select, insert on public.audit_log to authenticated;

create policy audit_admin_select on public.audit_log for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

-- Any authenticated user may write an audit row, but only for their own organisation and
-- only as themselves. A read of injury_clinical writes one, and the physio doing the
-- reading is the actor. Falsifying the actor is what the two predicates prevent.
create policy audit_authenticated_insert on public.audit_log for insert
  to authenticated
  with check (org_id = auth_org_id() and actor_id = auth_user_id());

-- NO UPDATE POLICY. NO DELETE POLICY. Not for any role. 04-data-model.md §13.


-- ===========================================================================
-- 19. notification_preferences and push_tokens
--
-- A user reads and writes only their own. 08-notifications.md §12: "RLS: a user reads only
-- their own notification_preferences, push_tokens". No staff role reads another user's
-- notification settings: whether a coach has muted the flag digest is between the coach
-- and the app.
-- ===========================================================================

grant select, insert, update, delete on public.notification_preferences to authenticated;

create policy notification_preferences_self on public.notification_preferences for all
  to authenticated
  using (org_id = auth_org_id() and user_id = auth_user_id())
  with check (org_id = auth_org_id() and user_id = auth_user_id());

grant select, insert, update, delete on public.push_tokens to authenticated;

-- shell is written from the resolved claims by the registration function, never from a
-- client field. The policy cannot enforce that; 08-notifications.md §8.2 rule 1 does, and
-- the value is a routing hint that grants nothing either way.
create policy push_tokens_self on public.push_tokens for all
  to authenticated
  using (org_id = auth_org_id() and user_id = auth_user_id())
  with check (org_id = auth_org_id() and user_id = auth_user_id());
