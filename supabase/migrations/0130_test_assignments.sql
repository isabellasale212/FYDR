-- 0130_test_assignments.sql
--
-- What this does
--   Tests become assignable — decision batch 14 September 2026 (#3, Isabella):
--   "Test assignment gets BUILT, rather than the sentence being reworded. Tests
--   are assignable to both groups and individual athletes. Needs a table
--   linking a test definition to groups and to athletes, an assign control on
--   the definition, and every testing surface scoped by it. The confirmed
--   sentence then reads true as originally written." The sentence
--   (docs/reports-catalogue.md, testing): "an athlete who has never been
--   assigned a test does not appear for it."
--
-- The table: test_assignments
--   One row per (definition → group), (definition → athlete), or
--   (definition → whole squad: neither). Exactly one of the two ids, or
--   neither — never both. A whole-squad row is the club's "not narrowed"
--   state, explicit rather than the absence of rows, so that a definition with
--   NO live row is assigned to NOBODY and the catalogue sentence is literally
--   true. At most one live whole-squad row per definition. Rows are retired
--   with removed_at, never deleted (a test assigned and taken away is a fact
--   about the season).
--
-- Who is assigned a test (test_assigned_athlete_ids)
--   The union over the definition's live rows: a whole-squad row is every
--   live athlete of the organisation who is in data (0120's in_data — the
--   same population every denominator uses; a declined or undecided athlete
--   is asked nothing); a group row is the group's CURRENT members
--   (removed_at is null — evaluated at read time against membership, as
--   thresholds' applies_to_group_id is, so an athlete who leaves the group
--   leaves the assignment); an athlete row is that athlete, if live.
--
-- The athlete's own list (resolve_my_assigned_tests)
--   Athletes have no SELECT on the table (they read their tests, not the
--   club's assignment structure); the function carries 0020's whitelist
--   guard — staff read any athlete of their organisation, an athlete reads
--   themselves, everyone else gets an empty set, never an error.
--
-- Who assigns
--   The roles that define a test: test_definitions_staff_insert's four
--   (sport scientist, coach, medic, S&C). The nutritionist reads nothing here
--   (testing is X for the role). A trigger checks the definition, the group
--   and the athlete all belong to the row's organisation, so a row cannot
--   reach across a tenant by a foreign key alone (CLAUDE.md §2 rule 1).
--
-- Day one
--   Every live definition gets a whole-squad row (backfill_whole_squad_test_
--   assignments, idempotent), and every definition created from now on gets
--   one from a trigger — so nothing a club sees changes until it narrows a
--   test. The log grid, the testing report and the athlete's My data then
--   read the assignment (lib/queries/testing.ts, testingReport.ts).
--
-- Tests: supabase/tests/840_test_assignments_test.sql (written first).

create table public.test_assignments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organisations(id),
  test_definition_id uuid not null references public.test_definitions(id) on delete cascade,
  group_id           uuid references public.groups(id),
  athlete_id         uuid references public.athletes(id),
  created_by         uuid references public.users(id),
  created_at         timestamptz not null default now(),
  removed_at         timestamptz,
  constraint test_assignments_one_target check (group_id is null or athlete_id is null)
);

comment on table public.test_assignments is
  'Which groups and athletes a test is assigned to (0130). A row names a group, an athlete, '
  'or neither — the whole squad. Retired with removed_at, never deleted. A definition with no '
  'live row is assigned to nobody.';
comment on column public.test_assignments.removed_at is
  'Set when the assignment is taken away. Never deleted: a test assigned and removed is a fact.';

create unique index test_assignments_one_whole_squad
  on public.test_assignments (test_definition_id)
  where removed_at is null and group_id is null and athlete_id is null;
create unique index test_assignments_one_group
  on public.test_assignments (test_definition_id, group_id)
  where removed_at is null and group_id is not null;
create unique index test_assignments_one_athlete
  on public.test_assignments (test_definition_id, athlete_id)
  where removed_at is null and athlete_id is not null;
create index test_assignments_definition on public.test_assignments (test_definition_id) where removed_at is null;
create index test_assignments_athlete on public.test_assignments (athlete_id) where removed_at is null and athlete_id is not null;
create index test_assignments_group on public.test_assignments (group_id) where removed_at is null and group_id is not null;

-- ---------------------------------------------------------------------------
-- Same organisation on every side of the row.
-- ---------------------------------------------------------------------------
create or replace function public.test_assignments_same_org()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.test_definitions d where d.id = new.test_definition_id and d.org_id = new.org_id) then
    raise exception 'test_assignments: the test belongs to another organisation' using errcode = 'P0001';
  end if;
  if new.group_id is not null and not exists (select 1 from public.groups g where g.id = new.group_id and g.org_id = new.org_id) then
    raise exception 'test_assignments: the group belongs to another organisation' using errcode = 'P0001';
  end if;
  if new.athlete_id is not null and not exists (select 1 from public.athletes a where a.id = new.athlete_id and a.org_id = new.org_id) then
    raise exception 'test_assignments: the athlete belongs to another organisation' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger test_assignments_same_org
  before insert or update on public.test_assignments
  for each row execute function public.test_assignments_same_org();

-- ---------------------------------------------------------------------------
-- Row level security. Reads for every staff role but the nutritionist (the
-- roles with a V or better on Testing); writes for the four that define a
-- test. No athlete policy: they use resolve_my_assigned_tests.
-- ---------------------------------------------------------------------------
alter table public.test_assignments enable row level security;
-- 0090's default-privilege discipline: the default grant to authenticated is
-- revoked wholesale and the three verbs re-granted by name (no delete: a row
-- is retired with removed_at).
revoke all on public.test_assignments from public, anon, authenticated;
grant select, insert, update on public.test_assignments to authenticated;

create policy test_assignments_staff_select on public.test_assignments
  for select to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning']::app_role[])
  );

create policy test_assignments_staff_insert on public.test_assignments
  for insert to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning']::app_role[])
  );

create policy test_assignments_staff_update on public.test_assignments
  for update to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning']::app_role[])
  )
  with check (org_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- Who a test is assigned to. Not security definer: it reads athletes,
-- groups and memberships under the caller's own policies, so a staff member
-- sees their organisation's answer and an athlete (who has no select on the
-- assignment table) sees nothing through it — their route is the function
-- below.
-- ---------------------------------------------------------------------------
create or replace function public.test_assigned_athlete_ids(p_test_definition_id uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select distinct a.id
  from public.test_assignments ta
  join public.athletes a
    on a.org_id = ta.org_id
   and a.deleted_at is null
   and a.status <> 'left_club'
   and a.in_data
   and (
     (ta.group_id is null and ta.athlete_id is null)
     or (ta.athlete_id = a.id)
     or (ta.group_id is not null and exists (
           select 1 from public.group_memberships gm
           where gm.group_id = ta.group_id and gm.athlete_id = a.id and gm.removed_at is null))
   )
  where ta.test_definition_id = p_test_definition_id
    and ta.removed_at is null;
$$;

comment on function public.test_assigned_athlete_ids(uuid) is
  'The athletes a test is assigned to, now: the union of its live rows — whole squad (every live '
  'athlete in data), each group''s current members, each athlete named. 0130.';

grant execute on function public.test_assigned_athlete_ids(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The athlete's own tests. 0020's whitelist guard: staff read any athlete in
-- their organisation, an athlete reads themselves, nobody else reads anything.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_my_assigned_tests(p_athlete_id uuid)
returns table (test_definition_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[])
     and exists (select 1 from public.athletes a where a.id = p_athlete_id and a.org_id = auth_org_id()) then
    v_athlete := p_athlete_id;
  elsif auth_has_any_role(array['athlete']::app_role[]) and auth_athlete_id() = p_athlete_id then
    v_athlete := p_athlete_id;
  else
    v_athlete := null;
  end if;

  if v_athlete is null then
    return;
  end if;

  return query
  select distinct ta.test_definition_id
  from public.test_assignments ta
  join public.athletes a on a.id = v_athlete and a.org_id = ta.org_id
  join public.test_definitions d on d.id = ta.test_definition_id and d.deleted_at is null
  where ta.removed_at is null
    and a.deleted_at is null
    and a.status <> 'left_club'
    and a.in_data
    and (
      (ta.group_id is null and ta.athlete_id is null)
      or ta.athlete_id = v_athlete
      or (ta.group_id is not null and exists (
            select 1 from public.group_memberships gm
            where gm.group_id = ta.group_id and gm.athlete_id = v_athlete and gm.removed_at is null))
    );
end;
$$;

comment on function public.resolve_my_assigned_tests(uuid) is
  'The tests assigned to one athlete, now. Staff for any athlete of their organisation; an athlete '
  'for themselves; empty for anyone else. 0130.';

revoke execute on function public.resolve_my_assigned_tests(uuid) from public;
revoke execute on function public.resolve_my_assigned_tests(uuid) from anon;
grant execute on function public.resolve_my_assigned_tests(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Day one: a whole-squad row for every live definition that has no live row,
-- and one for every definition created from now on.
-- ---------------------------------------------------------------------------
create or replace function public.backfill_whole_squad_test_assignments()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_inserted integer;
begin
  insert into public.test_assignments (org_id, test_definition_id)
  select d.org_id, d.id
  from public.test_definitions d
  where d.deleted_at is null
    and not exists (select 1 from public.test_assignments ta where ta.test_definition_id = d.id and ta.removed_at is null);
  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.backfill_whole_squad_test_assignments() is
  'A whole-squad assignment for every live definition with no live assignment. Idempotent. '
  'Run once by 0130; kept so a test can prove it. Not for the app.';

revoke execute on function public.backfill_whole_squad_test_assignments() from public;
revoke execute on function public.backfill_whole_squad_test_assignments() from anon;
revoke execute on function public.backfill_whole_squad_test_assignments() from authenticated;

create or replace function public.test_definitions_default_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.test_assignments (org_id, test_definition_id, created_by)
  values (new.org_id, new.id, auth_user_id());
  return new;
end;
$$;

create trigger test_definitions_default_assignment
  after insert on public.test_definitions
  for each row execute function public.test_definitions_default_assignment();

select public.backfill_whole_squad_test_assignments();
