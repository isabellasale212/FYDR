-- 0044_generate_compliance_expectations.sql
--
-- What this does
--   Builds the generation mechanism 04-data-model.md §11 and 05-architecture.md §7 both
--   describe in the present tense ("Expectations are generated nightly...") but that has
--   never existed anywhere in this schema. compliance_expectations has had exactly one
--   writer since the project began: supabase/seed.sql's own bulk insert, a one-time
--   snapshot frozen at whatever `current_date` was when seed.sql last ran. Every real
--   session scheduled after that date has generated zero expectation rows ever since —
--   confirmed live: `select org_id, max(expectation_date) from compliance_expectations
--   group by org_id` returns early August for both seeded organisations while
--   `select max(starts_at) from sessions` shows the schedule itself is equally frozen.
--   The athlete's RPE "to do" badge reads "Up to date" not because nothing is owed, but
--   because nothing was ever asked. src/lib/queries/weekTemplates.ts's own header already
--   named this gap explicitly rather than papering over it — this migration is that gap,
--   closed.
--
-- Two functions
--   generate_compliance_expectations(org, date) — the real unit of work. Idempotent,
--   insert-only, callable directly for a backfill or from the nightly job below.
--   generate_compliance_expectations_nightly() — the cron entrypoint. Loops every
--   organisation, and for the ones whose LOCAL time is currently 02:00, generates
--   tomorrow's (and, defensively, today's — see below) expectations.
--
-- Why pg_cron, when the task that produced this migration was briefed to reach for
-- Vercel Cron + a new API route instead
--   That brief's own reasoning was "this is a Vercel deployment with no existing cron
--   infrastructure" — true of Vercel, false of this database. `select extversion from
--   pg_extension where extname = 'pg_cron'` on the live project returns 1.6.4, already
--   installed and already running a real nightly job: migration 0033's
--   retention.nightly_preview(), scheduled with `cron.schedule(...)` and confirmed active
--   in `cron.job` on the live database before this migration was written. There is
--   directly-precedented, already-working cron infrastructure in this exact codebase for
--   the exact scenario docs/05-architecture.md §7 describes for this exact job —
--   `generate_compliance_expectations | 5 * * * * (hourly, :05) | SQL | ...` is that
--   table's own row, naming this job by its real name, as a SQL job, not an Edge
--   Function. Building a parallel HTTP-triggered path (a new API route, a CRON_SECRET
--   bearer convention, a vercel.json this repo has never had) would mean inventing new
--   authentication surface and a network hop for a job the docs already specify as pure
--   SQL, when a same-database, no-new-surface mechanism with a working precedent already
--   exists one migration away. Recorded here rather than silently deviating, per
--   CLAUDE.md §5 ("when the spec and the code disagree... tell the user, because it may
--   be the spec that is out of date" — here the running database, not the docs, turned
--   out to be ahead of the brief). No API route, no vercel.json, no new env var: this
--   migration is the entire fix.
--
-- Why the cron schedule matches 05-architecture.md §7's job table exactly
--   `5 * * * *`, hourly at :05, with the function itself only acting for organisations
--   whose local wall-clock hour is currently 2am — copied verbatim from the doc's own
--   row rather than simplified to a single fixed UTC time, because both currently-seeded
--   organisations share a timezone today but a per-org-local-2am rule is what the doc
--   promises and what stays correct the day a second timezone joins. Same shape as
--   retention.nightly_preview()'s loop-every-org pattern, one migration over.
--
-- Why the nightly job also regenerates TODAY, not only tomorrow
--   05-architecture.md §7's job table says "generate tomorrow's". This migration does
--   that, and also regenerates the local day that has just started at the same 2am tick —
--   free, because the function is idempotent and a no-op against a day that already has
--   its rows, and it is exactly the self-healing behaviour needed if a single 2am tick is
--   ever missed (a deploy, a project pause): the very next tick catches today up instead
--   of leaving a permanent one-day hole that only an operator's manual backfill would
--   ever close.
--
-- The wellness domain: unconditional daily, not gated on the schedule — a judgement call
--   03-flows.md §2 is explicit and heavily emphasised: "no wellness entry is expected on
--   a day the template marks as off... An athlete is not marked non-compliant on a rest
--   day. Get this wrong and every compliance figure in the product is meaningless." A
--   strict reading would gate the wellness expectation on at least one that-day session
--   having requires_wellness = true, the same way today.md's own `noData` "Nothing
--   scheduled today" empty state implies.
--
--   This migration does not do that. It generates one wellness expectation per active
--   athlete per organisation per day, unconditionally, session_id always null — which is
--   what supabase/seed.sql's own reference implementation actually does (04-data-model.md
--   §11's bulk insert: `cross join generate_series(...)` over every day, no session join
--   at all), explicitly the reference this migration was briefed to match. It is also the
--   only rule that keeps the compliance product alive on this live database today: as of
--   this migration, `sessions` has no row at all dated later than 8 August for either
--   organisation — the schedule itself has an equally real, equally undocumented gap,
--   out of this migration's scope to fix — so a session-gated wellness rule would
--   generate zero wellness expectations for every organisation, every day, from 9 August
--   onward, and the athlete's "to do" badge and every wellness compliance tile would stay
--   permanently empty regardless of this fix. Unconditional-daily is what actually
--   un-sticks the live product; session-gated is what the doc's prose actually promises.
--   Recording the disagreement rather than picking silently, per CLAUDE.md §5. A true
--   "day off per the applied week template" rest-day rule is a real product decision this
--   migration does not make.
--
-- training_rpe and gym stay strictly schedule-driven, no divergence here
--   One training_rpe expectation per (session, resolved participant) where
--   sessions.requires_rpe is true — matching seed.sql's own generation (its
--   session_type in ('training','gym','match') filter is exactly "every session type
--   that ever ships with requires_rpe = true in the real week-template data", so this
--   migration reads the actual column instead of hard-coding the type list, which is the
--   more correct source of truth per session-detail.md's own write-path note: "Editing
--   [requires_wellness, requires_rpe] ... regenerates that day's compliance_expectations
--   ... via an RPC that upserts").
--
--   One gym expectation per (session, resolved participant) for session_type = 'gym'
--   sessions specifically — net new versus seed.sql, which never generated this domain
--   at all (`select count(*) from compliance_expectations where domain = 'gym'` was 0 on
--   the live database before this migration, for either organisation, ever) despite
--   docs/screens/squad-status.md's read-side query already having a live domain = 'gym'
--   branch that reads gym_session_logs.status = 'complete', and despite REPORT_DOMAINS in
--   src/lib/queries/reports.ts already including 'gym'. The read side has been waiting
--   for a write side since before this session. A gym-type session getting both a
--   training_rpe row (rate how hard it was) and a gym row (did you log the actual sets)
--   is deliberate: they are two different questions answered by two different tables
--   (training_entries vs gym_session_logs), exactly as squad-status.md's own `done` CTE
--   already treats them.
--
-- Participant resolution
--   Copied from docs/screens/session-detail.md's own "resolved" CTE verbatim: zero
--   session_participants rows for a session means the whole squad; otherwise the union of
--   individually named athletes and members of named groups, membership resolved as at
--   the session's own starts_at because group_memberships is historical.
--
-- Idempotency: check-before-insert, not ON CONFLICT — and why
--   compliance_expectations' real unique constraint is
--   `unique (athlete_id, expectation_date, domain, session_id)` (migration 0006). Every
--   wellness row this migration writes has session_id = null, and Postgres unique
--   constraints do not consider two NULLs equal — `on conflict (athlete_id,
--   expectation_date, domain, session_id) do nothing` would silently NOT catch a second
--   wellness row for the same athlete/date, because session_id IS NULL is never "equal"
--   to another session_id IS NULL as far as a unique index is concerned. Every insert in
--   this migration therefore uses an explicit `where not exists (...)` anti-join keyed on
--   the same four columns with `session_id is not distinct from`, which is NULL-safe. The
--   pre-existing constraint is left as-is (an additive migration to tighten it, e.g. with
--   a coalesce-based unique index, is a real follow-up, not folded in here to keep this
--   migration's diff to exactly the generation mechanism it was briefed to build).
--
-- Never touches a row that already exists
--   Every insert is anti-joined against the live table, never an update. A row a coach
--   has already waived (is_required = false, waived_reason set) is left exactly as it
--   was on every re-run, same guarantee session-detail.md's own write path documents
--   ("It never deletes an expectation that already has a matching entry").
--
-- security definer, execute revoked from anon and authenticated
--   Same discipline as retention.nightly_preview() (migration 0033/0034), but a sharper
--   version of it: that function lives in its own `retention` schema, which never
--   receives Supabase's default-privilege grants at all, so `revoke ... from public` was
--   the whole fix for it. This one lives in `public`, and this project's default ACL on
--   the public schema (`alter default privileges ... grant execute on functions to anon,
--   authenticated, service_role`, checked live via pg_default_acl before writing this
--   migration) grants EXECUTE to anon and authenticated automatically at CREATE FUNCTION
--   time, independent of the schema-wide PUBLIC pseudo-role. `revoke ... from public`
--   alone was tried first, applied, and re-checked against information_schema.routine_
--   privileges — anon and authenticated both still held EXECUTE afterwards, live proof
--   the two mechanisms are different and only one of them is what `... from public`
--   touches. This function writes rows for every athlete in an organisation, not scoped
--   to any one caller, so leaving it reachable through PostgREST's RPC surface —
--   `rpc('generate_compliance_expectations', ...)`, callable by anon with no session at
--   all — would have been a real cross-tenant write hole, not a theoretical one. Revoked
--   from anon and authenticated explicitly, by name, below. service_role keeps EXECUTE:
--   that is the legitimate trusted-server calling path 0012_rls_policies.sql's own
--   comment on this table already names ("Generated nightly by a job running as
--   service_role"), and the service_role key never reaches a browser.

create or replace function public.generate_compliance_expectations(
  p_org_id uuid,
  p_date   date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_tz   text;
  v_inserted integer := 0;
  v_n        integer;
begin
  select timezone into v_org_tz
  from public.organisations
  where id = p_org_id and deleted_at is null;

  if v_org_tz is null then
    raise exception 'org_not_found: %', p_org_id using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- Wellness: one row per active athlete, unconditional on the schedule. See this
  -- migration's own header for why this diverges from 03-flows.md's rest-day language.
  -- ---------------------------------------------------------------------------
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, a.id, p_date, 'wellness'::public.compliance_domain, null, true
  from public.athletes a
  where a.org_id = p_org_id
    and a.deleted_at is null
    and a.status <> 'left_club'
    and not exists (
      select 1 from public.compliance_expectations ce
      where ce.athlete_id = a.id
        and ce.expectation_date = p_date
        and ce.domain = 'wellness'
        and ce.session_id is null
    );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  -- ---------------------------------------------------------------------------
  -- training_rpe and gym: strictly schedule-driven. day_sessions is this organisation's
  -- non-cancelled, non-deleted sessions falling on p_date in the ORGANISATION'S OWN LOCAL
  -- CALENDAR DAY (starts_at at time zone v_org_tz, not a bare UTC ::date cast — the same
  -- timezone correctness the fix plan's Batch 2 items ask for on the read side, applied
  -- here on the write side from the start). resolved is the participant set per session,
  -- copied from session-detail.md's own CTE. candidates is the union of both domains'
  -- expectation rows before the single anti-joined insert below.
  -- ---------------------------------------------------------------------------
  with day_sessions as (
    select s.id, s.session_type, s.requires_rpe, s.starts_at
    from public.sessions s
    where s.org_id = p_org_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and (s.starts_at at time zone v_org_tz)::date = p_date
  ),
  resolved as (
    -- Zero participant rows means the whole squad.
    select ds.id as session_id, ds.session_type, ds.requires_rpe, a.id as athlete_id
    from day_sessions ds
    join public.athletes a
      on a.org_id = p_org_id and a.deleted_at is null and a.status <> 'left_club'
    where not exists (
      select 1 from public.session_participants sp where sp.session_id = ds.id
    )
    union
    select ds.id, ds.session_type, ds.requires_rpe,
           coalesce(sp.athlete_id, gm.athlete_id) as athlete_id
    from day_sessions ds
    join public.session_participants sp on sp.session_id = ds.id
    left join public.group_memberships gm
      on gm.group_id = sp.group_id
     and gm.added_at <= ds.starts_at
     and (gm.removed_at is null or gm.removed_at > ds.starts_at)
    where coalesce(sp.athlete_id, gm.athlete_id) is not null
  ),
  candidates as (
    select athlete_id, 'training_rpe'::public.compliance_domain as domain, session_id
    from resolved
    where requires_rpe
    union
    select athlete_id, 'gym'::public.compliance_domain, session_id
    from resolved
    where session_type = 'gym'
  )
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, c.athlete_id, p_date, c.domain, c.session_id, true
  from candidates c
  where not exists (
    select 1 from public.compliance_expectations ce
    where ce.athlete_id = c.athlete_id
      and ce.expectation_date = p_date
      and ce.domain = c.domain
      and ce.session_id is not distinct from c.session_id
  );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$$;

comment on function public.generate_compliance_expectations(uuid, date) is
  'The generation mechanism 04-data-model.md §11 always described and this schema never '
  'had. Idempotent (check-before-insert, never an update), callable directly for a '
  'backfill or from generate_compliance_expectations_nightly() below. Returns the count '
  'of rows actually inserted.';

revoke execute on function public.generate_compliance_expectations(uuid, date) from public;
revoke execute on function public.generate_compliance_expectations(uuid, date) from anon;
revoke execute on function public.generate_compliance_expectations(uuid, date) from authenticated;


-- ---------------------------------------------------------------------------
-- The cron entrypoint. See this migration's header for the schedule and the
-- today-plus-tomorrow reasoning.
-- ---------------------------------------------------------------------------

create or replace function public.generate_compliance_expectations_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org          record;
  v_today      date;
  v_tomorrow   date;
  v_today_n    integer;
  v_tomorrow_n integer;
begin
  for org in select id, timezone from public.organisations where deleted_at is null loop
    if extract(hour from (now() at time zone org.timezone)) = 2 then
      v_today    := (now() at time zone org.timezone)::date;
      v_tomorrow := v_today + 1;

      v_today_n    := public.generate_compliance_expectations(org.id, v_today);
      v_tomorrow_n := public.generate_compliance_expectations(org.id, v_tomorrow);

      insert into public.audit_log
        (org_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
      values (
        org.id, null, null, 'compliance.expectations_generated', 'organisation', org.id,
        jsonb_build_object(
          'today', v_today, 'today_inserted', v_today_n,
          'tomorrow', v_tomorrow, 'tomorrow_inserted', v_tomorrow_n,
          'note', 'Automated nightly run. 04-data-model.md §11, 05-architecture.md §7.'
        )
      );
    end if;
  end loop;
end;
$$;

comment on function public.generate_compliance_expectations_nightly() is
  'pg_cron entrypoint, scheduled below at 05 * * * * per 05-architecture.md §7''s own '
  'job table row for generate_compliance_expectations. Acts only for organisations whose '
  'local wall-clock hour is currently 2am; generates that local today and tomorrow for '
  'each, idempotently, and logs one audit_log row per organisation per run.';

revoke execute on function public.generate_compliance_expectations_nightly() from public;
revoke execute on function public.generate_compliance_expectations_nightly() from anon;
revoke execute on function public.generate_compliance_expectations_nightly() from authenticated;

select cron.schedule(
  'generate-compliance-expectations',
  '5 * * * *',
  $$select public.generate_compliance_expectations_nightly()$$
);
