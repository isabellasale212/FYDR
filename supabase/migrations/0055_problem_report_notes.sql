-- 0055_problem_report_notes.sql
--
-- What this does
--   Gives the club's medic somewhere to record what they did about an
--   athlete-submitted problem report. Migration 0040 built the report and the
--   status walk (open -> acknowledged -> closed) but gave medical no way to
--   write anything down: the triage inbox on the injuries screen could only
--   acknowledge and close, so "rang him Wednesday, tightness on the bike only,
--   watching Thursday" had nowhere to live except somebody's memory. This adds
--   that, for any athlete's report, which is the request as the medic put it.
--
-- Why a separate TABLE, and not a note column on problem_reports
--   This is the whole design, so it is worth being explicit. problem_reports
--   carries problem_reports_athlete_select (0040): the athlete reads their OWN
--   report row back, deliberately — the visible status is the trust loop the
--   athlete-side screen exists to close. PostgreSQL RLS is ROW-level. It cannot
--   hide a column from a role that is allowed the row. A note column on
--   problem_reports would therefore be readable by the athlete it is written
--   about through one direct PostgREST column select, no matter what the staff
--   UI chose to render. 0040's own header names exactly this failure mode ("one
--   careless select * away"), and ADR-007 forbids column-filtered sensitivity
--   inside a single table as a general rule. So the split is structural, the same
--   way injuries (coach-visible) and injury_clinical (medical-only) are already
--   split under CLAUDE.md rule 3 — a different table with a different policy set,
--   never a filter applied in the application layer.
--
-- Who can see it — narrower than the report, never wider
--   Medical only, org-scoped, for both read and write. Everyone else, including
--   the reporting athlete, gets nothing: no body, no count, no existence.
--   - The athlete: this is the point of the table. 0040 promises the athlete
--     their report goes to medical staff and shows them its status; it does not
--     promise them the physio's working notes about it, and a note that the
--     athlete can read is a different artefact with different professional
--     consequences (it would be written differently, or not at all). If an
--     athlete-facing message is ever wanted, that is a new, separately named
--     column or table that says so — not this one widened.
--   - Coach and admin: they have zero access to problem_reports itself (0040's
--     header explains why at length, and the table comment records it). A note
--     about a report is strictly more sensitive than the report, so anything
--     less than zero access here would be incoherent.
--
-- An append log, not one field
--   Multiple notes per report over time, newest appended, none overwritten. That
--   is how triage actually proceeds — an initial assessment, a call, a review
--   after Thursday's session — and it gives the history for free. There is
--   deliberately NO update policy and no update grant for authenticated: once
--   written, a note is a record, the same spirit as 0040's immutable report body
--   and CLAUDE.md rule 6 on entries. A correction is a new note that says so.
--   Because there is no update grant at all, an attempted UPDATE raises 42501
--   rather than silently matching zero rows — the tests assert that.
--
-- Not a clinical record
--   Same boundary 0040 draws and CLAUDE.md §7 states: Fydr records availability,
--   not clinical notes as a legal record. This is a triage trail against one
--   athlete statement. Diagnosis and treatment still belong in injury_clinical,
--   reached through the injury record, where the read is audited.

create table problem_report_notes (
  id           uuid primary key default gen_random_uuid(),
  -- Rule 1. Denormalised from the parent report deliberately: every policy on
  -- this table keys off it directly, so no policy needs to join to a table the
  -- reading role might not be allowed to see.
  org_id       uuid not null references organisations(id),
  report_id    uuid not null references problem_reports(id),

  -- The medic's own words about the report. Bounded the same way 0040 bounds
  -- the athlete's, for the same reason: this stays a note, not a document.
  body         text not null,

  created_by   uuid not null references users(id),
  created_at   timestamptz not null default now(),
  -- Rule 4: never hard-deleted. No authenticated role can set this — there is no
  -- update policy and no update grant at all — so only the audited service-role
  -- erasure path can, exactly as 0040 arranges for problem_reports.
  deleted_at   timestamptz,

  check (char_length(body) <= 1000 and btrim(body) <> '')
);

comment on table problem_report_notes is
  'Medical''s own triage notes against an athlete''s problem_report (migration '
  '0040). MEDICAL ONLY, for read and write, org-scoped: the reporting athlete '
  'cannot read notes about their own report, and coach and admin have no access '
  'at all, matching problem_reports itself. Deliberately a separate table rather '
  'than a column on problem_reports, because that table grants the athlete a row '
  'select and RLS cannot hide a column from a role allowed the row — see this '
  'migration''s header and ADR-007. Append-only: no update path for any '
  'authenticated role, a correction is a new note. Erasure via the audited '
  'service path only.';

-- The triage inbox lookup: every note on the reports on screen, oldest first,
-- which is the order an append log is read in.
create index problem_report_notes_report
  on problem_report_notes (report_id, created_at)
  where deleted_at is null;

alter table problem_report_notes enable row level security;
revoke all on public.problem_report_notes from public, anon, authenticated;
-- No update and no delete for authenticated: a note is a record (see header) and
-- rule 4. Both raise 42501, and the tests assert that code.
grant select, insert on public.problem_report_notes to authenticated;
grant select, insert, update, delete on public.problem_report_notes to service_role;

-- Medical reads its own organisation's notes. There is no other select policy on
-- this table, so every other role — athlete included, on their own report —
-- reads nothing.
create policy problem_report_notes_medical_select on public.problem_report_notes for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[]));

-- Medical appends a note, in their own name, to a report that really is one of
-- their own organisation's.
--
-- created_by = auth_user_id() is enforced here in the WITH CHECK rather than by a
-- trigger: 0040 needed a trigger for its stamps because they arrive on an UPDATE,
-- where a policy cannot see OLD values or which columns moved. An insert has no
-- such problem, so the row-level check is sufficient and is the whole rule.
--
-- The exists() is the cross-tenant guard that org_id alone does not give: without
-- it, orgb's medic could pass their OWN org_id and orga's report_id and hang a
-- note off another organisation's report. The subquery runs as the calling user
-- and is therefore subject to problem_reports' own RLS, so it finds the report
-- only for a medic in the org that owns it. Same shape as 0051's
-- meal_library_items parent check.
create policy problem_report_notes_medical_insert on public.problem_report_notes for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['medical']::app_role[])
    and created_by = auth_user_id()
    and deleted_at is null
    and exists (
      select 1 from problem_reports pr
      where pr.id = report_id
        and pr.org_id = auth_org_id()
        and pr.deleted_at is null
    )
  );

-- No update policy and no delete policy, for anybody. See the header: a written
-- note is a record, and erasure is the audited service-role path only.


-- ---------------------------------------------------------------------------
-- Starter data: one note against the single seeded report, so the demo org's
-- triage inbox shows the notes affordance in its non-empty state.
--
-- 0040 seeds exactly one report — Adam Selby's headaches after the bike session,
-- acknowledged by the club physio Ruth Callaghan three hours later. This is the
-- note she would have written when she acknowledged it, stamped to her and to
-- the same moment, so the seeded story stays coherent rather than gaining a note
-- that predates its own acknowledgement.
-- ---------------------------------------------------------------------------

insert into problem_report_notes
  (id, org_id, report_id, body, created_by, created_at)
values
  ('fa0c0000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001',
   'fa0b0000-0000-4000-8000-000000000001',
   'Rang him straight away. Headache came on about an hour after the bike, no visual symptoms, slept fine. Holding him at the current GRTP stage rather than progressing Thursday, reviewing before the session.',
   'e5e20000-0000-4000-8000-00000000000d',
   now() - interval '2 days' + interval '3 hours')
on conflict (id) do nothing;
