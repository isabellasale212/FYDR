-- Match participation (Isabella, decision batch 13 September 2026, "The match
-- report, both halves approved"; built 15 September). docs/decisions/scope.md:
-- "A product sold to rugby clubs that cannot say who played is not complete."
--
-- WHAT EXISTED. Nothing recorded who played or for how long: session_attendance
-- is presence at a session (full / modified / absent / excused), team_allocations
-- the week's published selection, gps_records.duration_s the unit's recording
-- time where one was worn (premium). No starters, no bench, no minutes.
--
-- WHAT THIS ADDS. One row per athlete per fixture — the coach's post-match
-- sheet: whether they started or came on (a row without either is "selected,
-- not used"; no row is "not selected"), and minutes played, NULLABLE, because
-- "played, minutes not recorded" must be a state and the report shows it as
-- not recorded, never as zero. Nothing else: no positions, no events, no
-- score — the ruling's "smallest thing that makes the report real and the
-- thing a coach will actually fill in on a Sunday". Availability at kick-off
-- is not stored: the availability ledger already holds it (the row in force
-- at kickoff_at), and the report reads it from there.
--
-- WHO. Read by every staff role and by the athlete for their own row (Article
-- 15: what the club recorded about you). Written by the coach and the sport
-- scientist — SESSION_EDIT, the ruling's own word — through the table under
-- RLS; every insert, update and delete is audited by trigger, 0104's shape.

create table public.match_participation (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id),
  fixture_id   uuid not null references public.fixtures(id),
  athlete_id   uuid not null references public.athletes(id),
  started      boolean not null default false,
  came_on      boolean not null default false,
  -- Null is "not recorded". 0 is a real value (selected, used, no minutes —
  -- a late substitution the referee never waved on), which is why null and 0
  -- are different facts and the report never conflates them.
  minutes      int check (minutes between 0 and 120),
  recorded_by  uuid references public.users(id),
  recorded_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (fixture_id, athlete_id),
  -- Started or came on, never both.
  check (not (started and came_on))
);
comment on table public.match_participation is
  'The coach''s post-match sheet: one row per athlete selected for a fixture — started, came on, minutes (null = not recorded, never zero). No row = not selected. Written by the coach and the sport scientist (SESSION_EDIT); read by every staff role and by the athlete for their own. 0127.';
comment on column public.match_participation.minutes is
  'Minutes played. Null is "not recorded" and the report shows it as such; 0 is a real value.';
create index match_participation_fixture_idx on public.match_participation (fixture_id);
create index match_participation_athlete_idx on public.match_participation (org_id, athlete_id);

create or replace function public.match_participation_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger match_participation_touch
  before update on public.match_participation
  for each row execute function public.match_participation_touch();

-- 0090's default-privilege discipline: nothing by default, then the governed verbs.
revoke all on public.match_participation from public, anon, authenticated;
grant select, insert, update, delete on public.match_participation to authenticated;
grant all on public.match_participation to service_role;

alter table public.match_participation enable row level security;

create policy match_participation_staff_select on public.match_participation
  as permissive
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[])
  );
create policy match_participation_self_select on public.match_participation
  as permissive
  for select
  to authenticated
  using (org_id = public.auth_org_id() and athlete_id = public.auth_athlete_id());
create policy match_participation_editor_insert on public.match_participation
  as permissive
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach']::public.app_role[])
  );
create policy match_participation_editor_update on public.match_participation
  as permissive
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach']::public.app_role[])
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach']::public.app_role[])
  );
create policy match_participation_editor_delete on public.match_participation
  as permissive
  for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach']::public.app_role[])
  );

-- The audit: every change to the sheet, with the actor, in 0104's shape.
create or replace function public.audit_match_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  jsonb;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'INSERT' then
    v_row := to_jsonb(new);
    v_action := 'match_participation.set';
    v_meta := jsonb_build_object('started', new.started, 'came_on', new.came_on, 'minutes', new.minutes);
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    v_action := 'match_participation.set';
    v_meta := jsonb_build_object('started', new.started, 'came_on', new.came_on, 'minutes', new.minutes,
                                 'was', jsonb_build_object('started', old.started, 'came_on', old.came_on, 'minutes', old.minutes));
  else
    v_row := to_jsonb(old);
    v_action := 'match_participation.remove';
    v_meta := jsonb_build_object('was', jsonb_build_object('started', old.started, 'came_on', old.came_on, 'minutes', old.minutes));
  end if;
  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address)
  values (nullif(v_row ->> 'org_id', '')::uuid, public.auth_user_id(), public.audit_acting_role(), v_action, 'fixture',
          nullif(v_row ->> 'fixture_id', '')::uuid, nullif(v_row ->> 'athlete_id', '')::uuid, v_meta, public.audit_client_ip());
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
create trigger match_participation_audit
  after insert or update or delete on public.match_participation
  for each row execute function public.audit_match_participation();
