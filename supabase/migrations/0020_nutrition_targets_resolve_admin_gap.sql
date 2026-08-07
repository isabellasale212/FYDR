-- 0020_nutrition_targets_resolve_admin_gap.sql
--
-- What this does
--   Closes a real gap in 0019's resolve_nutrition_targets: found while writing this
--   feature's own test file, before it shipped, but a new migration rather than an
--   edit to 0019 either way — CLAUDE.md §5, migrations are additive.
--
-- The gap
--   0019's guard only handled the athlete case: "if the caller is an athlete and
--   not also staff, narrow to their own id" — anything else, including an admin
--   holding no role at all, fell through with p_athlete_ids untouched. An admin is
--   not staff and not an athlete, so that guard's condition was false for them and
--   they would have gotten real resolved targets back for any athlete_id they
--   passed, for a table screens/nutrition-plans.md is explicit gives admin "no
--   access to individual athlete targets by default."
--
-- The fix
--   A whitelist instead of a blacklist: coach and medical get exactly what they
--   asked for (still tenant-scoped by the join's own org_id = auth_org_id()), an
--   athlete gets only themselves regardless of what they asked for, and everyone
--   else — admin, or a caller holding no role at all — gets an empty array, which
--   makes the function return zero rows without a separate "who is this" branch
--   later in the query. The same shape compute_leaderboard already uses for its
--   own admin exclusion (migration 0016): a caller who cannot pass the check
--   simply never enters the population the rest of the function computes over.

create or replace function public.resolve_nutrition_targets(
  p_athlete_ids uuid[],
  p_from        date,
  p_to          date
)
returns table (
  athlete_id    uuid,
  target_date   date,
  md_offset     int,
  energy_kcal   numeric,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  fluid_ml      numeric,
  tolerance_pct numeric,
  source_scope  text,
  source_id     uuid,
  md_specific   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if auth_has_any_role(array['coach','medical']::app_role[]) then
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
$$;
