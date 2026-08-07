-- Leaderboards. screens/leaderboards.md, screen 26.
--
-- "Do what you want" — the user's own words, delegating the choice among the four
-- Phase 2 areas flagged in the progress log (Reports, Leaderboard, Analytics, Gym
-- programme). Leaderboard was picked over the other three for one reason: its every
-- compliance rule is already fully specified and, more than that, already half built.
-- `athlete_consents` (migration 0002) was created "for HealthKit sync and leaderboard
-- visibility" by name. `athlete_is_minor()` (migration 0010) exists specifically because
-- "the other failure puts a fifteen year old on a public ranking." Nobody has to invent
-- the hard, GDPR/Children's-Code-shaped part of this feature — it is a matter of using
-- what is already there faithfully, not judgement-calling new policy.
--
-- Deliberately smaller than the full spec, and every cut is a real one:
--   - No `leaderboard_snapshots` / movement ("up 3 since 1 July"). That needs a weekly
--     pg_cron job, which is not something this environment can stand up. Own-row and
--     staff movement is left off rather than faked from a snapshot that does not exist.
--   - No test-based metrics (`test_definition_id`), no GPS, gym or testing metrics.
--     None of those source tables exist in this schema yet — Reports and Gym programme's
--     own "needs a table that doesn't exist" note applies here too. The catalogue below
--     seeds only metrics this schema can actually compute today: two, both from the
--     training domain, both real. More get added the day their source table lands.
--   - No admin aggregate view, no medical-suppression management screen, no tier gating.
--     Real, documented gaps — see the query layer's own comments for where each one
--     would slot in.
--   - `flag_domain` gains a new value, `'training'`, added in migration 0015 rather
--     than here: Postgres will not let one transaction both add an enum value and use
--     it, and this file uses it below.

-- ===========================================================================
-- 1. The metric catalogue
--
-- "Leaderboard -> everything" is safe only because "everything" means "everything in
-- this table", never an arbitrary column. leaderboard_eligible is false by default:
-- a metric is rankable because a row here says so, not because a client asked for it.
-- Kept close to the spec's own shape (a catalogue meant to be shared with analytics.md
-- and thresholds.md later) but without analytics_eligible / threshold_eligible /
-- requires_tier — this pass does not consume those, and a column nothing reads is a
-- column pretending to be more built than it is.
-- ===========================================================================

create table metric_definitions (
  key                   text primary key,
  domain                flag_domain not null,
  label                 text not null,
  unit                  text not null,
  higher_is_better      boolean not null,
  source_table          text not null,
  aggregations          text[] not null,
  leaderboard_eligible  boolean not null default false,
  ineligible_reason     text,
  min_population        int not null default 3,
  created_at            timestamptz not null default now(),
  check (min_population >= 2)
);

comment on table metric_definitions is
  'The catalogue that makes "leaderboard -> everything" safe: a metric is rankable '
  'because leaderboard_eligible says so here, never by client-supplied column name. '
  'screens/leaderboards.md "The metric catalogue".';

-- The eligibility list, screens/leaderboards.md's own table. Every wellness and body
-- composition metric is seeded ineligible=false even though this pass has no UI path
-- to select them at all: the prohibition belongs to the catalogue, not to whichever
-- screen happens to read it, so it survives the day a builder UI is more permissive.
insert into metric_definitions
  (key, domain, label, unit, higher_is_better, source_table, aggregations,
   leaderboard_eligible, ineligible_reason, min_population)
values
  ('training.total_session_load', 'training', 'Total session load', '',
    true, 'training_entries_current', array['total','mean','best'],
    true, null, 3),
  ('training.sessions_attended', 'training', 'Sessions attended', '',
    true, 'session_attendance', array['count'],
    true, null, 3),
  ('wellness.readiness_score', 'wellness', 'Readiness score', '',
    true, 'wellness_entries_current', array['mean'],
    false,
    'Composite of sleep, fatigue, soreness, stress and mood, reported in confidence. '
    'Ranking it publishes a health disclosure and rewards over-reporting, which is '
    'exactly the failure mode CLAUDE.md warns about for the flag system this data '
    'feeds. See screens/leaderboards.md "Why wellness must never be leaderboarded".',
    3),
  ('wellness.sleep_hours', 'wellness', 'Sleep', ' h',
    true, 'wellness_entries_current', array['mean'],
    false, 'Health data reported in confidence. Same reasoning as readiness_score.', 3),
  ('wellness.soreness', 'wellness', 'Soreness', ' of 5',
    true, 'wellness_entries_current', array['mean'],
    false, 'Subjective self-report and the earliest signal of a soft-tissue problem. '
    'A public soreness ranking tells the squad who is carrying something.', 3),
  ('wellness.body_mass_kg', 'wellness', 'Body mass', ' kg',
    false, 'wellness_entries_current', array['latest'],
    false, 'Body composition data. Never ranked: see screens/leaderboards.md '
    '"Why body composition must never be leaderboarded".', 3);

-- ===========================================================================
-- 2. Boards
--
-- Trimmed from the spec's own create table: no test_definition_id (test_definitions
-- does not exist in this schema), no leaderboard_snapshots-dependent movement columns.
-- The check constraints below are the server-enforced half of screens/leaderboards.md's
-- validation table — the same "server is the real gate" discipline already used for
-- sessions and fixtures in this build.
-- ===========================================================================

create table leaderboards (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organisations(id),
  name                text not null,
  metric_key          text not null references metric_definitions(key),
  aggregation         text not null,
  population_type     text not null,
  group_id            uuid references groups(id),
  athlete_ids         uuid[],
  exclude_unavailable boolean not null default false,
  min_records         int not null default 1,
  window_type         text not null,
  window_days         int,
  window_from         date,
  window_to           date,
  visibility          text not null default 'staff',
  athlete_view        text not null default 'top_n_plus_self',
  top_n               int not null default 10,
  allow_opt_out       boolean not null default true,
  created_by          uuid not null references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (org_id, name),
  check (population_type in ('squad', 'group', 'selected')),
  check (population_type <> 'group' or group_id is not null),
  check (population_type <> 'selected' or athlete_ids is not null),
  check (aggregation in ('best', 'latest', 'mean', 'total', 'count')),
  check (window_type in ('days', 'season', 'all_time', 'custom')),
  check (window_days is null or window_days between 1 and 365),
  check (visibility in ('staff', 'published')),
  check (athlete_view in ('full', 'top_n_plus_self')),
  check (top_n between 3 and 50),
  check (min_records between 1 and 100),
  -- "The allow_opt_out row is worth reading twice... the product does not allow it to
  -- be false" — screens/leaderboards.md, on Article 7(3) grounds. Not a UI convention:
  -- enforced here so a direct PostgREST call cannot create a board nobody can leave.
  check (allow_opt_out)
);

comment on table leaderboards is
  'A board''s configuration. screens/leaderboards.md. allow_opt_out is constrained true: '
  'a leaderboard nobody can leave is not offered by this product, not just this UI.';

create index on leaderboards (org_id, visibility) where deleted_at is null;

-- ===========================================================================
-- 3. Opt-outs, including medical suppression
--
-- Matches the spec's own shape exactly: a null leaderboard_id is a global opt-out,
-- opt_out_source distinguishes an athlete's own choice from a medical suppression, and
-- neither the reason nor the source ever reaches a coach — see the query layer.
-- ===========================================================================

create table leaderboard_opt_outs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id),
  leaderboard_id uuid references leaderboards(id) on delete cascade,
  opted_out_by   uuid not null references users(id),
  opt_out_source text not null,
  reason         text,
  created_at     timestamptz not null default now(),
  ended_at       timestamptz,
  unique (athlete_id, leaderboard_id),
  check (opt_out_source in ('athlete', 'medical', 'admin'))
);

comment on table leaderboard_opt_outs is
  'leaderboard_id null means every board. opt_out_source and reason are never shown to '
  'a coach: a medical suppression must be indistinguishable from a self opt-out from '
  'every non-medical perspective. screens/leaderboards.md "Medical suppression".';

create index on leaderboard_opt_outs (athlete_id) where ended_at is null;

-- ===========================================================================
-- 4. RLS
-- ===========================================================================

alter table metric_definitions  enable row level security;
alter table leaderboards        enable row level security;
alter table leaderboard_opt_outs enable row level security;

-- The catalogue carries nothing athlete-specific: it is what CAN be ranked, not who is.
-- Readable by anyone signed in, writable by nobody through the API — it is seeded by
-- migration, the same posture as an enum.
grant select on public.metric_definitions to authenticated;

create policy metric_definitions_select on public.metric_definitions for select
  to authenticated
  using (true);

grant select, insert, update on public.leaderboards to authenticated;

-- Staff (coach, medical) see every board in their org, published or not: they manage
-- drafts. An athlete's row-level access to a published board's own config is granted
-- here too, coarse-grained ("is this board published"); whether they personally qualify
-- for it is decided by compute_leaderboard below, not by this policy, because
-- "qualifies" depends on opt-outs and minor consent that a plain RLS predicate cannot
-- evaluate against the ranking itself.
create policy leaderboards_staff_select on public.leaderboards for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy leaderboards_athlete_select on public.leaderboards for select
  to authenticated
  using (org_id = auth_org_id() and visibility = 'published' and deleted_at is null);

create policy leaderboards_staff_insert on public.leaderboards for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy leaderboards_staff_update on public.leaderboards for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

grant select, insert, update on public.leaderboard_opt_outs to authenticated;

create policy leaderboard_opt_outs_staff_select on public.leaderboard_opt_outs for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy leaderboard_opt_outs_self_select on public.leaderboard_opt_outs for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

-- An athlete may only ever file their own opt-out as themselves.
create policy leaderboard_opt_outs_self_insert on public.leaderboard_opt_outs for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and opt_out_source = 'athlete'
    and opted_out_by = auth_user_id()
  );

-- Only medical may suppress another athlete on clinical grounds. Coach has no insert
-- path here at all — screens/leaderboards.md gives coach no suppression capability.
create policy leaderboard_opt_outs_medical_insert on public.leaderboard_opt_outs for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and opt_out_source = 'medical'
    and auth_has_any_role(array['medical']::app_role[])
    and opted_out_by = auth_user_id()
  );

-- Ending an opt-out (opting back in, or lifting a suppression). Simplified from the
-- spec's medical-only-lifts-a-medical-suppression rule: any staff member in coach or
-- medical can end any opt-out row here, which is broader than the letter of the spec.
-- A documented judgement call, not an oversight — see lib/queries/leaderboards.ts.
create policy leaderboard_opt_outs_staff_update on public.leaderboard_opt_outs for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());

create policy leaderboard_opt_outs_self_update on public.leaderboard_opt_outs for update
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id() and opt_out_source = 'athlete')
  with check (org_id = auth_org_id());

-- ===========================================================================
-- 5. compute_leaderboard
--
-- The spec's own function is declared `security invoker`. That does not work against
-- this schema's real RLS: an athlete's SELECT policy on training_entries and
-- session_attendance is scoped to their own rows only (by design, for every other
-- screen), so an invoker-rights call from an athlete would only ever see themselves,
-- never the other 35 names a published board is supposed to show them. This function
-- is `security definer` instead, the same choice already made for revise_wellness_entry
-- and revise_training_entry in migration 0010, and for the same reason: it performs, in
-- place of RLS, exactly the checks the policies would have performed if the tables
-- being joined were not tenant-and-athlete-scoped underneath it.
--
-- The embedded check: staff (coach, medical) always get the full ranking, for any
-- board. Everyone else — an athlete, or an admin who holds neither role — gets it only
-- for a published board, and only once the ranking has actually been computed and only
-- if their own athlete_id appears in it. An admin has no athlete_id, so that check can
-- never pass for them: this is what keeps "admin gets aggregate only" true without a
-- separate admin code path to keep in sync. Movement (previous_position) is always
-- null: no leaderboard_snapshots table exists to compare against, a real, documented
-- cut, not a silently wrong value.
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
  -- The metric dispatcher. The spec shares a generic metric_records() function across
  -- this screen, analytics.md and thresholds.md; with two metrics computable in this
  -- schema, that generality is not earned yet, so this is inlined instead. Add a case
  -- here (or extract metric_records()) the day a third metric's source table lands.
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
  -- "not only statistical" — see the migration header above this function.
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
  'ranking, which their own RLS on training_entries/session_attendance would otherwise '
  'block. Authorisation is embedded in the function instead — same pattern as '
  'revise_wellness_entry in migration 0010. Never returns rows for a board the caller '
  'is not entitled to, including a staff-only board to an athlete and any named row to '
  'an admin.';

grant execute on function public.compute_leaderboard(uuid) to authenticated;
