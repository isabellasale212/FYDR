-- Move the GPS tier gate into compute_leaderboard.
--
-- WHAT CHANGES: one guard, added to compute_leaderboard() immediately before the
-- staff/athlete visibility resolution. Nothing else in the function moves, and
-- the rest of this file is the live 0056 body unaltered so the two can be diffed.
--
-- WHY. Nine metrics sourced from gps_records are leaderboard_eligible and GPS is
-- a Premium upsell (docs/12-product-tiers.md §2: "The client put it behind
-- Premium explicitly"). Until today the rule lived only in pages -- two staff
-- screens, and two athlete screens as of commit 77cdf20 -- while this function
-- enforced four other rules internally: metric eligibility, staff-versus-athlete
-- visibility, leaderboard opt-outs, and under-18 consent. The commercial rule was
-- the only one pushed out to its callers, so a direct PostgREST call on a Basic
-- org returned GPS rankings. `leaderboards/new` has said so in its own header
-- since GPS boards landed: "a direct PostgREST insert could still create a GPS
-- board on a Basic org... closing it properly needs the tier inside
-- compute_leaderboard." This is that.
--
-- IT RETURNS EMPTY AND DOES NOT RAISE, and that is a correctness requirement
-- rather than a preference. `fetchMyBoards` (lib/queries/leaderboards.ts:232)
-- ranks EVERY published board for an athlete inside one Promise.all. An
-- exception on a single gated GPS board would reject that whole promise and take
-- the club's non-GPS boards down with it -- the athlete would lose their
-- leaderboards screen entirely rather than lose one board. The function already
-- has this precedent: a non-published board seen by a non-staff caller returns
-- empty too. Only genuine misconfiguration, an ineligible metric, still raises.
--
-- IT TESTS md.source_table, NOT THE KEY PREFIX. Isabella's instruction, and the
-- right one: what makes a metric a GPS metric is where its numbers come from, so
-- a tenth GPS metric introduced under a different naming convention is caught by
-- this and would have slipped a `metric_key like 'gps.%'` test.
--
-- ONE ASYMMETRY THIS CREATES, NAMED RATHER THAN LEFT TO BE FOUND. The four
-- page-level checks use `metric_key.startsWith('gps.')`, because
-- `fetchMetricCatalogue` does not send source_table to the client
-- (MetricDefinition in lib/queries/leaderboards.ts has no such field). So for a
-- hypothetical GPS-sourced metric under a non-gps key, the function would refuse
-- it and the pages would not recognise it -- the athlete would get the generic
-- "not available" instead of the plan message. Strictly safe, mildly less
-- readable, and the fix if it ever matters is to add source_table to
-- METRIC_COLUMNS. Test 500 pins both halves so a divergence is visible.
--
-- THE PAGE-LEVEL CHECKS STAY, on Isabella's instruction and for a good reason: a
-- function that returns no rows cannot tell an athlete why. Only the page can
-- say "this board ranks GPS data, which is part of the Premium plan". They are
-- now defence in depth rather than the only defence.
--
-- NOTE FOR WHOEVER ADDS THE TENTH GPS METRIC: the dispatcher further down still
-- selects its GPS branch on `lb.metric_key like 'gps.%'`, so a differently-keyed
-- GPS metric would need that extended as well. This guard is durable; the
-- dispatcher is not yet.

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
      -- Children's Code standard 7: an under-18 athlete is on a board only where they
      -- granted leaderboard_visibility themselves. Enforced here, in the query, not in
      -- a client — screens/leaderboards.md "Athletes under 18: opt-in, not opt-out".
      -- Unchanged from 0016, and now covering GPS boards for free precisely because it
      -- filters the population rather than any one metric's own branch.
      and (
        not athlete_is_minor(a.id)
        or exists (
          select 1 from athlete_consents c
          where c.athlete_id = a.id
            and c.purpose = 'leaderboard_visibility'
            and c.granted_at is not null
            and c.withdrawn_at is null)
      )
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
