-- 0021_programmes.sql
--
-- What this does
--   Creates the gym-programme domain: exercises, programmes built from blocks of
--   sessions of prescribed exercises, assignment to an athlete or a group, and
--   athlete-logged gym work against that prescription. The largest single schema
--   addition this build has made — bigger than leaderboards, bigger than nutrition
--   targets — which is exactly why it was queued behind both of them all session:
--   `10-roadmap.md`'s own ordering, and CLAUDE.md §5's "ask before inventing
--   product behaviour" instinct applied to sizing, not just to undefined cases.
--
-- Which spec sections this implements
--   04-data-model.md §6 (base shape) and §17.1 (the amendment, of which this
--     migration takes only the parts that do not need a Testing domain that does
--     not exist yet — see the cuts below)
--   screens/gym-programmes.md, screens/programme-builder.md, screens/my-programme.md,
--     screens/gym-logging.md — "Roles and access" from each, which is where the
--     coach-owns-gym / medical-owns-rehab split below comes from
--   CLAUDE.md §6: "Assigning a rehab programme suspends each member's gym
--     programme rather than deleting it" — implemented in the query layer's
--     assign function, not schema, but the assignment_status enum's 'suspended'
--     value exists here because of that rule specifically
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - No `exercise_overrides` (per-athlete tailoring: substitute an exercise, cap
--     a load, exempt someone). A real, coach-facing feature and a real cut — every
--     athlete on a programme gets the parent prescription exactly as written this
--     pass. `04-data-model.md` §17.12 calls the set of overrides on a programme
--     "a readable list of which athletes in the squad are carrying something",
--     which is exactly the kind of clinical-adjacent leak this build has been
--     careful about everywhere else — cutting the feature sidesteps having to get
--     that boundary right under time pressure, rather than getting it wrong.
--   - No `programme_change_events` / `programme_change_divergences` (the
--     parent-edit-propagation-with-divergence-tracking system, §17.1). A
--     coach edits a programme and every assignee simply sees the new version
--     next time they open it — no notice, no "3 athletes affected" count, no
--     acknowledgement flow. A real, documented simplification of what is one of
--     the most sophisticated parts of the spec, not an oversight.
--   - `load_basis` keeps `percent_1rm` as a valid enum value, matching the spec
--     exactly, but nothing in this pass can resolve it: `test_definitions` and
--     `test_results` (04-data-model.md §7, its own "17.2 Testing" amendment)
--     do not exist in this schema. A percent_1rm prescription is created same as
--     any other; the athlete-facing session simply shows it unresolved with the
--     honest copy the spec itself specifies for that exact case ("No one rep max
--     on file. Log the load you lift."), never a guess.
--   - No resolve_programme_session the way gym-logging.md's own ADR-006 specifies
--     it (override substitution, 1RM/bodyweight resolution, a five-minute
--     estimated-duration calculation). Two smaller security-definer functions
--     instead — resolve_my_programme_sessions and resolve_programme_exercises —
--     covering exactly what an athlete with no overrides and no percent-based
--     load needs, which given the two cuts above is every athlete this pass can
--     produce.
--   - No global exercise library (`exercises.org_id` stays nullable, matching the
--     column exactly, but nothing seeds a null-org row). Every exercise created
--     this pass belongs to one club. A shared cross-club library is a content
--     decision for someone who runs the product, not a schema gap.
--
-- Learned from 0013, 0017 and repeated correctly since 0018 and 0019: revoke the
-- default public/anon/authenticated privileges before granting narrowly, in this
-- same migration.

create type exercise_category as enum
  ('squat','hinge','push','pull','carry','olympic','plyo','core','mobility','conditioning');
create type programme_type as enum ('gym','rehab','conditioning','nutrition');
create type programme_status as enum ('draft','active','archived');
create type load_basis as enum ('absolute','percent_1rm','percent_bw','rpe','none');
create type assignment_status as enum ('active','suspended','completed','cancelled');
create type gym_log_status as enum ('in_progress','complete','abandoned');

create table exercises (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid references organisations(id),
  name           text not null,
  category       exercise_category not null,
  primary_muscle text,
  equipment      text[],
  is_unilateral  boolean not null default false,
  video_url      text,
  cues           text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table exercises is
  'The movement library. org_id is nullable for a future shared library — this build '
  'never inserts a null-org row, every exercise is club-owned. 04-data-model.md §6.';

create table programmes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  name           text not null,
  programme_type programme_type not null,
  description    text,
  goal           text,
  duration_weeks int,
  is_template    boolean not null default false,
  parent_id      uuid references programmes(id),
  status         programme_status not null default 'draft',
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table programmes is
  'A prescribed plan: gym, rehab, conditioning or nutrition in type, though this build '
  'only ever writes gym or rehab. programme_type is what migration''s own '
  'coach-owns-gym / medical-owns-rehab RLS split below keys off. screens/gym-programmes.md.';

create table programme_blocks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  programme_id   uuid not null references programmes(id) on delete cascade,
  name           text not null,
  sequence       int not null,
  duration_weeks int not null default 4,
  focus          text
);

create table programme_sessions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  block_id    uuid not null references programme_blocks(id) on delete cascade,
  name        text not null,
  week_number int not null,
  day_number  int,
  md_offset   int,
  sequence    int not null
);

create table programme_exercises (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organisations(id),
  programme_session_id  uuid not null references programme_sessions(id) on delete cascade,
  exercise_id           uuid not null references exercises(id),
  sequence              int not null,
  superset_group        text,
  sets                  int not null,
  reps_min              int,
  reps_max              int,
  load_basis            load_basis not null,
  load_value            numeric(6,2),
  tempo                 text,
  rest_seconds          int,
  notes                 text
);

create table programme_assignments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id),
  programme_id     uuid not null references programmes(id),
  athlete_id       uuid references athletes(id),
  group_id         uuid references groups(id),
  starts_on        date not null default current_date,
  ends_on          date,
  status           assignment_status not null default 'active',
  suspended_reason text,
  assigned_by      uuid references users(id),
  created_at       timestamptz not null default now(),
  check (num_nonnulls(athlete_id, group_id) = 1)
);

comment on table programme_assignments is
  'One programme to one athlete or one group. CLAUDE.md §6: assigning a rehab '
  'programme suspends the athlete''s active gym assignment rather than cancelling '
  'it — done in the query layer''s assignProgramme, not a trigger here.';

create table gym_session_logs (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organisations(id),
  athlete_id            uuid not null references athletes(id),
  programme_session_id  uuid references programme_sessions(id),
  session_id            uuid references sessions(id),
  entry_date            date not null default current_date,
  started_at            timestamptz,
  completed_at          timestamptz,
  session_rpe           numeric(3,1),
  total_volume_kg       numeric(10,1),
  status                gym_log_status not null default 'in_progress',
  comment               text,
  source                data_source not null default 'self_report',
  created_at            timestamptz not null default now()
);

comment on table gym_session_logs is
  'Not an ADR-005 immutable entry: a session log has a real in-progress lifecycle '
  '(started, sets added, completed or abandoned) rather than a single point-in-time '
  'submission, so it is updated in place, never revised. 04-data-model.md §6.';

create table gym_set_logs (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organisations(id),
  gym_session_log_id    uuid not null references gym_session_logs(id) on delete cascade,
  programme_exercise_id uuid references programme_exercises(id),
  exercise_id           uuid not null references exercises(id),
  set_number            int not null,
  reps_completed        int,
  load_kg               numeric(6,2),
  rpe                   numeric(3,1),
  rir                   int,
  side                  body_side,
  is_warmup             boolean not null default false,
  volume_kg             numeric(10,2) generated always as
                          (coalesce(reps_completed,0) * coalesce(load_kg,0)) stored,
  logged_at             timestamptz not null default now()
);

create index programmes_org_type on programmes (org_id, programme_type) where deleted_at is null;
create index programme_blocks_programme on programme_blocks (programme_id, sequence);
create index programme_sessions_block on programme_sessions (block_id, week_number, sequence);
create index programme_exercises_session on programme_exercises (programme_session_id, sequence);
create index programme_assignments_athlete on programme_assignments (athlete_id) where status = 'active';
create index programme_assignments_group on programme_assignments (group_id) where status = 'active';
create index gym_session_logs_athlete on gym_session_logs (athlete_id, entry_date desc);
create index gym_set_logs_session on gym_set_logs (gym_session_log_id, set_number);

do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'programmes', 'programme_blocks', 'programme_sessions',
    'programme_exercises', 'programme_assignments', 'gym_session_logs', 'gym_set_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- exercises: the movement library is harmless to read (a name is not squad
-- data), so every authenticated org member reads it, matching groups' own
-- "reading the list is harmless" reasoning in migration 0012. Writing to it is
-- staff only, either role — an exercise is not owned by gym or rehab, a
-- hamstring curl is a hamstring curl regardless of which programme prescribes
-- it, so there is no coach/medical split here the way there is on programmes.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.exercises to authenticated;

create policy exercises_org_select on public.exercises for select
  to authenticated
  using (org_id = auth_org_id());

create policy exercises_staff_insert on public.exercises for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy exercises_staff_update on public.exercises for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (org_id = auth_org_id());


-- ---------------------------------------------------------------------------
-- programmes, programme_blocks, programme_sessions, programme_exercises,
-- programme_assignments: staff (coach, medical) select everything in their
-- org; write is coach for any type, medical for programme_type = 'rehab' only
-- — screens/programme-builder.md's own "Roles and access": "Medical / Physio:
-- Full authoring for programme_type = 'rehab'. Read-only for gym programmes."
-- The pattern is identical to migration 0018's group_memberships carve-out for
-- a rehab group: a permissive policy cannot be narrowed by adding a second one,
-- so each write policy states the full coach-or-medical-for-rehab condition
-- itself rather than layering exclusions.
--
-- No athlete clause on any of these five tables, anywhere, matching
-- programme-builder.md and my-programme.md exactly: "Athlete: No access.
-- Athletes see the resolved output" — through resolve_my_programme_sessions
-- and resolve_programme_exercises below, both security definer, neither of
-- which needs a table-level grant to work.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.programmes to authenticated;

create policy programmes_staff_select on public.programmes for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy programmes_write on public.programmes for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and (
      auth_has_any_role(array['coach']::app_role[])
      or (auth_has_any_role(array['medical']::app_role[]) and programme_type = 'rehab')
    )
  );

create policy programmes_update on public.programmes for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and (
      auth_has_any_role(array['coach']::app_role[])
      or (auth_has_any_role(array['medical']::app_role[]) and programme_type = 'rehab')
    )
  );

grant select, insert, update on public.programme_blocks to authenticated;

create policy programme_blocks_staff_select on public.programme_blocks for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy programme_blocks_write on public.programme_blocks for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

create policy programme_blocks_update on public.programme_blocks for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

grant select, insert, update on public.programme_sessions to authenticated;

create policy programme_sessions_staff_select on public.programme_sessions for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy programme_sessions_write on public.programme_sessions for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_blocks b join programmes p on p.id = b.programme_id
      where b.id = block_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

create policy programme_sessions_update on public.programme_sessions for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_blocks b join programmes p on p.id = b.programme_id
      where b.id = block_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

grant select, insert, update on public.programme_exercises to authenticated;

create policy programme_exercises_staff_select on public.programme_exercises for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy programme_exercises_write on public.programme_exercises for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = programme_session_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

create policy programme_exercises_update on public.programme_exercises for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = programme_session_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

grant select, insert, update on public.programme_assignments to authenticated;

create policy programme_assignments_staff_select on public.programme_assignments for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy programme_assignments_write on public.programme_assignments for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and assigned_by = auth_user_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );

create policy programme_assignments_update on public.programme_assignments for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]))
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from programmes p
      where p.id = programme_id
        and p.org_id = auth_org_id()
        and (
          auth_has_any_role(array['coach']::app_role[])
          or (auth_has_any_role(array['medical']::app_role[]) and p.programme_type = 'rehab')
        )
    )
  );


-- ---------------------------------------------------------------------------
-- gym_session_logs, gym_set_logs: athlete full for their own, self_report
-- only. Staff read every log in the org for context — the same "coach and
-- medical can read an athlete's entries" shape as wellness_entries and
-- training_entries — but no staff write: screens/gym-logging.md is explicit
-- that "staff log on behalf of an athlete from the web dashboard" is "a
-- different surface", one this pass does not build, so there is no
-- staff_entered insert path at all yet, a real, documented gap.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.gym_session_logs to authenticated;

create policy gym_session_logs_staff_select on public.gym_session_logs for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy gym_session_logs_self_select on public.gym_session_logs for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

create policy gym_session_logs_self_insert on public.gym_session_logs for insert
  to authenticated
  with check (org_id = auth_org_id() and athlete_id = auth_athlete_id() and source = 'self_report');

create policy gym_session_logs_self_update on public.gym_session_logs for update
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id())
  with check (org_id = auth_org_id() and athlete_id = auth_athlete_id());

grant select, insert, update on public.gym_set_logs to authenticated;

create policy gym_set_logs_staff_select on public.gym_set_logs for select
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach','medical']::app_role[])
  );

create policy gym_set_logs_self_select on public.gym_set_logs for select
  to authenticated
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from gym_session_logs gsl
      where gsl.id = gym_session_log_id and gsl.athlete_id = auth_athlete_id()
    )
  );

create policy gym_set_logs_self_insert on public.gym_set_logs for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from gym_session_logs gsl
      where gsl.id = gym_session_log_id and gsl.athlete_id = auth_athlete_id()
    )
  );

create policy gym_set_logs_self_update on public.gym_set_logs for update
  to authenticated
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from gym_session_logs gsl
      where gsl.id = gym_session_log_id and gsl.athlete_id = auth_athlete_id()
    )
  )
  with check (org_id = auth_org_id());

-- No delete policy anywhere in this migration. gym_session_logs has an
-- abandoned status for "this did not happen after all" rather than a delete.


-- ---------------------------------------------------------------------------
-- resolve_my_programme_sessions: an athlete's currently active assignment —
-- direct or through a live group membership — and every session in it, across
-- every block. security definer for the same reason resolve_nutrition_targets
-- is (migration 0019/0020): an athlete has no direct select on programmes,
-- programme_blocks or programme_sessions, by design, so an invoker-rights
-- query would resolve nothing for anyone. The guard is the corrected,
-- whitelist shape from migration 0020, not 0019's original blacklist one —
-- written correctly this time because that bug is exactly what a second
-- resolve function in the same session should not repeat.
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
  select p.id, p.name, p.programme_type, b.name, b.sequence,
         s.id, s.name, s.week_number, s.day_number, s.md_offset, s.sequence
  from programme_assignments pa
  join programmes p on p.id = pa.programme_id
  join programme_blocks b on b.programme_id = p.id
  join programme_sessions s on s.block_id = b.id
  where pa.org_id = auth_org_id()
    and pa.status = 'active'
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

revoke all on function public.resolve_my_programme_sessions(uuid) from public;
grant execute on function public.resolve_my_programme_sessions(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- resolve_programme_exercises: the prescribed exercises for one session.
-- Same access shape — staff read any session in their org, an athlete reads a
-- session only if it belongs to a programme they are actually, currently
-- assigned to (checked here, not assumed from the caller passing a plausible
-- id).
-- ---------------------------------------------------------------------------

create or replace function public.resolve_programme_exercises(p_programme_session_id uuid)
returns table (
  programme_exercise_id uuid,
  sequence       int,
  superset_group text,
  exercise_id    uuid,
  exercise_name  text,
  category       exercise_category,
  sets           int,
  reps_min       int,
  reps_max       int,
  load_basis     load_basis,
  load_value     numeric,
  tempo          text,
  rest_seconds   int,
  notes          text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := auth_org_id();
  v_allowed boolean := false;
begin
  if auth_has_any_role(array['coach','medical']::app_role[]) then
    v_allowed := exists (
      select 1 from programme_sessions s
        join programme_blocks b on b.id = s.block_id
        join programmes p on p.id = b.programme_id
      where s.id = p_programme_session_id and p.org_id = v_org
    );
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
  end if;

  if not v_allowed then
    return;
  end if;

  return query
  select pe.id, pe.sequence, pe.superset_group, e.id, e.name, e.category,
         pe.sets, pe.reps_min, pe.reps_max, pe.load_basis, pe.load_value,
         pe.tempo, pe.rest_seconds, pe.notes
  from programme_exercises pe
  join exercises e on e.id = pe.exercise_id
  where pe.programme_session_id = p_programme_session_id
  order by pe.sequence;
end;
$$;

revoke all on function public.resolve_programme_exercises(uuid) from public;
grant execute on function public.resolve_programme_exercises(uuid) to authenticated;
