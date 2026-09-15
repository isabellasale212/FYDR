-- 0132_programme_assignment_dates.sql
--
-- What this does
--   Gym programmes get dates, and the dates live on the assignment —
--   docs/decisions/programme-dates.md (Isabella, 15 September 2026), opened by
--   PATTERN-S6 C2: a programme session carried a week number and a day number
--   and nothing that mapped either onto a calendar.
--
--   The shape
--     - A programme stays a template: weeks and sessions, no dates.
--     - An assignment carries a start date, chosen by the S&C when they assign.
--       programme_assignments.starts_on loses its NOT NULL and its DEFAULT
--       (current_date was an invented date, exactly what the decision refuses).
--     - There is no end date. programme_assignments.ends_on is DROPPED; the end
--       falls out of the start plus the programme's length —
--       programme_assignment_ends_on(start, programme) = start + weeks·7 − 1,
--       with programme_length_weeks(programme) the sum of its blocks' weeks
--       (the programme's own duration_weeks only when it has no blocks).
--       Nothing can disagree with anything.
--     - Week 1 day 1 is the start date; every session counts forward from it:
--       resolve_my_programme_sessions gains assignment_starts_on,
--       assignment_ends_on and scheduled_on (block weeks count forward through
--       the blocks before, 0062's own arithmetic).
--     - Overlap is allowed: nothing here refuses two live assignments.
--     - Existing assignments are left UNMAPPED: every starts_on on record is set
--       to null rather than kept as the day somebody happened to press Assign.
--       The S&C sets a date the next time they touch each one. All accounts are
--       synthetic (the decision's own words).
--
--   What does not change
--     resolve_my_assigned_sessions_by_week (0062/0065) keeps its arithmetic;
--     it now computes the end instead of reading a column, and an unmapped
--     assignment (no anchor) simply joins no week — a denominator of nothing,
--     which is true. No "due today" and no "missed" anywhere: each is its own
--     piece of work, not part of this decision.
--
-- Tests: supabase/tests/860_programme_assignment_dates_test.sql (written
-- first); 400_injury_timeline_test.sql updated (it used ends_on as the column
-- to prove update rights on; starts_on now).


-- ===========================================================================
-- The length, and the end, once
-- ===========================================================================

create or replace function public.programme_length_weeks(p_programme_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select sum(b.duration_weeks)::int from public.programme_blocks b where b.programme_id = p_programme_id),
    (select p.duration_weeks from public.programmes p where p.id = p_programme_id)
  );
$$;

comment on function public.programme_length_weeks(uuid) is
  'How many weeks a programme runs: the sum of its blocks'' weeks, or its own duration_weeks '
  'when it has no blocks. programme-dates.md, 0132.';

create or replace function public.programme_assignment_ends_on(p_starts_on date, p_programme_id uuid)
returns date
language sql
stable
set search_path = public
as $$
  select case
    when p_starts_on is null then null
    else p_starts_on + (coalesce(public.programme_length_weeks(p_programme_id), 0) * 7) - 1
  end;
$$;

comment on function public.programme_assignment_ends_on(date, uuid) is
  'The last day of an assignment: start + weeks·7 − 1. Null for an unmapped assignment. There '
  'is no end-date column — the end falls out of the start and the length (programme-dates.md, 0132).';

grant execute on function public.programme_length_weeks(uuid) to authenticated;
grant execute on function public.programme_assignment_ends_on(date, uuid) to authenticated;

-- ===========================================================================
-- The by-week denominator computes the end (before the column goes)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.resolve_my_assigned_sessions_by_week(p_athlete_id uuid, p_from date, p_to date)
 RETURNS TABLE(week_start date, assigned integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid;
begin
  if auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[]) then
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
           -- 0132: the end is the start plus the programme's length, never a column.
           public.programme_assignment_ends_on(pa.starts_on, pa.programme_id) as ends_on
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
     -- An unmapped assignment (null start, 0132) has no anchor and joins nothing.
     and m.ends_on >= w.ws
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
$function$;


-- ===========================================================================
-- The columns
-- ===========================================================================

alter table public.programme_assignments
  alter column starts_on drop not null,
  alter column starts_on drop default;

comment on column public.programme_assignments.starts_on is
  'Week 1 day 1, chosen by the S&C at assignment (programme-dates.md, 0132). Null is an '
  'unmapped assignment: it was made before dates existed and nobody has set one yet. Never '
  'defaulted — an invented date is worse than none.';

-- Every row on record: unmapped, not invented. (The decision: "Existing
-- assignments have no start date. They are left unmapped rather than given
-- an invented one; the S&C sets a date the next time they touch each one.
-- All accounts are synthetic.")
update public.programme_assignments set starts_on = null;

alter table public.programme_assignments drop column ends_on;

-- ===========================================================================
-- The athlete's sessions carry the dates
-- ===========================================================================

drop function if exists public.resolve_my_programme_sessions(uuid);
create function public.resolve_my_programme_sessions(p_athlete_id uuid)
returns table (
  programme_id          uuid,
  programme_name        text,
  programme_type        programme_type,
  block_name            text,
  block_sequence        int,
  session_id            uuid,
  session_name          text,
  week_number           int,
  day_number            int,
  md_offset             int,
  session_sequence      int,
  assignment_starts_on  date,
  assignment_ends_on    date,
  scheduled_on          date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[]) then
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
  with spans as (
    -- Weeks before each block, in sequence: 0062's running sum.
    select b.id as block_id,
           (sum(b.duration_weeks) over (
             partition by b.programme_id
             order by b.sequence
             rows between unbounded preceding and current row
           ) - b.duration_weeks)::int as weeks_before
    from programme_blocks b
  )
  select distinct p.id, p.name, p.programme_type, b.name, b.sequence,
         s.id, s.name, s.week_number, s.day_number, s.md_offset, s.sequence,
         pa.starts_on,
         public.programme_assignment_ends_on(pa.starts_on, p.id),
         -- Week 1 day 1 is the start; a session sits (weeks before its block
         -- + its week − 1) weeks and (its day − 1) days on. Null when unmapped.
         case
           when pa.starts_on is null then null
           else pa.starts_on + (((sp.weeks_before + s.week_number - 1) * 7) + (coalesce(s.day_number, 1) - 1))::int
         end
  from programme_assignments pa
  join programmes p on p.id = pa.programme_id
  join programme_blocks b on b.programme_id = p.id
  join spans sp on sp.block_id = b.id
  join programme_sessions s on s.block_id = b.id
  where pa.org_id = auth_org_id()
    and pa.status = 'active'
    -- A draft programme is invisible to athletes (0043).
    and p.status = 'active'
    and (
      pa.athlete_id = v_athlete
      or (pa.group_id is not null and exists (
            select 1 from group_memberships gm
            where gm.athlete_id = v_athlete
              and gm.group_id = pa.group_id
              and gm.removed_at is null))
    )
  order by b.sequence, s.week_number, s.sequence;
end;
$$;

comment on function public.resolve_my_programme_sessions(uuid) is
  'The sessions assigned to one athlete, with the assignment''s start and end and each session''s '
  'scheduled date (week 1 day 1 = the start; null throughout for an unmapped assignment). Staff '
  'for any athlete of their organisation; an athlete for themselves; empty otherwise. 0021, 0038, '
  '0043, 0065; dates from 0132.';

revoke execute on function public.resolve_my_programme_sessions(uuid) from public;
revoke execute on function public.resolve_my_programme_sessions(uuid) from anon;
grant execute on function public.resolve_my_programme_sessions(uuid) to authenticated;
