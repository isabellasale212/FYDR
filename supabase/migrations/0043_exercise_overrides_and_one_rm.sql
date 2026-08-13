-- 0043_exercise_overrides_and_one_rm.sql
--
-- What this does
--   Two real, connected gaps from the gym-programme build, closed together because the
--   second is meaningless without the first:
--
--     1. exercises.one_rm_test_definition_id — the missing link migration 0021's own
--        header named explicitly ("test_definitions and test_results do not exist in
--        this schema"). They exist now (migration 0024). This wires them together —
--        exactly the column 04-data-model.md §17.1 and open question O-254 already
--        specify, unchanged.
--
--     2. exercise_overrides — per-athlete tailoring (exempt / substitute / volume /
--        load_cap / note), the table 04-data-model.md's "Tailoring" block already
--        specifies verbatim and migration 0021's header named as a deliberate, real
--        cut ("every athlete on a programme gets the parent prescription exactly as
--        written"). A squad-generic absolute-kg load is still squad-generic after this
--        migration — that is a product decision (one prescription, applied as written),
--        not a schema gap — but a coach can now actually cap, substitute, exempt or
--        note ONE athlete without it silently reading as a parent-programme edit for
--        everyone else.
--
--   resolve_programme_exercises is dropped and recreated (its return columns change,
--   which `create or replace function` cannot do) to accept an optional p_athlete_id.
--   Passed null (every existing caller), it behaves exactly as before — the squad-generic
--   parent view the staff programme list already renders. Passed an athlete, it resolves
--   that athlete's active overrides on top of the parent, and — for a percent_1rm
--   prescription — a real kilogram figure from test_results, computed as
--   load_value% × their latest is_best result for the exercise's linked test. Never
--   estimated: no linked test, or a linked test with no result, both resolve to an
--   explicit "missing" flag, never a guess (see the function body's own comment and
--   O-389 below).
--
--   resolve_my_programme_sessions gets one line added: `and p.status = 'active'`. It never
--   checked programmes.status before, so a still-drafting programme was already visible to
--   an assigned athlete — a real bug, not a hypothetical one, found by querying this
--   org's own live data while building this migration (all four seeded programmes are
--   `draft` and already fully assigned). Fixed here. The query layer gets a real publish
--   write path (see lib/queries/programmes.ts) and the four live programmes are moved to
--   `active` by a one-off data script alongside this migration, so nothing an athlete could
--   already see goes dark.
--
-- Which spec sections this implements
--   04-data-model.md's "Tailoring" block (exercise_overrides, shape unchanged from the
--     doc) and §17.1 (one_rm_test_definition_id)
--   screens/programme-builder.md "Prescribing" (percent_1rm resolution, "never falls back
--     to a default weight") and "Tailoring" (the five override types, one-per-type-per-
--     athlete-per-element via the unique key, load_cap as a ceiling never a setting)
--   screens/programme-builder.md "Publishing" ("A draft programme is invisible to
--     athletes... Publish sets status = 'active'") — the status half only; see cuts below
--   Open questions O-254 (policy: which exercises get a linked test — left to the coach,
--     per exercise, the same judgement call as any other prescription field) and O-389
--     (should Fydr estimate 1RM from a submaximal set — no; this migration answers it by
--     omission, on purpose: missing stays missing)
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - No programme_change_events / programme_change_divergences. The parent-edit-
--     propagation-with-divergence-tracking system is still the single largest unbuilt
--     part of this spec, and exercise_overrides does not need it to work: a coach who
--     edits a parent prescription an athlete has overridden just keeps writing the same
--     programme_exercises row as before, and the override keeps applying on top,
--     silently, same as before this migration. No "3 athletes affected" notice exists.
--     A real, unchanged gap, documented before and documented again here.
--   - No TailoringMatrix (athlete-by-exercise grid) and no resolve_programme_session_batch.
--     What this migration enables instead is one athlete at a time, resolved through the
--     same function the athlete's own programme already uses — real value (a coach can
--     now answer "what is J. Okafor actually lifting"), reachable from the query layer,
--     not the full matrix.
--   - No DELETE grant on exercise_overrides, matching every other table in this domain
--     (programme_blocks, programme_sessions, programme_exercises carry no delete grant
--     either — deletion of programme structure is a documented, standing gap, not new
--     here). An override is retired by setting `expires_at` to now through the existing
--     UPDATE grant, not by removing the row. A real, consistent simplification of the
--     spec's "Remove override: Delete the row" — the effect (parent value applies again)
--     is the same; the row just stays as a record of what once applied and to whom.
--   - percent_1rm resolves to a real kg figure once an exercise is linked to a test and an
--     athlete has a result. No staleness annotation (O-328's window is still unanswered),
--     no unilateral side handling (O-329), no estimation from a submaximal set (O-389).
--     Missing means missing — "1RM not on file for [athlete]" in the UI — never a guess.
--   - load_cap resolution is a straight `least(parent, cap)` in the parent's own unit, per
--     the spec. It is not unit-aware across load bases (a cap only ever compares against
--     the parent value in whatever basis that row already uses) — the spec's own load_cap
--     does not address cross-basis capping either.
--   - Publishing gets the status flip and the honest athlete-visibility gate, not the
--     "validation set" gym-programme's full Publishing section also describes (name
--     uniqueness, at least one block, block-length checks). A programme with zero
--     exercises can still be published; the athlete simply sees an empty session, same as
--     today.
--
-- Learned from every migration since 0018: revoke the default public/anon/authenticated
-- privileges before granting narrowly, in this same migration.

create type override_type as enum ('exempt', 'substitute', 'volume', 'load_cap', 'note');

alter table exercises
  add column one_rm_test_definition_id uuid references test_definitions(id);

comment on column exercises.one_rm_test_definition_id is
  'Which test_definitions row is this exercise''s 1RM, if any. Null means a percent_1rm '
  'prescription on this exercise can never resolve — the UI blocks selecting percent_1rm '
  'until this is set (open question O-254: no policy on which exercises get one, left to '
  'the coach per exercise, same as any other prescription choice).';

create table exercise_overrides (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organisations(id),
  programme_exercise_id  uuid not null references programme_exercises(id) on delete cascade,
  athlete_id             uuid not null references athletes(id),
  override_type          override_type not null,
  substitute_exercise_id uuid references exercises(id),
  sets                   int,
  reps_min               int,
  reps_max               int,
  load_value             numeric(6,2),
  reason                 text,
  created_by             uuid references users(id),
  created_at             timestamptz not null default now(),
  expires_at             timestamptz,
  unique (programme_exercise_id, athlete_id, override_type)
);

comment on table exercise_overrides is
  'Per-athlete tailoring against one programme_exercises row. 04-data-model.md''s '
  '"Tailoring" block, shape unchanged. An override is retired by setting expires_at, not '
  'by deleting the row — see this migration''s own header for why there is no DELETE '
  'grant. Never selectable by an athlete, at any row, even their own: '
  '04-data-model.md''s divergence-leak paragraph is explicit that the set of overrides '
  'on a programme "is a readable list of which athletes in the squad are carrying '
  'something", and that stands whether or not programme_change_divergences (which the '
  'paragraph is actually about) exists yet. An athlete sees the override''s *effect* '
  'through resolve_programme_exercises, never the row.';

create index exercise_overrides_athlete on exercise_overrides (athlete_id) where expires_at is null;
create index exercise_overrides_exercise on exercise_overrides (programme_exercise_id);

alter table exercise_overrides enable row level security;
revoke all on exercise_overrides from public, anon, authenticated;
grant select, insert, update on exercise_overrides to service_role;
grant select, insert, update on exercise_overrides to authenticated;

-- Staff read every override in the org for context — identical shape to
-- programme_exercises_staff_select: medical reads a gym programme's overrides too,
-- because a physio needs to see whether their own load cap survived a coach's edit
-- (programme-builder.md's own reasoning for the equivalent Divergence tab).
create policy exercise_overrides_staff_select on exercise_overrides for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

-- Write is the same coach-owns-gym / medical-owns-rehab split as every other authoring
-- table in this domain, walked up from programme_exercise_id exactly like
-- programme_exercises_write does from programme_session_id.
create policy exercise_overrides_write on exercise_overrides for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and created_by = auth_user_id()
    and exists (
      select 1 from programme_exercises pe
        join programme_sessions s on s.id = pe.programme_session_id
        join programme_blocks b   on b.id = s.block_id
        join programmes p         on p.id = b.programme_id
      where pe.id = programme_exercise_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

create policy exercise_overrides_update on exercise_overrides for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_exercises pe
        join programme_sessions s on s.id = pe.programme_session_id
        join programme_blocks b   on b.id = s.block_id
        join programmes p         on p.id = b.programme_id
      where pe.id = programme_exercise_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );


-- ---------------------------------------------------------------------------
-- resolve_programme_exercises: dropped and recreated. New optional p_athlete_id, five
-- new output columns (is_overridden, is_exempt, override_types, override_reason,
-- one_rm_linked, resolved_load_kg, one_rm_missing, one_rm_test_date — eight, not five;
-- corrected while writing this comment because it is easy for the count to drift from
-- the column list below and not be caught by anything).
-- ---------------------------------------------------------------------------

drop function if exists public.resolve_programme_exercises(uuid);

create or replace function public.resolve_programme_exercises(
  p_programme_session_id uuid,
  p_athlete_id uuid default null
)
returns table (
  programme_exercise_id uuid,
  sequence         int,
  superset_group   text,
  exercise_id      uuid,
  exercise_name    text,
  category         exercise_category,
  sets             int,
  reps_min         int,
  reps_max         int,
  load_basis       load_basis,
  load_value       numeric,
  tempo            text,
  rest_seconds     int,
  notes            text,
  is_overridden    boolean,
  is_exempt        boolean,
  override_types   override_type[],
  override_reason  text,
  one_rm_linked    boolean,
  resolved_load_kg numeric,
  one_rm_missing   boolean,
  one_rm_test_date date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := auth_org_id();
  v_allowed boolean := false;
  v_target_athlete uuid := null;
begin
  if auth_has_any_role(array['coach','medical']::app_role[]) then
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
$$;

revoke all on function public.resolve_programme_exercises(uuid, uuid) from public;
grant execute on function public.resolve_programme_exercises(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- resolve_my_programme_sessions: one added condition, no signature change, so
-- create or replace is enough this time.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_my_programme_sessions(p_athlete_id uuid)
returns table (
  programme_id         uuid,
  programme_name       text,
  programme_type       programme_type,
  block_name           text,
  block_sequence       int,
  session_id           uuid,
  session_name         text,
  week_number          int,
  day_number           int,
  md_offset            int,
  session_sequence     int
)
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
$$;
