-- PATTERN-S3 C3 (Isabella, 13 September 2026): return-to-play stages as real
-- data rather than a counter inside a string.
--
-- WHAT EXISTED. Nothing. lib/restrictions.ts strips "protocol" and "stage"
-- from every restriction line at read (D1), injuries.status is a four-word
-- enum, and injury_timeline_event records a stage_change only when that enum
-- moves. No stage was numbered, none had criteria, and a coach could read
-- whatever a medic typed into the restriction line before D1.
--
-- WHAT THIS IS. Two tables, both the medic's to write and the athlete's own
-- to read, with NO coach policy — a stage is not reachable from a coach
-- session at the database, which is the S3 rule ("the coach never sees site,
-- protocol or stage") enforced where it counts:
--   injury_protocols      one per injury: how many stages the club's protocol
--                         has for this injury, opened by the medic.
--   injury_stage_events   append-only: every move, from → to, who, when, the
--                         restriction line as rewritten for the new stage,
--                         whether the criteria were reviewed, and a reason
--                         when the move is anything but one stage forward.
-- The current stage is the latest event's to_stage. No invented stage names:
-- the ladder's words are state words (Done, Now, Next, Later, Cleared), and
-- the criteria live in the club's protocol, which the screen says.
--
-- THE RULES, in move_injury_stage(): the medic only; ADVANCING moves exactly
-- one stage and requires a rewritten restriction line (not empty, and not one
-- that names a protocol, a stage or a diagnosis — the same terms
-- lib/restrictions.ts strips) and the criteria-reviewed confirmation; setting
-- ANY OTHER stage (back, or a jump) requires a reason. The move also rewrites
-- the athlete's open availability restriction line, because that line is
-- what the coach and the athlete read — a stage change with the old line
-- left standing is the mistake the board's confirmation exists to prevent.
-- Every move is a timeline event (stage_change) and an audit row.

create table public.injury_protocols (
  injury_id     uuid primary key references public.injuries(id) on delete cascade,
  org_id        uuid not null references public.organisations(id),
  total_stages  int not null check (total_stages between 1 and 12),
  -- Where the athlete is now. 0 = opened, not yet on a stage. Maintained by
  -- move_injury_stage; the events beneath are the ledger of how it got here.
  current_stage int not null default 0 check (current_stage >= 0),
  opened_by     uuid references public.users(id),
  opened_at     timestamptz not null default now(),
  check (current_stage <= total_stages)
);
comment on table public.injury_protocols is
  'PATTERN-S3 C3: the return-to-play protocol for one injury — how many stages the club''s protocol has for it. Opened by the medic; read by the medic and the athlete; never the coach. 0123.';

create table public.injury_stage_events (
  id                uuid primary key default gen_random_uuid(),
  -- The order of moves. moved_at is not enough on its own: two moves in one
  -- transaction share now(), and a uuid is no order at all.
  seq               bigint generated always as identity,
  org_id            uuid not null references public.organisations(id),
  injury_id         uuid not null references public.injuries(id) on delete cascade,
  from_stage        int,
  to_stage          int not null check (to_stage >= 0),
  moved_by          uuid references public.users(id),
  moved_at          timestamptz not null default now(),
  restriction_line  text,
  criteria_reviewed boolean not null default false,
  reason            text
);
comment on table public.injury_stage_events is
  'PATTERN-S3 C3: append-only, one row per stage move. Advancing (to = from + 1) carries the rewritten restriction line and criteria_reviewed; any other move carries a reason. Stage 0 is "protocol opened, not yet on a stage". 0123.';
create index injury_stage_events_injury_idx on public.injury_stage_events (injury_id, seq desc);

alter table public.injury_protocols enable row level security;
alter table public.injury_stage_events enable row level security;
revoke all on public.injury_protocols from public, anon, authenticated;
revoke all on public.injury_stage_events from public, anon, authenticated;
grant select on public.injury_protocols, public.injury_stage_events to authenticated;
grant select, insert, update, delete on public.injury_protocols, public.injury_stage_events to service_role;

-- The medic reads, the athlete reads their own. No coach, no sport
-- scientist, no S&C, no nutritionist: a stage is clinical.
create policy injury_protocols_medic_select on public.injury_protocols for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['medic']::public.app_role[]));
create policy injury_protocols_self_select on public.injury_protocols for select
  to authenticated
  using (org_id = public.auth_org_id() and exists (select 1 from public.injuries i where i.id = injury_id and i.athlete_id = public.auth_athlete_id()));
create policy injury_stage_events_medic_select on public.injury_stage_events for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['medic']::public.app_role[]));
create policy injury_stage_events_self_select on public.injury_stage_events for select
  to authenticated
  using (org_id = public.auth_org_id() and exists (select 1 from public.injuries i where i.id = injury_id and i.athlete_id = public.auth_athlete_id()));

-- The words a restriction line may not carry (lib/restrictions.ts's list).
create or replace function public.restriction_line_is_clean(p_line text)
returns boolean
language sql
immutable
as $$
  select p_line is not null
     and length(btrim(p_line)) > 0
     and p_line !~* '(protocol|stage\s*\d|diagnos|tear|rupture|fracture|sprain|strain|tendin|ligament|acl|mcl|hamstring grade)';
$$;

-- Open a protocol for an injury: the medic, the number of stages the club's
-- protocol has for it. Writes the stage-0 event.
create or replace function public.open_injury_protocol(p_injury_id uuid, p_total_stages int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_injury public.injuries;
begin
  if not public.auth_has_any_role(array['medic']::public.app_role[]) then
    raise exception 'the protocol is the medic''s' using errcode = '42501';
  end if;
  select * into v_injury from public.injuries where id = p_injury_id and org_id = v_org and deleted_at is null;
  if v_injury.id is null then
    raise exception 'no such injury' using errcode = '42501';
  end if;
  if v_injury.status = 'closed' then
    raise exception 'injury_closed' using errcode = 'P0001';
  end if;
  insert into public.injury_protocols (injury_id, org_id, total_stages, opened_by)
  values (p_injury_id, v_org, p_total_stages, public.auth_user_id());
  insert into public.injury_stage_events (org_id, injury_id, from_stage, to_stage, moved_by, criteria_reviewed)
  values (v_org, p_injury_id, null, 0, public.auth_user_id(), false);
  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_org, public.auth_user_id(), 'medic', 'injury.protocol_opened', 'injury', p_injury_id, v_injury.athlete_id, jsonb_build_object('total_stages', p_total_stages));
end;
$$;
revoke all on function public.open_injury_protocol(uuid, int) from public;
grant execute on function public.open_injury_protocol(uuid, int) to authenticated;

-- Move the stage. The rules live here, not in the screen.
create or replace function public.move_injury_stage(p_injury_id uuid, p_to_stage int, p_restriction_line text, p_criteria_reviewed boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_injury public.injuries;
  v_open public.availability;
  v_total int;
  v_from int;
  v_advance boolean;
begin
  if not public.auth_has_any_role(array['medic']::public.app_role[]) then
    raise exception 'only the medic advances a stage' using errcode = '42501';
  end if;
  select * into v_injury from public.injuries where id = p_injury_id and org_id = v_org and deleted_at is null;
  if v_injury.id is null then
    raise exception 'no such injury' using errcode = '42501';
  end if;
  select total_stages into v_total from public.injury_protocols where injury_id = p_injury_id;
  if v_total is null then
    raise exception 'no_protocol' using errcode = 'P0001';
  end if;
  if p_to_stage < 0 or p_to_stage > v_total then
    raise exception 'stage_out_of_range' using errcode = 'P0001';
  end if;
  select current_stage into v_from from public.injury_protocols where injury_id = p_injury_id;
  if p_to_stage = v_from then
    raise exception 'same_stage' using errcode = 'P0001';
  end if;
  v_advance := (p_to_stage = v_from + 1);

  if v_advance then
    -- one stage forward: the rewritten line and the confirmation, no reason needed
    if not public.restriction_line_is_clean(p_restriction_line) then
      raise exception 'restriction_line_required' using errcode = 'P0001';
    end if;
    if not coalesce(p_criteria_reviewed, false) then
      raise exception 'criteria_not_reviewed' using errcode = 'P0001';
    end if;
  else
    -- any other stage: a reason, in words
    if p_reason is null or length(btrim(p_reason)) = 0 then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    if nullif(btrim(coalesce(p_restriction_line, '')), '') is not null and not public.restriction_line_is_clean(p_restriction_line) then
      raise exception 'restriction_line_names_clinical' using errcode = 'P0001';
    end if;
  end if;

  insert into public.injury_stage_events (org_id, injury_id, from_stage, to_stage, moved_by, restriction_line, criteria_reviewed, reason)
  values (v_org, p_injury_id, v_from, p_to_stage, public.auth_user_id(), nullif(btrim(coalesce(p_restriction_line, '')), ''), coalesce(p_criteria_reviewed, false), nullif(btrim(coalesce(p_reason, '')), ''));
  update public.injury_protocols set current_stage = p_to_stage where injury_id = p_injury_id;

  -- The line the coach and the athlete read. The availability table is a
  -- ledger (C7's history screen is built on it), so the line is never
  -- rewritten in place: the open row is closed and a new one opened with the
  -- same status, reason, injury and note, the new line, the medic as set_by
  -- and a clear read flag (0122, C1) — so Today tells the athlete once more,
  -- dated to this move, and the history shows what the line was before.
  if nullif(btrim(coalesce(p_restriction_line, '')), '') is not null then
    update public.availability
       set effective_to = now()
     where org_id = v_org and athlete_id = v_injury.athlete_id and injury_id = p_injury_id and effective_to is null
    returning * into v_open;
    if v_open.id is not null then
      insert into public.availability (org_id, athlete_id, status, restrictions, reason_category, injury_id, effective_from, set_by, note)
      values (v_org, v_injury.athlete_id, v_open.status, array[btrim(p_restriction_line)], v_open.reason_category, p_injury_id, now(), public.auth_user_id(), v_open.note);
    end if;
  end if;

  insert into public.injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
  values (v_org, p_injury_id, public.auth_user_id(), 'medic', 'stage_change',
          jsonb_build_object('from_stage', v_from, 'to_stage', p_to_stage, 'of', v_total, 'advance', v_advance, 'reason', p_reason, 'criteria_reviewed', coalesce(p_criteria_reviewed, false)));
  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_org, public.auth_user_id(), 'medic', case when v_advance then 'injury.stage_advanced' else 'injury.stage_set' end, 'injury', p_injury_id, v_injury.athlete_id,
          jsonb_build_object('from_stage', v_from, 'to_stage', p_to_stage, 'of', v_total, 'reason', p_reason));
end;
$$;
revoke all on function public.move_injury_stage(uuid, int, text, boolean, text) from public;
grant execute on function public.move_injury_stage(uuid, int, text, boolean, text) to authenticated;
