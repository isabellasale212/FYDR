-- 0116_minors_off_ranked_boards.sql
--
-- Children's Code, ruled by Isabella 2026-09-13, replacing the rule 0016 set:
--
--   "Remove the minor's own opt-in entirely, until the guardian route exists.
--    As built, a sixteen year old can tap themselves onto a ranked board while
--    parental_consent_* is written by nothing. That is consent that is not
--    consent, with a child on the other end of it. Until S9's guardian route is
--    built there is no opt-in path for an under-18 at all: excluded by default,
--    no way to leave it."
--
-- What this does
--   Re-creates compute_leaderboard (0094's body, verbatim) with one change: the
--   population clause is `not athlete_is_minor(a.id)`. The `or exists (consent
--   … leaderboard_visibility …)` escape that 0016 added, and 0056/0065/0094
--   carried, is gone. A minor with a live self-granted consent row is now
--   absent from every published board, GPS included; the rows stay as history.
--   "Academy" is not a rule here: age by date of birth is the legal trigger
--   (ruling one); a group name is a club convention.
--
-- What this does not change
--   athlete_consents and its policies (the guardian route, S9, will decide what
--   a valid consent is and who records it); the adult opt-out; the tier gate;
--   the own-row gate at the end of the function. The staff wall
--   (lib/queries/leaderboardWall.ts) applies the same rule in the app, from the
--   same helper's definition of a minor, and its guard pins the two together.
--
-- Rolled forward, not back: 0016's and 0094's tests asserting "a minor with a
-- granted consent appears" are rewritten to assert the new rule.

create or replace function public.compute_leaderboard(p_leaderboard_id uuid)
returns table (
  "position"   int,
  athlete_id   uuid,
  first_name   text,
  last_name    text,
  value        numeric,
  record_count int,
  is_tied      boolean,
  previous_position int
)
language plpgsql
stable
security definer
set search_path = public
as $$

declare
  lb    leaderboards%rowtype;
  md    metric_definitions%rowtype;
  v_from date;
  v_to   date;
  v_is_staff boolean;
  v_caller_athlete uuid;
begin
  select * into lb from leaderboards
   where id = p_leaderboard_id and org_id = auth_org_id() and deleted_at is null;
  if lb.id is null then
    return;
  end if;

  select * into md from metric_definitions where key = lb.metric_key;
  if md.key is null or not md.leaderboard_eligible then
    raise exception 'metric_not_eligible' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------- 0094
  -- GPS is a Premium metric, and until 0094 this function did not know it.
  -- Empty, not an exception: see the migration header. A club on any tier but
  -- 'performance' ranks nobody on a board built from GPS data.
  --
  -- source_table, NOT the key prefix. What makes a metric a GPS metric is where
  -- its numbers come from, and a tenth GPS metric named under some other
  -- convention would slip a `key like 'gps.%'` test. The four page-level checks
  -- still use the prefix; they are the readable-message layer, and this is the
  -- one that decides.
  if md.source_table = 'gps_records'
     and coalesce((select o.tier from public.organisations o where o.id = lb.org_id), 'core') <> 'performance'
  then
    return;
  end if;

  v_is_staff := auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[]);
  v_caller_athlete := auth_athlete_id();

  -- Staff may preview a draft board. Nobody else may see a staff-only board at all.
  if not v_is_staff and lb.visibility <> 'published' then
    return;
  end if;

  v_to := coalesce(lb.window_to, current_date);
  v_from := case lb.window_type
              when 'days'     then v_to - lb.window_days
              when 'season'   then coalesce(
                                     (select starts_on from seasons
                                       where org_id = lb.org_id and is_current
                                       limit 1),
                                     v_to - 365)
              when 'all_time' then date '1900-01-01'
              else lb.window_from
            end;

  return query
  with population as (
    select a.id as athlete_id, a.first_name, a.last_name
    from athletes a
    where a.org_id = lb.org_id
      and a.deleted_at is null
      and a.status <> 'left_club'
      and (
        lb.population_type = 'squad'
        or (lb.population_type = 'selected' and a.id = any(lb.athlete_ids))
        or (lb.population_type = 'group' and exists (
              select 1 from group_memberships gm
              where gm.athlete_id = a.id and gm.group_id = lb.group_id
                and gm.removed_at is null)))
      and (not lb.exclude_unavailable or coalesce((
            select av.status from availability av
            where av.athlete_id = a.id and av.effective_to is null
            order by av.effective_from desc limit 1), 'available') = 'available')
      and not exists (
        select 1 from leaderboard_opt_outs o
        where o.athlete_id = a.id
          and (o.leaderboard_id = lb.id or o.leaderboard_id is null)
          and o.ended_at is null)
      -- Children's Code, ruled by Isabella 2026-09-13 (migration 0116): an under-18
      -- athlete is NOT on a ranked board, full stop, until a guardian route exists
      -- (S9). The self-granted leaderboard_visibility consent that lifted this from
      -- 0016 to 0115 no longer counts — a sixteen-year-old tapping themselves onto a
      -- board while parental_consent_* is written by nothing is consent that is not
      -- consent. Existing consent rows stay as history and have no effect here. A
      -- null date of birth is a minor (athlete_is_minor). Enforced in the query, not
      -- a client, and covering GPS boards because it filters the population.
      and not athlete_is_minor(a.id)
  ),
  -- The metric dispatcher. Two training branches from 0016, unchanged, plus one GPS
  -- branch covering all nine gps.* keys — see this migration's header for why the GPS
  -- metrics share a branch where the training ones cannot.
  raw as (
    select te.athlete_id, te.entry_date as record_date, te.session_load as value
    from training_entries_current te
    join population p on p.athlete_id = te.athlete_id
    where lb.metric_key = 'training.total_session_load'
      and te.entry_date between v_from and v_to
      and te.session_load is not null
    union all
    select sa.athlete_id, sa.recorded_at::date as record_date, 1::numeric as value
    from session_attendance sa
    join population p on p.athlete_id = sa.athlete_id
    where lb.metric_key = 'training.sessions_attended'
      and sa.attendance in ('full', 'modified')
      and sa.recorded_at::date between v_from and v_to
    union all
    select gv.athlete_id, gv.record_date, gv.value
    from (
      select g.athlete_id, g.record_date,
             (case lb.metric_key
                when 'gps.total_distance_m'       then g.total_distance_m
                when 'gps.running_distance_m'     then g.running_distance_m
                when 'gps.high_speed_distance_m'  then g.high_speed_distance_m
                when 'gps.sprint_distance_m'      then g.sprint_distance_m
                when 'gps.high_intensity_efforts' then g.high_intensity_efforts
                when 'gps.max_speed_ms'           then g.max_speed_ms
                when 'gps.accelerations'          then g.accelerations
                when 'gps.decelerations'          then g.decelerations
                when 'gps.player_load'            then g.player_load
              end)::numeric as value
      from gps_records g
      join population p on p.athlete_id = g.athlete_id
      where lb.metric_key like 'gps.%'
        and g.org_id = lb.org_id
        and g.record_date between v_from and v_to
    ) gv
    where gv.value is not null
  ),
  agg as (
    select
      r.athlete_id,
      count(*)::int as record_count,
      case lb.aggregation
        when 'best'   then case when md.higher_is_better
                                then max(r.value) else min(r.value) end
        when 'latest' then (array_agg(r.value order by r.record_date desc))[1]
        when 'mean'   then avg(r.value)
        when 'total'  then sum(r.value)
        when 'count'  then count(*)::numeric
      end as value
    from raw r
    group by r.athlete_id
    having count(*) >= lb.min_records
  ),
  ranked as (
    select
      p.athlete_id, p.first_name, p.last_name,
      a.value, a.record_count,
      rank() over (order by
        case when md.higher_is_better then a.value end desc nulls last,
        case when not md.higher_is_better then a.value end asc nulls last
      )::int as "position",
      count(*) over (partition by a.value) > 1 as is_tied
    from population p
    join agg a on a.athlete_id = p.athlete_id
  )
  select r."position", r.athlete_id, r.first_name, r.last_name,
         r.value, r.record_count, r.is_tied,
         null::int as previous_position
  from ranked r
  -- The minimum-population guard: below it, nothing is returned at all rather than a
  -- ranking of one or two identifiable people. screens/leaderboards.md, the guard is
  -- "not only statistical" — see migration 0016's header above this function.
  where (select count(*) from ranked) >= greatest(md.min_population, 3)
    -- The final gate: a non-staff caller only ever receives rows if their own
    -- athlete_id is actually in this ranking. This is what makes admin's call return
    -- nothing (no athlete_id to match) without any admin-specific branch.
    and (v_is_staff or exists (select 1 from ranked x where x.athlete_id = v_caller_athlete))
  order by r."position", r.last_name;
end;
$$;
