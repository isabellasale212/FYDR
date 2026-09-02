-- ---------------------------------------------------------------------------
-- resolve_my_assigned_sessions_by_week: how many gym/rehab sessions were
-- ASSIGNED to an athlete in each calendar week of a window.
--
-- WHY THIS EXISTS. Fydr Athlete App.dc.html 23k puts "of 14 assigned" beside
-- the completed count, and the implementation spec's §9 rule 2 makes it
-- binding: "every aggregate states its denominator". A bare "12 sessions" says
-- nothing about whether that is all of them or half of them, and a compliance
-- number without its denominator is the kind of screen that "looks right and
-- is wrong".
--
-- The number could not be computed from anything an athlete may read. They
-- have no select on programmes, programme_blocks or programme_sessions (0021,
-- by design), and resolve_my_programme_sessions returns a session list with
-- week_number/day_number but no assignment dates, so nothing on that path can
-- say WHICH calendar week a programme week landed in. Hence a second resolve
-- function rather than a widened policy.
--
-- HOW A CALENDAR WEEK MAPS TO A PROGRAMME WEEK. Fully determined by the
-- schema, so nothing here is a guess:
--
--   programme_assignments.starts_on   anchors week 1
--   programme_blocks.sequence         orders the blocks
--   programme_blocks.duration_weeks   gives each block its span
--   programme_sessions.week_number    places a session inside its block
--
-- weeks_elapsed = (monday_of(calendar_week) - monday_of(starts_on)) / 7, and a
-- running sum over duration_weeks in sequence order says which block that
-- falls in and which week of it. Past the last block the programme has run
-- out and nothing is assigned — zero, not a repeat. A programme with a defined
-- duration that has ended assigns nothing; assuming it loops would be
-- inventing product behaviour (CLAUDE.md §5).
--
-- COUNT DISTINCT, not count. Migration 0038 records a real case: an athlete
-- with BOTH a direct assignment and a group assignment to the same programme,
-- which returns one row per assignment path. Counting rows would have said 28
-- assigned where 14 were. Two different programmes at once (a gym block and a
-- rehab block) do both count, which is correct — both are assigned.
--
-- Nutrition programmes are excluded: they carry no sessions an athlete logs
-- against, so counting them would inflate a gym denominator with work that
-- produces no gym_session_log.
--
-- security definer, with migration 0020's whitelist guard copied verbatim from
-- resolve_my_programme_sessions beside it — staff read any athlete in their
-- org, an athlete reads only themselves, everyone else gets an empty set
-- rather than an error (an error is itself a disclosure).
-- ---------------------------------------------------------------------------

create or replace function public.resolve_my_assigned_sessions_by_week(
  p_athlete_id uuid,
  p_from       date,
  p_to         date
)
returns table (week_start date, assigned int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if auth_has_any_role(array['coach','medical']::app_role[]) then
    v_athlete := p_athlete_id;
  elsif auth_has_any_role(array['athlete']::app_role[]) and auth_athlete_id() = p_athlete_id then
    v_athlete := p_athlete_id;
  else
    v_athlete := null;
  end if;

  if v_athlete is null or p_from is null or p_to is null or p_to < p_from then
    return;
  end if;

  -- A span nothing on screen can use. The caller asks for four weeks; this is
  -- a ceiling, not a feature, so a caller that asks for two years gets nothing
  -- back rather than a scan of every block in the org.
  if p_to - p_from > 400 then
    return;
  end if;

  return query
  with weeks as (
    select generate_series(
             date_trunc('week', p_from::timestamp)::date,
             date_trunc('week', p_to::timestamp)::date,
             interval '7 day'
           )::date as ws
  ),
  mine as (
    select pa.id,
           pa.programme_id,
           date_trunc('week', pa.starts_on::timestamp)::date as anchor,
           pa.starts_on,
           pa.ends_on
    from programme_assignments pa
    join programmes pr on pr.id = pa.programme_id
    where pa.org_id = auth_org_id()
      -- 'completed' is included on purpose: the window looks backwards, and a
      -- block that finished last week still assigned work while it ran.
      -- 'suspended' and 'cancelled' are not — a suspended assignment (a rehab
      -- programme displacing a gym one) was not asking for anything.
      and pa.status in ('active', 'completed')
      and pr.programme_type <> 'nutrition'
      and (
        pa.athlete_id = v_athlete
        or (pa.group_id is not null and exists (
              select 1
              from group_memberships gm
              where gm.athlete_id = v_athlete
                and gm.group_id = pa.group_id
                and gm.removed_at is null))
      )
  ),
  spans as (
    select b.programme_id,
           b.id as block_id,
           b.duration_weeks,
           sum(b.duration_weeks) over (
             partition by b.programme_id
             order by b.sequence
             rows between unbounded preceding and current row
           ) as cum_end
    from programme_blocks b
  ),
  placed as (
    select w.ws,
           sp.block_id,
           ((w.ws - m.anchor) / 7) - (sp.cum_end - sp.duration_weeks) + 1 as week_in_block
    from weeks w
    join mine m
      on w.ws >= m.anchor
     and m.starts_on <= w.ws + 6
     and (m.ends_on is null or m.ends_on >= w.ws)
    join spans sp
      on sp.programme_id = m.programme_id
     and ((w.ws - m.anchor) / 7) >= (sp.cum_end - sp.duration_weeks)
     and ((w.ws - m.anchor) / 7) <  sp.cum_end
  )
  select w.ws,
         coalesce((
           select count(distinct s.id)::int
           from placed p
           join programme_sessions s
             on s.block_id = p.block_id
            and s.week_number = p.week_in_block
           where p.ws = w.ws
         ), 0)
  from weeks w
  order by w.ws;
end;
$$;

revoke all on function public.resolve_my_assigned_sessions_by_week(uuid, date, date) from public;
grant execute on function public.resolve_my_assigned_sessions_by_week(uuid, date, date) to authenticated;

comment on function public.resolve_my_assigned_sessions_by_week(uuid, date, date) is
  'Assigned gym/rehab sessions per calendar week for one athlete. Backs the '
  '"of N assigned" denominator on My data > Gym (23k). Athletes read only '
  'themselves; staff read anyone in their org.';
