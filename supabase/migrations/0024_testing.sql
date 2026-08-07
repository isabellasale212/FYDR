-- 0024_testing.sql
--
-- What this does
--   Creates the testing domain: test_definitions, test_results, and
--   body_composition, in the amended shape 04-data-model.md §7 and its own
--   §17.2 amendment specify, plus the mark_best_attempt trigger
--   screens/testing.md writes out in full — copied faithfully, because it is
--   already exactly right: best-attempt marking has to be server-side or two
--   clients logging attempts for the same athlete could disagree about which
--   one is best.
--
-- Which spec sections this implements
--   04-data-model.md §7 (base shape) and §17.2 (side_mode, decimal_places,
--     min/max plausible, leaderboard_eligible, sort_order, the natural key)
--   screens/testing.md "Best attempt" (the trigger, verbatim) and "Writes"
--     (is_best_manual, the edit-audit rule — see lib/queries/testing.ts's
--     header for how this pass simplifies that second one)
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - No test_batteries, test_battery_items or session_tests — the
--     "schedule a named, reusable battery on a testing session" layer.
--     Results this pass log directly against a test definition and a date,
--     optionally against an existing sessions row, which is real value
--     (log a result, see history, feed a personal best) without the
--     scheduling machinery on top of it. A real, documented cut, the same
--     size of simplification rehab groups made by cutting rehab programmes.
--   - No global, org_id-null "Fydr standard" test library to copy from —
--     every test_definitions row this pass creates is already org-scoped.
--     The same "no shared library" call gym-programme's exercises made.
--   - No CSV import. Every result is staff_entered through the UI.
--   - is_best_manual exists and the trigger skips a manually-marked row, per
--     the spec, but the audit-on-edit rule is simplified: every edit to an
--     existing result is audited, not only edits after the session is
--     complete or by a different user — over-applying the safeguard rather
--     than under, and simpler to get right.
--
-- Learned from every migration since 0018: revoke the default
-- public/anon/authenticated privileges before granting narrowly, in this
-- same migration.

create type test_category as enum ('strength','power','speed','endurance','mobility','body_comp','skill');
create type side_mode as enum ('bilateral','per_side');

create table test_definitions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organisations(id),
  name                text not null,
  test_category       test_category not null,
  unit                text not null,
  higher_is_better    boolean not null default true,
  protocol            text,
  equipment           text,
  default_attempts    int not null default 1,
  side_mode           side_mode not null default 'bilateral',
  decimal_places      int not null default 1,
  min_plausible       numeric,
  max_plausible       numeric,
  -- Forced false for body_comp by the check below, not by a trigger — a
  -- simpler enforcement of the same rule leaderboards.md and migration
  -- 0016's metric_definitions both already hold: composition data is never
  -- rankable, by construction, not by a screen remembering to ask.
  leaderboard_eligible boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  check (test_category <> 'body_comp' or leaderboard_eligible = false)
);

comment on table test_definitions is
  'What the club measures. Org-scoped only in this pass — no shared '
  '"Fydr standard" library to copy from. 04-data-model.md §7, §17.2.';

create table test_results (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id),
  athlete_id         uuid not null references athletes(id),
  test_definition_id uuid not null references test_definitions(id),
  session_id         uuid references sessions(id),
  test_date          date not null,
  value              numeric(10,3) not null,
  attempt_number     int not null default 1,
  is_best            boolean not null default false,
  is_best_manual     boolean not null default false,
  side               body_side,
  conditions         text,
  source             data_source not null default 'staff_entered',
  recorded_by        uuid references users(id),
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  unique (athlete_id, test_definition_id, test_date, attempt_number, side)
);

comment on table test_results is
  'Staff-entered, not an ADR-005 immutable entry — screens/testing.md is '
  'explicit that CLAUDE.md rule 6 does not apply here, a same-afternoon typo '
  'correction is not an athlete revising a submission. is_best is '
  'trigger-maintained, never set by the client. See mark_best_attempt below.';

create table body_composition (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id),
  athlete_id        uuid not null references athletes(id),
  measured_on       date not null,
  body_mass_kg      numeric(5,2),
  body_fat_pct      numeric(4,1),
  lean_mass_kg      numeric(5,2),
  method            text,
  sum_skinfolds_mm  numeric(6,1),
  recorded_by       uuid references users(id),
  created_at        timestamptz not null default now()
);

create index on test_results (test_definition_id, test_date desc)
  where deleted_at is null and is_best;
create index on test_results (athlete_id, test_definition_id, side, value)
  where deleted_at is null;
create index on body_composition (athlete_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- mark_best_attempt: screens/testing.md's own function, copied verbatim bar
-- the is_best_manual skip the spec's prose calls for but leaves out of its
-- own SQL block.
-- ---------------------------------------------------------------------------

create or replace function public.mark_best_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_higher boolean;
begin
  select higher_is_better into v_higher
  from test_definitions where id = new.test_definition_id;

  update test_results tr
  set is_best = (tr.id = (
    select id from test_results x
    where x.athlete_id = new.athlete_id
      and x.test_definition_id = new.test_definition_id
      and x.test_date = new.test_date
      and x.side is not distinct from new.side
      and x.deleted_at is null
      and x.is_best_manual = false
    order by
      case when v_higher then x.value end desc nulls last,
      case when not v_higher then x.value end asc nulls last,
      x.attempt_number asc
    limit 1))
  where tr.athlete_id = new.athlete_id
    and tr.test_definition_id = new.test_definition_id
    and tr.test_date = new.test_date
    and tr.side is not distinct from new.side
    and tr.deleted_at is null
    and tr.is_best_manual = false;

  return new;
end;
$$;

create trigger test_results_mark_best
  after insert or update of value, deleted_at on test_results
  for each row execute function public.mark_best_attempt();

do $$
declare
  t text;
begin
  foreach t in array array['test_definitions', 'test_results', 'body_composition']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- test_definitions: shared read (a test name and unit is not squad data, the
-- same reasoning exercises got in migration 0021), staff write. Coach and
-- medical are symmetric here — screens/testing.md's own role table: "Medical
-- / Physio: Full, identically. Return-to-play testing is a medical workflow
-- and the same battery is used" — no coach-owns/medical-owns split the way
-- gym and rehab programmes have.
grant select, insert, update on public.test_definitions to authenticated;

create policy test_definitions_org_select on public.test_definitions for select
  to authenticated
  using (org_id = auth_org_id());

create policy test_definitions_staff_insert on public.test_definitions for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy test_definitions_staff_update on public.test_definitions for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

-- test_results: staff full read/write for any athlete. An athlete reads only
-- their own — "Own results only: history, personal bests" — and never
-- writes: results are staff-entered, not self-report.
grant select, insert, update on public.test_results to authenticated;

create policy test_results_staff_select on public.test_results for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy test_results_self_select on public.test_results for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy test_results_staff_insert on public.test_results for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[])
              and recorded_by = auth_user_id());

create policy test_results_staff_update on public.test_results for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy. Soft delete via deleted_at, per the table's own comment
-- and CLAUDE.md rule 4.

-- body_composition: same shape as test_results.
grant select, insert, update on public.body_composition to authenticated;

create policy body_composition_staff_select on public.body_composition for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy body_composition_self_select on public.body_composition for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy body_composition_staff_insert on public.body_composition for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[])
              and recorded_by = auth_user_id());

create policy body_composition_staff_update on public.body_composition for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());
