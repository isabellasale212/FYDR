-- 0040_problem_reports.sql
--
-- What this does
--   Adds problem_reports: the write path behind the athlete app's "Something not
--   right?" card (Today) and "Report a problem" row (Me), both of which have been
--   honest dead ends until now ("Not built yet — email your club"). 03-flows.md §6
--   is the product shape: "Athlete reports a problem from Today tab -> notification
--   to Medical", who then opens the athlete, creates the injury record, sets
--   availability. 10-roadmap.md screen 36 ("Report a problem — route into medical").
--   The row is the athlete's own words plus an optional category; medical
--   acknowledges it (so the athlete can see a person actually looked) and closes it
--   when it has been dealt with.
--
-- Who can see it — the deliberate call, and why coach gets NOTHING
--   01-roles-and-permissions.md §1 gives the athlete capability as "Report a
--   problem or injury concern TO MEDICAL STAFF" — the capability names its reader.
--   The flow diagram in 03-flows.md §6 notifies Medical alone; a coach learns what
--   they need the way that document says they do, through the availability change
--   medical makes after triage ("coach sees what an athlete can do, medical sees
--   why"). A report from a teenage athlete can be about pain, about how they are
--   coping, or about an adult at the club — including a coach — so the promise on
--   the form ("read by your club's medical staff") has to be the literal RLS
--   truth, not a summary of it. The halfway house of "coach sees existence and
--   status but not the body" was considered and rejected: ADR-007 forbids
--   column-filtered sensitivity inside one table ("one careless select * away
--   from a breach"), so existence-only coach visibility would need a second
--   projection table, which is real schema surface for a need no document states.
--   Admin: no access, matching every other per-athlete data column in the §2
--   matrix. Widening later is additive; narrowing later is a breach retrospective.
--
-- What this is NOT
--   - Not the staff-observed concern path (03-flows.md §6's "Coach raises concern
--     on athlete" branch). That is a different author with different visibility
--     rules and no table yet; inserts here are athlete-only on purpose.
--   - Not a clinical record. Medical reads it, then creates the injury record /
--     availability event in the real medical tables. Nothing here is diagnosis.
--   - Not a messaging thread. One report, one acknowledgement, one closure. A
--     follow-up is a new report.
--
-- Immutability and the trigger
--   The body is the athlete's own words and is immutable for every authenticated
--   role once sent — medical acts on the STATUS fields only, stamped with their own
--   user id. RLS cannot express "these columns only" or "stamp must be the acting
--   user" (same reasoning as 0028's column guard), so a BEFORE UPDATE trigger
--   enforces both, plus the one-way status walk: open -> acknowledged -> closed,
--   or open -> closed for a mis-tap/duplicate. No reopen: the athlete files a new
--   report instead, which keeps every medical action attributable to exactly one
--   athlete statement.
--
-- The notification
--   08-notifications.md already catalogues this exact trigger as
--   staff.injury.reported ("An athlete self-reports, or staff raises a concern",
--   audience medical, cannot disable) — see src/lib/notifications/catalogue.ts.
--   No new catalogue id is needed and nothing sends in this build yet, same as
--   every other catalogued notification.

create type problem_report_category as enum ('injury_or_pain', 'wellbeing', 'other');
create type problem_report_status   as enum ('open', 'acknowledged', 'closed');

create table problem_reports (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id),
  athlete_id       uuid not null references athletes(id),

  -- Optional, athlete-chosen, athlete-comprehensible. Null means "didn't say",
  -- which is a real answer and is not defaulted to 'other' on their behalf.
  category         problem_report_category,
  -- The athlete's own words. Bounded so the form stays a report, not a document.
  body             text not null,

  status           problem_report_status not null default 'open',

  created_by       uuid not null references users(id),
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references users(id),
  closed_at        timestamptz,
  closed_by        uuid references users(id),
  -- Rule 4: never hard-deleted. Only the audited service-role erasure path may
  -- ever set this; the trigger below blocks it for every authenticated role.
  deleted_at       timestamptz,

  check (char_length(body) <= 1000 and btrim(body) <> ''),
  -- A stamp is a pair: a time without an actor (or vice versa) is a bug.
  check ((acknowledged_at is null) = (acknowledged_by is null)),
  check ((closed_at is null) = (closed_by is null)),
  -- Status and its timestamps cannot disagree.
  check (status <> 'open'         or (acknowledged_at is null and closed_at is null)),
  check (status <> 'acknowledged' or (acknowledged_at is not null and closed_at is null)),
  check (status <> 'closed'       or closed_at is not null)
);

comment on table problem_reports is
  'Athlete-raised "Report a problem" (03-flows.md §6, roadmap screen 36). The '
  'athlete''s own words, routed to the club''s medical staff and to nobody else: '
  'athlete inserts and reads own; medical reads org-wide and owns the status walk '
  '(open -> acknowledged -> closed); coach and admin have no access at all — see '
  'this migration''s header for why that is the documented product rule, not an '
  'oversight. Body immutable once sent; erasure via the audited service path only.';

-- The staff inbox and its badge: open/acknowledged, newest first.
create index problem_reports_org_status
  on problem_reports (org_id, status, created_at desc)
  where deleted_at is null;

-- The athlete's own "what I've sent and what happened to it" list.
create index problem_reports_athlete
  on problem_reports (org_id, athlete_id, created_at desc)
  where deleted_at is null;

alter table problem_reports enable row level security;
revoke all on public.problem_reports from public, anon, authenticated;
-- No delete for authenticated: rule 4, and the tests assert the 42501.
grant select, insert, update on public.problem_reports to authenticated;
grant select, insert, update, delete on public.problem_reports to service_role;

-- The athlete files their own report, open, in their own name, in their own org.
create policy problem_reports_athlete_insert on public.problem_reports for insert
  to authenticated
  with check (org_id = auth_org_id()
              and athlete_id = auth_athlete_id()
              and created_by = auth_user_id()
              and status = 'open'
              and deleted_at is null);

-- The athlete reads their own reports back, including the status medical set —
-- that visible status IS the trust loop the athlete-side screen exists to close.
create policy problem_reports_athlete_select on public.problem_reports for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

-- Medical reads the whole organisation's reports. Nobody else does; see header.
create policy problem_reports_medical_select on public.problem_reports for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[]));

-- Medical acts on a report. WHICH columns may move, and the stamp honesty, are
-- the trigger's job — row-level policies cannot see columns or OLD values.
create policy problem_reports_medical_update on public.problem_reports for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy for anyone. Soft-delete is service-role erasure only.

create or replace function enforce_problem_report_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Applies unconditionally, same as 0028's column guard: no current_user
  -- escape hatch, because current_user inside a SECURITY DEFINER function
  -- reflects the function's OWNER, not the caller (session_user does not
  -- change, current_user does) — a role check written against current_user
  -- here would silently never fire. If an audited erasure path for
  -- problem_reports is built later, it needs its own SECURITY DEFINER RPC
  -- (the pattern every other erasure mechanic in this schema already uses),
  -- not a raw UPDATE through this guard.

  -- What the athlete wrote, who wrote it, where it lives — immutable. So is
  -- deleted_at: no authenticated role soft-deletes a report.
  if new.org_id            is distinct from old.org_id
     or new.athlete_id     is distinct from old.athlete_id
     or new.category       is distinct from old.category
     or new.body           is distinct from old.body
     or new.created_by     is distinct from old.created_by
     or new.created_at     is distinct from old.created_at
     or new.deleted_at     is distinct from old.deleted_at
  then
    raise exception 'problem_reports: only the status fields may change once a report is sent'
      using errcode = '42501';
  end if;

  if old.status = 'open' and new.status = 'acknowledged' then
    -- The acknowledgement is stamped by the person who made it, nobody else.
    if new.acknowledged_by is distinct from auth_user_id() then
      raise exception 'problem_reports: acknowledged_by must be the acting user'
        using errcode = '42501';
    end if;

  elsif old.status in ('open', 'acknowledged') and new.status = 'closed' then
    if new.closed_by is distinct from auth_user_id() then
      raise exception 'problem_reports: closed_by must be the acting user'
        using errcode = '42501';
    end if;
    -- Closing never rewrites (or invents) the acknowledgement stamp.
    if new.acknowledged_at is distinct from old.acknowledged_at
       or new.acknowledged_by is distinct from old.acknowledged_by
    then
      raise exception 'problem_reports: the acknowledgement stamp cannot change on close'
        using errcode = '42501';
    end if;

  elsif new.status = old.status
        and new.acknowledged_at is not distinct from old.acknowledged_at
        and new.acknowledged_by is not distinct from old.acknowledged_by
        and new.closed_at       is not distinct from old.closed_at
        and new.closed_by       is not distinct from old.closed_by
  then
    -- A true no-op; nothing to police.
    null;

  else
    raise exception 'problem_reports: the only transitions are open -> acknowledged -> closed, or open -> closed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger problem_reports_update_rules
  before update on problem_reports
  for each row
  execute function enforce_problem_report_update_rules();


-- ---------------------------------------------------------------------------
-- Starter data: one acknowledged example, so the demo org's medical inbox and
-- an athlete's own-reports list both show the acknowledged state working.
--
-- Adam Selby (squad n=7) already carries seed.sql's head-injury / GRTP
-- storyline, so his is the one report it is coherent for this org to have on
-- file: reported two days ago, acknowledged by the club physio (Ruth
-- Callaghan) three hours later. Deliberately only one, and deliberately
-- acknowledged rather than open — an open report is exactly what a developer
-- creates live through the athlete app to watch the badge appear.
-- ---------------------------------------------------------------------------

-- GUARDED, and why. This insert used to be a bare `values` row. It names four
-- rows that only seed.sql creates (the org, Adam Selby, the athlete's own login
-- and Ruth Callaghan), so on a database that has never been seeded it does not
-- no-op, it raises a foreign key violation and stops the whole migration run at
-- statement 16. Production never hit it because production was seeded long
-- before 0040 was written. Any NEW environment hit it immediately, which meant
-- the migration set could not build a database from scratch at all: no staging,
-- no CI, no restore. 0039 and 0060 already guard their own starter data this
-- way; this is the same shape, so that a missing parent skips the row instead of
-- failing the run. Where the parents exist the result is byte for byte what the
-- bare `values` produced.
insert into problem_reports
  (id, org_id, athlete_id, category, body, status,
   created_by, created_at, acknowledged_at, acknowledged_by)
select
  'fa0b0000-0000-4000-8000-000000000001'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'a71e0000-0000-4000-8000-000000000007'::uuid,
  'injury_or_pain',
  'The headaches came back yesterday evening after the bike session. Not as bad as two weeks ago, but I thought you should know before Thursday.',
  'acknowledged',
  'e5e20000-0000-4000-8000-000000000107'::uuid,
  now() - interval '2 days',
  now() - interval '2 days' + interval '3 hours',
  'e5e20000-0000-4000-8000-00000000000d'::uuid
where exists (select 1 from organisations o where o.id = 'a0000000-0000-4000-8000-000000000001')
  and exists (select 1 from athletes     a where a.id = 'a71e0000-0000-4000-8000-000000000007')
  and exists (select 1 from users        u where u.id = 'e5e20000-0000-4000-8000-000000000107')
  and exists (select 1 from users        u where u.id = 'e5e20000-0000-4000-8000-00000000000d')
on conflict (id) do nothing;
