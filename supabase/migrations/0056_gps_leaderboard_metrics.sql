-- 0056_gps_leaderboard_metrics.sql
--
-- What this does
--   Makes the GPS domain rankable. Nine metric_definitions rows in domain 'gps',
--   leaderboard_eligible, sourced from gps_records; and compute_leaderboard's raw-value
--   dispatcher extended to resolve them.
--
-- Why now
--   Two requests, one gap. Staff: "the leaderboard page should be able to show all
--   metrics from the gps export." Athletes: "they should be able to tailor to different
--   metrics rather than the total session load as it doesn't really tell the athletes
--   anything important." Those are the same problem — until this migration there were
--   exactly two eligible metrics, so there was nothing to tailor between. Migration
--   0016's own header predicted this file by name: "No test-based metrics, no GPS, gym
--   or testing metrics. None of those source tables exist in this schema yet... More get
--   added the day their source table lands." gps_records landed in 0023. This is that
--   day for the GPS half of the sentence.
--
-- What is deliberately NOT in this migration, and why each cut is real
--
--   - The wellness and body-composition prohibition is untouched. Those six rows stay
--     leaderboard_eligible = false with their reasons intact. 0016 called that
--     "the hard, GDPR/Children's-Code-shaped part of this feature"; nothing about GPS
--     being rankable bears on it. 290_gps_leaderboard_metrics_test.sql §1 asserts the
--     prohibition is still whole after this file runs, because "we added metrics to the
--     catalogue" is precisely the change that could erode it by accident.
--
--   - Three gps_records columns are eligible for nothing: `impacts`,
--     `metabolic_power_avg` and `duration_s`.
--
--       impacts and metabolic_power_avg were checked against the real dev database
--       before this file was written: 0 non-null values in 597 rows across both real
--       import batches. Neither Catapult profile that has ever loaded into this table
--       maps them. A metric_definitions row for a column that is always null is not a
--       feature — it is a chip in the board builder that produces an empty board and a
--       "not enough results to rank" message, which reads to a coach as a broken
--       product rather than as missing data. They get added the day a real import
--       populates them, exactly as GPS itself waited for 0023.
--
--       duration_s IS fully populated (597/597), and is deliberately still not here.
--       It measures how long an athlete was on the pitch, not what they did — a session
--       descriptor, not an output. higher_is_better has no honest answer for it (longest
--       time on the pitch is a selection fact, and ranking it publicly rewards nothing
--       an athlete controls), and this catalogue's contract is that every row carries a
--       real direction. Not a gap: a decision.
--
--   - No new aggregation methods. best / latest / mean / total / count are what
--     leaderboards' own check constraint allows and what compute_leaderboard's `agg`
--     CTE implements; every metric below picks from that set. Notably no
--     per-minute-normalised variants (distance per minute, load per minute), which is
--     the obvious next ask for GPS and needs a genuinely new aggregation shape reading
--     two columns at once. Real, named, and out of scope here.
--
-- The real data behind each row below (dev database, gps_records, 597 rows,
-- 29 athletes, 2026-07-14 to 2026-08-14, two vendor batches):
--
--   total_distance_m        597/597 non-null   2 122 – 9 868 m
--   high_speed_distance_m   597/597            81.4 – 1 619 m
--   max_speed_ms            597/597            6.80 – 10.45 m/s
--   sprint_distance_m       513/597            18.4 – 413 m
--   accelerations           513/597            18 – 60
--   decelerations           513/597            16 – 55
--   running_distance_m      512/597            1 261 – 3 655 m
--   high_intensity_efforts  512/597            50 – 242
--   player_load              85/597            281 – 518   (24 athletes, 4 dates)
--
--   player_load is the thin one and is included anyway, on the numbers rather than on
--   optimism: 24 distinct athletes is eight times the min_population floor of 3, so an
--   all-time or season board on it ranks a real squad today. Its 85 rows all come from
--   the single 'Catapult Openfield' batch, which is also the only batch that maps it, so
--   a short-window board (last 7 days, once that batch is a month old) will legitimately
--   come up empty. That is missing data behaving correctly, not a broken metric, and the
--   board detail page already says so in words: "Not enough results to rank."
--
-- Migrations are additive (CLAUDE.md §5). This file inserts new catalogue rows and
-- replaces one function body. It alters no table and rewrites no earlier migration.

-- ===========================================================================
-- 1. The nine metrics
--
-- `unit` is a display suffix appended directly after the number by every consumer
-- (see the existing ' kg', ' h', ' of 5' rows), so the leading space is deliberate and
-- required. `higher_is_better` is true for all nine: every one of these is a volume or
-- intensity output where more is the harder thing to have done. That is a real claim
-- about each metric, not a default — it is what orders the ranking, and it is why
-- duration_s is not in this list.
-- ===========================================================================

insert into metric_definitions
  (key, domain, label, unit, higher_is_better, source_table, aggregations,
   leaderboard_eligible, ineligible_reason, min_population)
values
  ('gps.total_distance_m', 'gps', 'Total distance', ' m',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.running_distance_m', 'gps', 'Running distance', ' m',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.high_speed_distance_m', 'gps', 'High speed distance', ' m',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.sprint_distance_m', 'gps', 'Sprint distance', ' m',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.high_intensity_efforts', 'gps', 'High intensity efforts', '',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  -- Max speed is the one metric here that is a peak rather than a volume: totalling or
  -- meaning it across sessions answers nothing, so 'best' leads and 'total' is absent.
  -- 'latest' is offered because "fastest we have seen you this month" and "how fast were
  -- you last week" are different, both real, coaching questions.
  ('gps.max_speed_ms', 'gps', 'Max speed', ' m/s',
    true, 'gps_records', array['best','latest','mean'], true, null, 3),
  ('gps.accelerations', 'gps', 'Accelerations', '',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.decelerations', 'gps', 'Decelerations', '',
    true, 'gps_records', array['total','mean','best'], true, null, 3),
  ('gps.player_load', 'gps', 'Player load', '',
    true, 'gps_records', array['total','mean','best'], true, null, 3);

-- ===========================================================================
-- 2. compute_leaderboard, with the GPS branch
--
-- Byte-for-byte migration 0016's function except for the `raw` CTE, which gains one
-- additional union-all branch. Everything else — the population clause with its minor
-- consent and opt-out gates, the aggregation `case`, the ranking, the min-population
-- guard, the non-staff own-row gate — is unchanged and must stay unchanged; those are
-- the parts 0016 was careful about and 200_minor_leaderboard_test.sql pins down.
--
-- Shape of the new branch, and why it is one branch rather than nine:
--
--   0016's dispatcher is a union-all of per-metric selects because its two metrics come
--   from two different tables with two different date columns and two different value
--   expressions — there was nothing to share. The nine GPS metrics are the opposite
--   case: one table, one date column, one row shape, differing only in which column is
--   the value. Nine copies of the same select would be nine places for the window, the
--   org predicate or the population join to drift apart. One branch with a `case
--   lb.metric_key` picking the column keeps the tenancy and window predicates written
--   once, which is the half that must never diverge.
--
--   The `case` lives in a subselect so the null test can be written against its result
--   once, rather than repeated as a second nine-way `case` in the where clause.
--
--   `g.org_id = lb.org_id` is redundant given the join to `population` (which is already
--   scoped to lb.org_id) and is written anyway: CLAUDE.md rule 1 makes the org predicate
--   explicit on every table a query touches, and a future edit to `population` must not
--   be able to silently widen this. The two pre-existing branches are left exactly as
--   0016 wrote them — tightening them would be an unrelated change to code this file has
--   no reason to touch.
-- ===========================================================================

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

  v_is_staff := auth_has_any_role(array['coach','medical']::app_role[]);
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

comment on function public.compute_leaderboard(uuid) is
  'security definer, not the spec''s invoker: an athlete caller must see the whole '
  'ranking, which their own RLS on training_entries/session_attendance/gps_records '
  'would otherwise block. Authorisation is embedded in the function instead — same '
  'pattern as revise_wellness_entry in migration 0010. Never returns rows for a board '
  'the caller is not entitled to, including a staff-only board to an athlete and any '
  'named row to an admin. Migration 0056 added the gps.* branch of the dispatcher; the '
  'population, gating and ranking logic is migration 0016''s, unchanged.';

grant execute on function public.compute_leaderboard(uuid) to authenticated;
