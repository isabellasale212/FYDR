-- ---------------------------------------------------------------------------
-- 0065: the half of the role model that ALTER TYPE ... RENAME VALUE could not
-- reach.
--
-- 0063 renamed medical -> medic and admin -> sport_scientist. That rename is
-- genuinely thorough for anything that references the enum by identity: every
-- stored user_roles row, every audit_log.actor_role, and all 93 RLS policies
-- followed it automatically, verified against pg_policies (0 policies name a
-- retired role afterwards).
--
-- It does NOT reach a role name written as a STRING inside a function body,
-- because prosrc is text and Postgres never rewrites it. Nine functions did
-- exactly that, and they broke in two different ways:
--
--   1. auth_roles() filtered the JWT's role list through a hardcoded text
--      allow-list, `where r in ('athlete','coach','medical','admin')`. After
--      the rename that list matches none of the four renamed-or-new roles, so
--      auth_roles() returned {} for every medic, sport scientist, S&C coach
--      and nutritionist, and every policy requiring one of them refused
--      everyone. Silent: no error, just an empty array and a denied read.
--
--   2. Eight others cast a literal to the enum, array['coach','medical']
--      ::app_role[]. 'medical' is no longer a valid label, so the cast raises
--      invalid input value for enum app_role and the function throws on every
--      call. Loud, but equally broken.
--
--   3. default_threshold_set() carries the same dead label inside an ARRAY
--      LITERAL, '{coach,medical}'::app_role[], which a scan for the quoted
--      form 'medical' does not match. It is a notify_roles value, never read
--      by a policy (checked: no policy references notify_roles), so this one
--      is a pure rename to '{coach,medic}' with no change to who may see
--      anything. It is listed here because it broke the same way the casts
--      did, throwing on every call.
--
-- All three fail closed, which is why this is a repair rather than an incident.
-- Found by running the tenancy suite, not by reading the migration: reading
-- 0063 says the rename carries everything, and for policies it does.
--
-- WHAT THE NEW ROLE LISTS MEAN, and why they are not a widening.
--
-- In the four-role model `['coach','medical']` was not a medical check. It was
-- the "is this caller staff?" check, because coach and medical were the only
-- non-admin staff values that existed. seed.sql said so in its own comment:
-- the S&C lead and the nutritionist were both given 'coach' because there was
-- no better value. So mapping that pair onto all five staff roles PRESERVES
-- the access those people already had rather than granting anything new.
--
--   any staff  -> coach, medic, sport_scientist, strength_conditioning,
--                 nutritionist
--   injury     -> medic, sport_scientist only. suspend_assignments_for_rehab
--                 was medical-only and rehab is injury data, so nutritionist
--                 stays out (D-01) and sport scientist is in because a sport
--                 scientist sees everything.
--
-- Each body below is pg_get_functiondef output taken from the live database
-- with ONLY the role array changed, one substitution per function, so the
-- diff cannot carry an accidental behaviour change.
-- ---------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- auth_roles
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_roles()
 RETURNS app_role[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    array(
      select r::public.app_role
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(public.auth_claims() #> '{app_metadata,roles}') = 'array'
            then public.auth_claims() #> '{app_metadata,roles}'
          else '[]'::jsonb
        end
      ) as t(r)
      where r in ('athlete', 'coach', 'medic', 'sport_scientist',
                  'strength_conditioning', 'nutritionist')
    ),
    '{}'::public.app_role[]
  );
$function$
;

-- --------------------------------------------------------------------------
-- compute_leaderboard
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_leaderboard(p_leaderboard_id uuid)
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
$function$
;

-- --------------------------------------------------------------------------
-- resolve_my_assigned_sessions_by_week
-- --------------------------------------------------------------------------
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
$function$
;

-- --------------------------------------------------------------------------
-- resolve_my_programme_sessions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_my_programme_sessions(p_athlete_id uuid)
 RETURNS TABLE(programme_id uuid, programme_name text, programme_type programme_type, block_name text, block_sequence integer, session_id uuid, session_name text, week_number integer, day_number integer, md_offset integer, session_sequence integer)
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

  if v_athlete is null then
    return;
  end if;

  return query
  select distinct p.id, p.name, p.programme_type, b.name, b.sequence,
         s.id, s.name, s.week_number, s.day_number, s.md_offset, s.sequence
  from programme_assignments pa
  join programmes p on p.id = pa.programme_id
  join programme_blocks b on b.programme_id = p.id
  join programme_sessions s on s.block_id = b.id
  where pa.org_id = auth_org_id()
    and pa.status = 'active'
    -- The fix: a draft programme was never excluded here before. Spec says
    -- "A draft programme is invisible to athletes" (programme-builder.md,
    -- Publishing); the code just never enforced it.
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
$function$
;

-- --------------------------------------------------------------------------
-- resolve_nutrition_targets
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_nutrition_targets(p_athlete_ids uuid[], p_from date, p_to date)
 RETURNS TABLE(athlete_id uuid, target_date date, md_offset integer, energy_kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fluid_ml numeric, tolerance_pct numeric, source_scope text, source_id uuid, md_specific boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids uuid[];
begin
  if auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[]) then
    v_ids := p_athlete_ids;
  elsif auth_has_any_role(array['athlete']::app_role[]) then
    v_ids := array[auth_athlete_id()];
  else
    v_ids := array[]::uuid[];
  end if;

  return query
  with days as (
    select d::date as target_date
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  md as (
    select d.target_date,
           (select s.md_offset from sessions s
            where s.org_id = auth_org_id()
              and s.starts_at::date = d.target_date
              and s.deleted_at is null
              and s.md_offset is not null
            order by s.starts_at limit 1) as md_offset
    from days d
  ),
  ath as (select unnest(v_ids) as athlete_id),
  candidates as (
    select
      a.athlete_id           as c_athlete_id,
      m.target_date          as c_target_date,
      m.md_offset            as c_md_offset,
      t.id                   as c_id,
      t.athlete_id           as t_athlete_id,
      t.group_id             as t_group_id,
      t.org_default          as t_org_default,
      t.energy_kcal          as t_energy_kcal,
      t.protein_g            as t_protein_g,
      t.carbs_g              as t_carbs_g,
      t.fat_g                as t_fat_g,
      t.fluid_ml             as t_fluid_ml,
      t.tolerance_pct        as t_tolerance_pct,
      t.effective_from       as t_effective_from,
      case
        when t.athlete_id is not null and t.md_offset is not null then 1
        when t.athlete_id is not null                             then 2
        when t.group_id  is not null and t.md_offset is not null  then 3
        when t.group_id  is not null                              then 4
        when t.org_default and t.md_offset is not null            then 5
        else 6
      end as precedence,
      coalesce(g.sort_order, 0) as group_sort
    from ath a
    cross join md m
    join nutrition_targets t
      on t.org_id = auth_org_id()
     and t.deleted_at is null
     and t.effective_from <= m.target_date
     and (t.effective_to is null or t.effective_to >= m.target_date)
     and (t.md_offset is null or t.md_offset = m.md_offset)
     and (
          t.athlete_id = a.athlete_id
       or (t.group_id is not null and exists (
             select 1 from group_memberships gm
             where gm.athlete_id = a.athlete_id
               and gm.group_id = t.group_id
               and gm.added_at::date <= m.target_date
               and (gm.removed_at is null or gm.removed_at::date > m.target_date)))
       or t.org_default
     )
    left join groups g on g.id = t.group_id
  ),
  ranked as (
    select *, row_number() over (
      partition by c_athlete_id, c_target_date
      order by precedence, group_sort, t_effective_from desc
    ) as rn
    from candidates
  )
  select
    r.c_athlete_id, r.c_target_date, r.c_md_offset,
    r.t_energy_kcal, r.t_protein_g, r.t_carbs_g, r.t_fat_g, r.t_fluid_ml,
    coalesce(r.t_tolerance_pct, 10) as tolerance_pct,
    case
      when r.precedence <= 2 then 'personal'
      when r.precedence <= 4 then 'group'
      when r.precedence <= 6 then 'squad_default'
    end as source_scope,
    r.c_id as source_id,
    (r.precedence in (1,3,5)) as md_specific
  from ranked r
  where r.rn = 1;
end;
$function$
;

-- --------------------------------------------------------------------------
-- resolve_programme_exercises
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_programme_exercises(p_programme_session_id uuid, p_athlete_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(programme_exercise_id uuid, sequence integer, superset_group text, exercise_id uuid, exercise_name text, category exercise_category, sets integer, reps_min integer, reps_max integer, load_basis load_basis, load_value numeric, tempo text, rest_seconds integer, notes text, is_overridden boolean, is_exempt boolean, override_types override_type[], override_reason text, one_rm_linked boolean, resolved_load_kg numeric, one_rm_missing boolean, one_rm_test_date date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid := auth_org_id();
  v_allowed boolean := false;
  v_target_athlete uuid := null;
begin
  if auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::app_role[]) then
    v_allowed := exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = p_programme_session_id and p.org_id = v_org
    );
    -- Staff may ask for a specific athlete's resolution, or pass null for the
    -- squad-generic parent view unchanged from before this migration.
    v_target_athlete := p_athlete_id;
  elsif auth_has_any_role(array['athlete']::app_role[]) then
    v_allowed := exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
        join programme_assignments pa on pa.programme_id = p.id
      where s.id = p_programme_session_id
        and pa.org_id = v_org
        and pa.status = 'active'
        and (
          pa.athlete_id = auth_athlete_id()
          or (pa.group_id is not null and exists (
                select 1 from group_memberships gm
                where gm.athlete_id = auth_athlete_id()
                  and gm.group_id = pa.group_id
                  and gm.removed_at is null))
        )
    );
    -- An athlete resolves only themselves, whatever p_athlete_id the caller
    -- passed — same stance resolve_my_programme_sessions already takes.
    v_target_athlete := auth_athlete_id();
  end if;

  if not v_allowed then
    return;
  end if;

  if v_target_athlete is null then
    return query
    select pe.id, pe.sequence, pe.superset_group, e.id, e.name, e.category,
           pe.sets, pe.reps_min, pe.reps_max, pe.load_basis, pe.load_value,
           pe.tempo, pe.rest_seconds, pe.notes,
           false, false, array[]::override_type[], null::text,
           (e.one_rm_test_definition_id is not null), null::numeric, null::boolean, null::date
    from programme_exercises pe
    join exercises e on e.id = pe.exercise_id
    where pe.programme_session_id = p_programme_session_id
    order by pe.sequence;
    return;
  end if;

  return query
  with pe as (
    select * from programme_exercises where programme_session_id = p_programme_session_id
  ),
  ov as (
    select o.* from exercise_overrides o
    join pe on pe.id = o.programme_exercise_id
    where o.athlete_id = v_target_athlete
      and o.org_id = v_org
      and (o.expires_at is null or o.expires_at > now())
  ),
  resolved as (
    select
      pe.id                                             as pe_id,
      pe.sequence                                        as pe_sequence,
      pe.superset_group                                  as pe_superset,
      coalesce(sub.substitute_exercise_id, pe.exercise_id) as resolved_exercise_id,
      coalesce(vol.sets, pe.sets)                        as r_sets,
      coalesce(vol.reps_min, pe.reps_min)                as r_reps_min,
      coalesce(vol.reps_max, pe.reps_max)                as r_reps_max,
      pe.load_basis                                      as pe_load_basis,
      case when cap.load_value is not null
           then least(pe.load_value, cap.load_value)
           else pe.load_value end                        as r_load_value,
      pe.tempo                                            as pe_tempo,
      pe.rest_seconds                                    as pe_rest,
      pe.notes                                            as pe_notes,
      (ex.id is not null)                                as r_is_exempt,
      (sub.id is not null or vol.id is not null or cap.id is not null or nt.id is not null) as r_is_overridden,
      array_remove(array[
        case when ex.id  is not null then 'exempt'::override_type end,
        case when sub.id is not null then 'substitute'::override_type end,
        case when vol.id is not null then 'volume'::override_type end,
        case when cap.id is not null then 'load_cap'::override_type end,
        case when nt.id  is not null then 'note'::override_type end
      ], null)                                            as r_override_types,
      coalesce(ex.reason, sub.reason, vol.reason, cap.reason, nt.reason) as r_override_reason
    from pe
    left join ov ex  on ex.programme_exercise_id  = pe.id and ex.override_type  = 'exempt'
    left join ov sub on sub.programme_exercise_id = pe.id and sub.override_type = 'substitute'
    left join ov vol on vol.programme_exercise_id = pe.id and vol.override_type = 'volume'
    left join ov cap on cap.programme_exercise_id = pe.id and cap.override_type = 'load_cap'
    left join ov nt  on nt.programme_exercise_id  = pe.id and nt.override_type  = 'note'
  )
  select
    r.pe_id, r.pe_sequence, r.pe_superset,
    e.id, e.name, e.category,
    r.r_sets, r.r_reps_min, r.r_reps_max,
    r.pe_load_basis, r.r_load_value, r.pe_tempo, r.pe_rest, r.pe_notes,
    r.r_is_overridden, r.r_is_exempt, r.r_override_types, r.r_override_reason,
    (e.one_rm_test_definition_id is not null),
    case when r.pe_load_basis = 'percent_1rm' and r.r_load_value is not null and best.value is not null
         then round(r.r_load_value * best.value / 100.0, 1)
         else null end,
    (r.pe_load_basis = 'percent_1rm' and (e.one_rm_test_definition_id is null or best.value is null)),
    best.test_date
  from resolved r
  join exercises e on e.id = r.resolved_exercise_id
  left join lateral (
    select tr.value, tr.test_date
    from test_results tr
    where e.one_rm_test_definition_id is not null
      and tr.athlete_id = v_target_athlete
      and tr.org_id = v_org
      and tr.test_definition_id = e.one_rm_test_definition_id
      and tr.deleted_at is null
      and tr.is_best
    order by tr.test_date desc
    limit 1
  ) best on true
  where not r.r_is_exempt
  order by r.pe_sequence;
end;
$function$
;

-- --------------------------------------------------------------------------
-- revise_training_entry
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revise_training_entry(p_original_id uuid, p_new_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org      uuid := public.auth_org_id();
  v_original public.training_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::public.app_role[]);
  v_new_id   uuid;
  v_before   jsonb;
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_key      text;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.training_entries
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  -- Same narrowing as revise_wellness_entry above; see that function for the
  -- reasoning, which applies here unchanged.
  if not v_is_staff then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first, for the same reason as revise_wellness_entry.
  update public.training_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  -- session_load is not written here on purpose: the training_entries_session_load
  -- trigger (0010) recomputes rpe x duration_min on the inserted row, so a corrected
  -- RPE or duration produces a corrected load without this function knowing the
  -- formula. Unchanged from 0010, restated because a reader of a coach-facing
  -- correction naturally asks where the load went.
  insert into public.training_entries (
    id, org_id, athlete_id, session_id, entry_date,
    rpe, duration_min, comment,
    source, submitted_at, revision_of, created_by
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.session_id,
    v_original.entry_date,
    coalesce((p_payload ->> 'rpe')::numeric,      v_original.rpe),
    coalesce((p_payload ->> 'duration_min')::int, v_original.duration_min),
    coalesce( p_payload ->> 'comment',            v_original.comment),
    v_original.source, now(), v_original.id, public.auth_user_id()
  )
  returning id into v_new_id;

  -- The same in-transaction audit event as revise_wellness_entry; see that function and
  -- this migration's header for the reasoning, which applies here unchanged.
  --
  -- One difference worth naming: session_load is recomputed by a trigger and is NOT a
  -- payload key, so it never appears in `changed`. The audit records what the coach
  -- asked to change (rpe, duration_min); the derived load that followed is on the row.
  v_before := to_jsonb(v_original);
  select to_jsonb(t) into v_after from public.training_entries t where t.id = v_new_id;

  -- The typeof guard is not defensive padding: jsonb_object_keys RAISES on a scalar,
  -- where every other read of p_payload above degrades to null. A caller passing
  -- '"oops"'::jsonb would otherwise write the revision and then fail on the audit, which
  -- is the one shape of failure this whole change exists to prevent.
  if jsonb_typeof(p_payload) = 'object' then
    for v_key in select t.k from jsonb_object_keys(p_payload) as t(k)
    loop
      if v_before ? v_key and (v_before -> v_key) is distinct from (v_after -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
      end if;
    end loop;
  end if;

  if pg_column_size(v_changes) > 8192 then
    v_changes := jsonb_build_object(
      'fields',         (select jsonb_agg(t.k) from jsonb_object_keys(v_changes) as t(k)),
      'values_omitted', true);
  end if;

  perform public.write_audit_event(
    'entry_revision.created',
    'training_entry',
    v_new_id,
    v_original.athlete_id,
    jsonb_build_object(
      'domain',      'training',
      'entry_date',  v_original.entry_date,
      'session_id',  v_original.session_id,
      'superseded',  v_original.id,
      'changed',     v_changes
    )
  );

  return v_new_id;
end;
$function$
;

-- --------------------------------------------------------------------------
-- revise_wellness_entry
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revise_wellness_entry(p_original_id uuid, p_new_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org      uuid := public.auth_org_id();
  v_original public.wellness_entries;
  v_is_staff boolean := public.auth_has_any_role(array['coach','medic','sport_scientist','strength_conditioning','nutritionist']::public.app_role[]);
  v_new_id   uuid;
  v_before   jsonb;
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_key      text;
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_original
  from public.wellness_entries
  where id = p_original_id
    and org_id = v_org
    and superseded_by is null;      -- check 1 (tenancy) and check 3 (linear chain)

  if v_original.id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  -- check 2, narrowed by this migration. Was: athlete-themselves OR staff.
  -- The athlete branch is gone entirely — an athlete calling this for their own
  -- entry now gets the same not_permitted as anyone else. Deliberately checked
  -- AFTER the row lookup so that a staff caller and an athlete caller cannot
  -- distinguish "wrong id" from "not allowed" by timing the two error paths any
  -- differently than 0010 already did.
  if not v_is_staff then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- Close the original first. The partial unique index permits one live row per
  -- athlete per day, so the new revision cannot land until this one is closed. The
  -- foreign key on superseded_by is deferred, which is what makes forward
  -- referencing p_new_id legal.
  update public.wellness_entries
     set superseded_by = p_new_id
   where id = p_original_id;

  -- check 4: identity columns come from the original, never from p_payload.
  -- `source` is copied too, unchanged from 0010: a coach fixing a mis-typed sleep
  -- value does not turn the athlete's self_report into a staff observation. What the
  -- row carries about who did the correcting is created_by, which is the acting
  -- staff user. Both facts matter and they are stored in the two columns that mean
  -- them, rather than one being overwritten to imply the other.
  insert into public.wellness_entries (
    id, org_id, athlete_id, entry_date,
    sleep_hours, sleep_quality, fatigue, soreness, soreness_areas,
    stress, mood, resting_hr, body_mass_kg, comment,
    source, submitted_at, revision_of, created_by
  )
  values (
    p_new_id, v_original.org_id, v_original.athlete_id, v_original.entry_date,
    coalesce((p_payload ->> 'sleep_hours')::numeric,  v_original.sleep_hours),
    coalesce((p_payload ->> 'sleep_quality')::int,    v_original.sleep_quality),
    coalesce((p_payload ->> 'fatigue')::int,          v_original.fatigue),
    coalesce((p_payload ->> 'soreness')::int,         v_original.soreness),
    coalesce(
      case when jsonb_typeof(p_payload -> 'soreness_areas') = 'array'
           then array(select jsonb_array_elements_text(p_payload -> 'soreness_areas'))
      end, v_original.soreness_areas),
    coalesce((p_payload ->> 'stress')::int,           v_original.stress),
    coalesce((p_payload ->> 'mood')::int,             v_original.mood),
    coalesce((p_payload ->> 'resting_hr')::int,       v_original.resting_hr),
    coalesce((p_payload ->> 'body_mass_kg')::numeric, v_original.body_mass_kg),
    coalesce( p_payload ->> 'comment',                v_original.comment),
    v_original.source, now(), v_original.id, public.auth_user_id()
  )
  returning id into v_new_id;

  -- The audit event. See this migration's header for why it lives here rather than in
  -- the caller. Same transaction as the insert: no committed correction is unaudited.
  v_before := to_jsonb(v_original);
  select to_jsonb(w) into v_after from public.wellness_entries w where w.id = v_new_id;

  -- Only the keys the caller actually sent, and only those that actually moved. Driven
  -- off the payload rather than a hand-written field list so a column added to the
  -- insert above cannot quietly stop being audited; `v_before ? v_key` discards any key
  -- that is not a real column, so a caller cannot pad audit_log with invented fields.
  -- The typeof guard is not defensive padding: jsonb_object_keys RAISES on a scalar,
  -- where every other read of p_payload above degrades to null. A caller passing
  -- '"oops"'::jsonb would otherwise write the revision and then fail on the audit, which
  -- is the one shape of failure this whole change exists to prevent.
  if jsonb_typeof(p_payload) = 'object' then
    for v_key in select t.k from jsonb_object_keys(p_payload) as t(k)
    loop
      if v_before ? v_key and (v_before -> v_key) is distinct from (v_after -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('from', v_before -> v_key, 'to', v_after -> v_key));
      end if;
    end loop;
  end if;

  -- 04-data-model.md §13 caps metadata at 16 KB with a check constraint, and `comment`
  -- alone can be 1000 characters twice over. Well short of the cap in practice; if it is
  -- ever reached the event still gets written, carrying which fields changed but not
  -- their old values, because an unwritable audit row would abort a legitimate
  -- correction.
  if pg_column_size(v_changes) > 8192 then
    v_changes := jsonb_build_object(
      'fields',         (select jsonb_agg(t.k) from jsonb_object_keys(v_changes) as t(k)),
      'values_omitted', true);
  end if;

  perform public.write_audit_event(
    'entry_revision.created',
    'wellness_entry',
    v_new_id,
    v_original.athlete_id,
    jsonb_build_object(
      'domain',      'wellness',
      'entry_date',  v_original.entry_date,
      'superseded',  v_original.id,
      'changed',     v_changes
    )
  );

  return v_new_id;
end;
$function$
;

-- --------------------------------------------------------------------------
-- suspend_assignments_for_rehab
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suspend_assignments_for_rehab(p_athlete_id uuid, p_rehab_programme_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid := public.auth_org_id();
begin
  if v_org is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.auth_has_any_role(array['medic','sport_scientist']::public.app_role[]) then
    raise exception 'not_permitted' using errcode = 'P0001';
  end if;

  -- The one precondition that keeps this narrow: it only ever suspends
  -- anything when p_rehab_programme_id genuinely is a rehab programme in
  -- the caller's own org — never a general-purpose "medical may suspend
  -- any assignment" escape hatch.
  if not exists (
    select 1 from public.programmes p
    where p.id = p_rehab_programme_id
      and p.org_id = v_org
      and p.programme_type = 'rehab'
      and p.deleted_at is null
  ) then
    raise exception 'not_a_rehab_programme' using errcode = 'P0001';
  end if;

  update public.programme_assignments
     set status = 'suspended', suspended_reason = 'Rehab programme assigned'
   where org_id = v_org
     and athlete_id = p_athlete_id
     and status = 'active'
     and programme_id <> p_rehab_programme_id;
end;
$function$
;

-- --------------------------------------------------------------------------
-- default_threshold_set
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_threshold_set()
 RETURNS TABLE(name text, description text, domain flag_domain, metric text, comparison threshold_comparison, value numeric, baseline_type baseline_type, baseline_days integer, consecutive_days integer, min_baseline_observations integer, cooldown_days integer, severity flag_severity, notify_roles app_role[], is_active boolean)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  values
    -- The headline rule. z_score against the athlete's own 28-day norm rather than an
    -- absolute readiness number, which is 04-data-model.md §10's whole argument: "an
    -- athlete who consistently sleeps 6.5 hours is not in trouble, an athlete who normally
    -- sleeps 8.5 and slept 6.5 is." consecutive_days 2 so one bad night is not an alert.
    ('Readiness below personal norm',
     'Composite readiness more than 1.5 SD below own 28 day norm',
     'wellness'::public.flag_domain, 'wellness.readiness_score',
     'z_score'::public.threshold_comparison, -1.5::numeric(10,3),
     'personal_rolling'::public.baseline_type, 28, 2, 10, 3,
     'high'::public.flag_severity, '{coach,medic}'::public.app_role[], true),

    ('Sleep dropped',
     'Sleep more than 20 per cent below own 28 day mean, two days running',
     'wellness'::public.flag_domain, 'wellness.sleep_hours',
     'pct_change_below'::public.threshold_comparison, 20::numeric(10,3),
     'personal_rolling'::public.baseline_type, 28, 2, 10, 3,
     'medium'::public.flag_severity, '{coach}'::public.app_role[], true),

    -- Absolute, not personal_rolling, and correctly so: soreness is a 1-5 self-report where
    -- 2-or-below means the same thing for every athlete. baseline_days null and
    -- min_baseline_observations 0 because an absolute rule needs no baseline to be valid.
    -- Safe to ship live in a club's first week despite that, unlike the compliance rule
    -- below: a day with no wellness entry has no soreness value at all, so 0053 treats it
    -- as a gap and the rule needs three REAL self-reports at 2-or-below before it fires.
    ('Soreness elevated',
     'Soreness at 2 or below for three days running',
     'wellness'::public.flag_domain, 'wellness.soreness',
     'below'::public.threshold_comparison, 2::numeric(10,3),
     'absolute'::public.baseline_type, null, 3, 0, 2,
     'medium'::public.flag_severity, '{coach,medic}'::public.app_role[], true),

    -- Absolute, matching what 0052 actually evaluates: `above` is a flat comparison
    -- against this row's own value and never reads a mean or an SD, whatever
    -- baseline_type says. The original row said 'personal_rolling' with
    -- min_baseline_observations 14, which changed nothing about the trip condition and
    -- only made the rule silently dormant for an athlete's first 14 ACWR observations —
    -- see correction (b) in this file's header, and the description, which used to
    -- describe a personal 1SD band this rule has never evaluated.
    -- The new-club protection this looks like it loses, it never had: ACWR itself is
    -- suppressed (NULL, not an estimate) until 21 of the trailing 28 days carry a
    -- training entry, 0052's _threshold_acwr_value, so there is no value to compare
    -- against 1.30 until a club has about a month of real load behind it.
    ('Acute chronic ratio high',
     'Acute:chronic workload ratio above 1.30 — the trailing 7 day load against the 28 day average',
     'gps'::public.flag_domain, 'load.acwr',
     'above'::public.threshold_comparison, 1.30::numeric(10,3),
     'absolute'::public.baseline_type, null, 1, 0, 3,
     'high'::public.flag_severity, '{coach}'::public.app_role[], true),

    -- Low severity and a 7-day cooldown on purpose. A missing wellness entry is an
    -- administrative problem, not a health one, and raising it daily at medium is the
    -- alert-fatigue mechanism 03-flows.md §5 warns about.
    -- SHIPS INACTIVE, and this is the one rule in the set that does. compliance.wellness_7d
    -- is a count, so "no entries" reads as 0 rather than as no observation, and 0 breaches
    -- "below 4" on every day of a club's pre-history. No parameter on this row can tell a
    -- squad that stopped logging from one that has not started — not
    -- min_baseline_observations (the metric is never null, so the count is always full),
    -- not consecutive_days (every prior day breaches too), not 0053's gap tolerance
    -- (there are no gaps in a count). Correction (a) in the header has the whole
    -- argument, including the engine-side follow-up that would let it ship live.
    ('Wellness compliance low',
     'Fewer than four wellness submissions in the last seven days. Starts switched off: '
     'turn it on once the squad has been logging for a couple of weeks, or it will flag '
     'everyone for the entries they had no chance to make yet.',
     'compliance'::public.flag_domain, 'compliance.wellness_7d',
     'below'::public.threshold_comparison, 4::numeric(10,3),
     'absolute'::public.baseline_type, null, 1, 0, 7,
     'low'::public.flag_severity, '{coach}'::public.app_role[], false);
$function$
;
