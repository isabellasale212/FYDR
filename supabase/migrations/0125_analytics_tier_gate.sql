-- Analytics is premium at the database (Isabella, 14 September 2026,
-- docs/decisions/absence-rule.md "Analytics is premium"): a wholly premium
-- destination covering every metric, GPS included, gated at the database as
-- well as the app, with 0119's mechanism.
--
-- WHAT EXISTED. The four analytics panels (PATTERN-S7 C6, 13 September) read
-- training_entries_current, wellness_entries_current, gym_set_logs and
-- gps_records directly. Three of those are every club's tables, so a basic
-- club's sport scientist could rebuild the analytics numbers with a direct
-- PostgREST call whatever the page did; only the GPS branch was closed (0119).
-- The screen's own gate was app-side, and D-20's "refuses at the URL" rested
-- on it alone.
--
-- WHAT THIS ADDS. One door for the destination: analytics_daily_rows(). The
-- panels read every source through it and nothing else, so the tier check
-- lives in one place the app cannot forget. The function returns NO ROWS for
-- a club that is not premium — 0119's and 0094's shape, keep and hide, an
-- empty result and never an error, so a screen that forgets its own gate shows
-- nothing rather than everything — and no rows for anyone but the sport
-- scientist (D-02: analytics is theirs alone; defence in depth under the
-- page's refusal). The tier is read from organisations by auth_org_is_premium()
-- (0061), not from the JWT, so a downgrade or an upgrade applies at once.
--
-- IT DISPATCHES ON THE SOURCE TABLE, NOT A KEY PREFIX. 0094's argument, and
-- Isabella's instruction again today: what makes a measure a GPS measure is
-- where its numbers come from. metric_definitions.source_table names the
-- tables; the function takes the same names and refuses any other.
--
-- THE ROWS. One row per athlete per day per source row (gym: per session
-- log, its live working sets summed), with the source's numeric columns as
-- one jsonb object, so the four sources share a return type and the app's
-- per-day collapse needs no branch. The in_data denominator (0120) and the
-- roster (not deleted, not left) are applied here, once. Gym sets count only
-- while live (superseded_by null on the set as well as its session — MET-041's
-- "live sets"); warm-ups are excluded. GPS rows date on record_date, returned
-- as entry_date.

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
         and g.record_date between p_from and p_to
         and (p_athlete_id is null or g.athlete_id = p_athlete_id)
         and a.in_data and a.deleted_at is null and a.status <> 'left_club';
  else
    raise exception 'analytics_daily_rows: unknown source_table %', p_source_table using errcode = '22023';
  end if;
end;
$$;
comment on function public.analytics_daily_rows(text, date, date, uuid) is
  'The analytics destination''s one read (PATTERN-S7 C6, premium at the database 14 Sept 2026). No rows unless the club is premium (auth_org_is_premium, 0119''s mechanism) and the caller is the sport scientist (D-02); dispatches on metric_definitions.source_table, never a key prefix. 0125.';

revoke all on function public.analytics_daily_rows(text, date, date, uuid) from public;
grant execute on function public.analytics_daily_rows(text, date, date, uuid) to authenticated, service_role;
