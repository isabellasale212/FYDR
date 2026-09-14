-- The premium plan page and the three gaps the premium inventory named
-- (Isabella, decision batch 13 September 2026 "Premium contents", built 15
-- September): the one-place sentence, the retention run's coverage of
-- gps_records, and an audit row on a tier flip.
--
-- 1. AN AUDIT ROW ON A TIER FLIP. organisations.tier is changed by nobody in
--    the product — Fydr staff, the database — and until now silently. A
--    trigger writes org.tier.changed {from, to} to audit_log with whatever
--    actor the session carries (null for a service-role or console change:
--    the row still records the flip and when). Keep and hide has a date now.
--
-- 2. THE RETENTION RUN COVERS gps_records. docs/decisions/premium-downgrade.md:
--    "Kept does not mean kept forever. The data stays under the club's normal
--    retention policy, the same clock that governs everything else." The run
--    (lib/retention/compute.ts) counted GPS rows past the performance cutoff
--    and touched none — gps_records had no deleted_at to redact through (the
--    file's own header). It has one now. Retention soft-deletes GPS rows past
--    the cutoff, on any plan, hidden or not; every signed-in read is filtered
--    at the ROW — the two SELECT policies and the UPDATE policy gain
--    `deleted_at is null`, so no query in the app can forget — and the two
--    SECURITY DEFINER reads that bypass RLS (analytics_daily_rows, 0125, and
--    compute_leaderboard, 0094) filter it themselves. The import's upsert
--    cannot resurrect a retired row: its UPDATE policy no longer reaches one.
--    The service role sees every row (retention itself, the SAR pack, which
--    filters in code). Never a hard delete: CLAUDE.md rule 4.
--
-- 3. THE ONE-PLACE SENTENCE. premium_history_kept() tells the sport scientist
--    what GPS history the club holds — rows, first and last date, import
--    batches — on ANY plan, so the plan page can say "kept and returns with
--    Premium" to a club whose staff cannot read the table (0119). SECURITY
--    DEFINER, the caller's own club, the sport scientist only, counts and
--    dates only: nothing an athlete could be identified from.

-- ---------------------------------------------------------------------------
-- 1. org.tier.changed
-- ---------------------------------------------------------------------------
create or replace function public.audit_org_tier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tier is distinct from old.tier then
    insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata, ip_address)
    values (new.id, public.auth_user_id(), public.audit_acting_role(), 'org.tier.changed', 'organisation', new.id, null,
            jsonb_build_object('from', old.tier, 'to', new.tier), public.audit_client_ip());
  end if;
  return new;
end;
$$;
drop trigger if exists organisations_tier_audit on public.organisations;
create trigger organisations_tier_audit
  after update of tier on public.organisations
  for each row execute function public.audit_org_tier_change();

-- ---------------------------------------------------------------------------
-- 2. gps_records.deleted_at, and every read filtered at the row
-- ---------------------------------------------------------------------------
alter table public.gps_records add column deleted_at timestamptz;
comment on column public.gps_records.deleted_at is
  'Set by the retention run when the row is past the club''s performance-data cutoff (lib/retention/compute.ts). Filtered at the row by every signed-in policy and by the two definer reads; the service role sees it. 0126.';
create index gps_records_live_idx on public.gps_records (org_id, record_date) where deleted_at is null;

drop policy if exists gps_records_staff_select on public.gps_records;
create policy gps_records_staff_select on public.gps_records
  as permissive
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[])
    and public.auth_org_is_premium()
    and deleted_at is null
  );
drop policy if exists gps_records_self_select on public.gps_records;
create policy gps_records_self_select on public.gps_records
  as permissive
  for select
  to authenticated
  using (org_id = public.auth_org_id() and athlete_id = public.auth_athlete_id() and deleted_at is null);
drop policy if exists gps_records_staff_update on public.gps_records;
create policy gps_records_staff_update on public.gps_records
  as permissive
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and public.auth_org_is_premium()
    and deleted_at is null
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and public.auth_org_is_premium()
    and deleted_at is null
  );

-- analytics_daily_rows (0125): the GPS branch filters the retired rows.
create or replace function public.analytics_daily_rows(
  p_source_table text,
  p_from date,
  p_to date,
  p_athlete_id uuid default null
)
returns table (athlete_id uuid, entry_date date, cols jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
begin
  -- Keep and hide: a basic club's call returns nothing, never an error.
  if v_org is null or not public.auth_org_is_premium() then
    return;
  end if;
  -- D-02: analytics is the sport scientist's alone.
  if not public.auth_has_any_role(array['sport_scientist']::public.app_role[]) then
    return;
  end if;

  if p_source_table = 'training_entries_current' then
    return query
      select t.athlete_id, t.entry_date,
             jsonb_build_object('session_load', t.session_load, 'rpe', t.rpe, 'duration_min', t.duration_min)
        from public.training_entries_current t
        join public.athletes a on a.id = t.athlete_id
       where t.org_id = v_org
         and t.entry_date between p_from and p_to
         and (p_athlete_id is null or t.athlete_id = p_athlete_id)
         and a.in_data and a.deleted_at is null and a.status <> 'left_club';
  elsif p_source_table = 'wellness_entries_current' then
    return query
      select w.athlete_id, w.entry_date,
             jsonb_build_object('sleep_hours', w.sleep_hours, 'sleep_quality', w.sleep_quality, 'fatigue', w.fatigue,
                                'soreness', w.soreness, 'stress', w.stress, 'mood', w.mood, 'resting_hr', w.resting_hr)
        from public.wellness_entries_current w
        join public.athletes a on a.id = w.athlete_id
       where w.org_id = v_org
         and w.entry_date between p_from and p_to
         and (p_athlete_id is null or w.athlete_id = p_athlete_id)
         and a.in_data and a.deleted_at is null and a.status <> 'left_club';
  elsif p_source_table = 'gym_set_logs' then
    return query
      select gl.athlete_id, gl.entry_date,
             jsonb_build_object('volume_kg', sum(gs.volume_kg))
        from public.gym_set_logs gs
        join public.gym_session_logs gl on gl.id = gs.gym_session_log_id
        join public.athletes a on a.id = gl.athlete_id
       where gs.org_id = v_org
         and gl.superseded_by is null
         and gs.superseded_by is null
         and gs.is_warmup = false
         and gl.entry_date between p_from and p_to
         and (p_athlete_id is null or gl.athlete_id = p_athlete_id)
         and a.in_data and a.deleted_at is null and a.status <> 'left_club'
       group by gl.id, gl.athlete_id, gl.entry_date;
  elsif p_source_table = 'gps_records' then
    return query
      select g.athlete_id, g.record_date,
             jsonb_build_object('total_distance_m', g.total_distance_m, 'running_distance_m', g.running_distance_m,
                                'high_speed_distance_m', g.high_speed_distance_m, 'sprint_distance_m', g.sprint_distance_m,
                                'high_intensity_efforts', g.high_intensity_efforts, 'max_speed_ms', g.max_speed_ms,
                                'accelerations', g.accelerations, 'decelerations', g.decelerations,
                                'player_load', g.player_load, 'duration_s', g.duration_s)
        from public.gps_records g
        join public.athletes a on a.id = g.athlete_id
       where g.org_id = v_org
         and g.deleted_at is null
         and g.record_date between p_from and p_to
         and (p_athlete_id is null or g.athlete_id = p_athlete_id)
         and a.in_data and a.deleted_at is null and a.status <> 'left_club';
  else
    raise exception 'analytics_daily_rows: unknown source_table %', p_source_table using errcode = '22023';
  end if;
end;
$$;

-- compute_leaderboard (0094's live body, unaltered but for one line in the GPS
-- read: `and g.deleted_at is null`), so a board never ranks a retired row.
create or replace function public.compute_leaderboard(p_leaderboard_id uuid)
 RETURNS TABLE("position" integer, athlete_id uuid, first_name text, last_name text, value numeric, record_count integer, is_tied boolean, previous_position integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

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
        and g.deleted_at is null
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. premium_history_kept()
-- ---------------------------------------------------------------------------
create or replace function public.premium_history_kept()
returns table (gps_rows bigint, first_date date, last_date date, import_batches bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.gps_records g where g.org_id = public.auth_org_id() and g.deleted_at is null),
    (select min(g.record_date) from public.gps_records g where g.org_id = public.auth_org_id() and g.deleted_at is null),
    (select max(g.record_date) from public.gps_records g where g.org_id = public.auth_org_id() and g.deleted_at is null),
    (select count(*) from public.import_batches b where b.org_id = public.auth_org_id())
  where public.auth_org_id() is not null
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[]);
$$;
comment on function public.premium_history_kept() is
  'The plan page''s one sentence: how much GPS history the club holds, on any plan (0119 hides the rows from a Basic club''s staff; this says they are kept). Sport scientist only, counts and dates only. 0126.';
revoke all on function public.premium_history_kept() from public;
grant execute on function public.premium_history_kept() to authenticated;
