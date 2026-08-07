-- 0019_nutrition_targets.sql
--
-- What this does
--   Creates nutrition_targets and resolve_nutrition_targets(), the schema
--   nutrition-guidance.md's own gap note (20-route-map.md "G-4") says is buildable
--   today: "The targets panel is buildable from nutrition_targets. The guidance
--   content panels are not." Built in the already-amended shape from
--   04-data-model.md §17.3 directly — org_default, reason, tolerance_pct,
--   updated_at, deleted_at — rather than replaying the base §5 shape and then the
--   alter nutrition-plans.md specifies against it. There is no earlier version of
--   this table in this schema to migrate forward from.
--
-- Which spec sections this implements
--   04-data-model.md §5 (base shape) and §17.3 (the amendment this migration builds
--     directly, and the reasoning for org_default existing as its own column rather
--     than being inferred from two nulls)
--   screens/nutrition-plans.md "Schema changes required", "Query: resolve targets
--     for the squad over a week" (the function, adapted — see its own header) and
--     "Roles and access" (the RLS split this migration writes)
--   screens/nutrition-guidance.md "Data requirements" (the resolution order an
--     athlete's own read follows, unaltered)
--   20-route-map.md "G-4": nutrition_guidance and meal_ideas are out of scope,
--     unwritten spec (§17.14 "was never written"). This migration does not create
--     either table. See lib/queries/nutritionTargets.ts's header for the full list
--     of what a v1 built from just this table does and does not cover.
--
-- Deliberately smaller than nutrition-plans.md's own screen, and every cut is real:
--   - No Squad tab (the intake-versus-target grid) and no Athlete tab's intake
--     charts or meal-distribution bar. Both need logged intake, and
--     nutrition-guidance.md §9 (dated after nutrition-plans.md) is explicit:
--     "nutrition_entries is not queried by this screen" and stays dormant,
--     CLAUDE.md rule 8 repeats it as a standing rule, not a one-screen decision.
--     Building a grid with a column that can never have data would be worse than
--     not building the grid.
--   - No `organisations.settings.nutrition` object for org-wide tolerance-band
--     defaults. tolerance_pct is per-target only in this pass; a target with it
--     null simply has no tolerance-band feature yet, which is honest given nothing
--     downstream reads it either (that reader is the missing Squad tab above).
--   - No compliance band rendering (the ● ◐ ▲ ○ glyphs) for the same reason.
--
-- Learned from 0013, 0017 and repeated correctly in 0018: revoke the default
-- public/anon/authenticated privileges before granting narrowly, in this same
-- migration, so test:tenancy's "anon holds no privilege" assertion has nothing to
-- find this time either.

create table nutrition_targets (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id),
  athlete_id    uuid references athletes(id),
  group_id      uuid references groups(id),
  -- true only when both of the above are null. A third, explicit fact rather than
  -- inferring "this is the squad default" from two nulls, so a bug that clears one
  -- scope column by accident cannot silently promote a personal or group target
  -- into the org-wide fallback. 04-data-model.md §17.3.
  org_default   boolean not null default false,
  md_offset     int,
  energy_kcal   numeric(7,1),
  protein_g     numeric(6,1),
  carbs_g       numeric(6,1),
  fat_g         numeric(6,1),
  fluid_ml      numeric(7,1),
  -- Per-target compliance band. Nothing in this pass reads it — the screen that
  -- would is cut above — kept because it costs one nullable column now against a
  -- migration later, and a coach who is shown the field can still record intent
  -- even before anything renders it back.
  tolerance_pct numeric(4,1),
  -- Coach-authored context for a personal target, screens/nutrition-plans.md's own
  -- example: "return to play, energy reduced during limited training".
  reason        text,
  effective_from date not null default current_date,
  effective_to   date,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  check (num_nonnulls(athlete_id, group_id) <= 1),
  check (org_default = (athlete_id is null and group_id is null)),
  check (effective_to is null or effective_to >= effective_from)
);

comment on table nutrition_targets is
  'Macro and fluid targets, resolved athlete then group then org default, each '
  'optionally narrowed by md_offset. Never edited once superseded — a new row with '
  'a later effective_from, the same interval style as availability. '
  '04-data-model.md §17.3, screens/nutrition-plans.md.';

-- One live organisation default per md_offset (or the "any day" row, coalesced to
-- -999 so null sorts as its own value rather than colliding across every row).
create unique index nutrition_targets_one_default
  on nutrition_targets (org_id, coalesce(md_offset, -999))
  where org_default and deleted_at is null and effective_to is null;

-- One live row per athlete or group scope per md_offset.
create unique index nutrition_targets_one_live_per_scope
  on nutrition_targets (org_id, coalesce(athlete_id, group_id), coalesce(md_offset, -999))
  where deleted_at is null and effective_to is null;

create index nutrition_targets_org_effective
  on nutrition_targets (org_id, effective_from desc)
  where deleted_at is null;

alter table nutrition_targets enable row level security;
revoke all on public.nutrition_targets from public, anon, authenticated;
grant select, insert, update on public.nutrition_targets to authenticated;
grant select, insert, update, delete on public.nutrition_targets to service_role;

-- screens/nutrition-plans.md "Roles and access": coach and medical both read every
-- target. An athlete does not — "Athletes select their own resolved targets
-- through a view, never the table" — so there is no athlete clause here at all,
-- the resolve function below is their only path in, and it is security definer
-- specifically so that holds even though the table itself never grants them a row.
create policy nutrition_targets_staff_select on public.nutrition_targets for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

-- Coach: full write, any scope.
create policy nutrition_targets_coach_insert on public.nutrition_targets for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach']::app_role[])
              and created_by = auth_user_id());

create policy nutrition_targets_coach_update on public.nutrition_targets for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]))
  with check (org_id = auth_org_id());

-- Medical: personal-scoped targets only, and only for an athlete with an open
-- injury — "return to play nutrition is a medical concern", not a general grant.
-- A medical caller cannot write a group or org-default row at all: neither clause
-- below is satisfiable when athlete_id is null, so there is nothing to gate on a
-- boolean for group_id/org_default the way rehab_assignments' migration had to.
create policy nutrition_targets_medical_insert on public.nutrition_targets for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['medical']::app_role[])
              and created_by = auth_user_id()
              and athlete_id is not null
              and exists (select 1 from injuries i
                          where i.athlete_id = nutrition_targets.athlete_id
                            and i.org_id = auth_org_id()
                            and i.status <> 'closed'));

create policy nutrition_targets_medical_update on public.nutrition_targets for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[])
         and athlete_id is not null
         and exists (select 1 from injuries i
                     where i.athlete_id = nutrition_targets.athlete_id
                       and i.org_id = auth_org_id()
                       and i.status <> 'closed'))
  with check (org_id = auth_org_id());

-- No delete policy. Superseded by a later row, per the table comment, not deleted.


-- ---------------------------------------------------------------------------
-- resolve_nutrition_targets
--
-- screens/nutrition-plans.md's own function, adapted in three ways:
--   1. security definer, not the spec's invoker, and for the identical reason
--     compute_leaderboard already departed from its own spec's invoker in
--     migration 0016: an athlete's own SELECT policy on nutrition_targets does
--     not exist at all (by design, above), so an invoker-rights call from an
--     athlete would resolve nothing, ever, for anyone, including themselves. This
--     function performs, in place of RLS, the one check that matters: an
--     athlete caller is silently narrowed to their own athlete_id no matter what
--     p_athlete_ids carries, before the query runs at all, so there is no path
--     from "athlete calls this" to "athlete reads a squadmate's targets".
--   2. `t.*` in the spec's own candidates CTE duplicates athlete_id (once from
--     the unnested id, once from the target row), which Postgres accepts inside
--     a subquery but refuses to resolve by name from the enclosing query
--     ("column reference athlete_id is ambiguous"). Written out explicitly below
--     instead of select *.
--   3. `coalesce(r.id)` in the spec's own final select is a no-op coalesce over a
--     single argument — written as r.id.
-- ---------------------------------------------------------------------------

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
  v_ids uuid[] := p_athlete_ids;
begin
  if auth_has_any_role(array['athlete']::app_role[])
     and not auth_has_any_role(array['coach','medical','admin']::app_role[]) then
    v_ids := array[auth_athlete_id()];
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

revoke all on function public.resolve_nutrition_targets(uuid[], date, date) from public;
grant execute on function public.resolve_nutrition_targets(uuid[], date, date) to authenticated;
