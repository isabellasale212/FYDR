-- 0032_subject_access_pack.sql
--
-- What this does
--   Two new tables backing the Article 15 subject access pack:
--   `sar_requests` (one row per athlete SAR, tracking the statutory
--   one-month deadline and status) and `sar_clinical_reviews` (one
--   permanent, reasoned decision per injury with clinical detail, made by
--   a physio before the pack may be released).
--
-- Which spec section this implements, and how much of it
--   09-security-and-compliance.md §6, "Article 15, right of access", and
--   screens/exports.md's "Admin, subject access pack" section. The full
--   spec is an async worker system: a general `export_jobs` table shared
--   with every other export type, keyset-paginated streaming generation,
--   signed URLs with a storage lifecycle, a `pg_cron` expiry job, and
--   push/email on completion. This build has no worker process and no
--   email/push provider anywhere in it — the same real infrastructure gap
--   already named for scheduled report delivery and for every invite this
--   build sends by handing over a password directly instead. So this pass
--   builds a **synchronous** SAR pack, generated in the request that
--   downloads it, the same shape every other export and PDF in this build
--   already is. What's real and not reduced: the medical review gate, the
--   reason-required-when-withholding rule (enforced by a check
--   constraint, not just client validation), the due-date tracking, and
--   the actual cross-table data gathering — see lib/queries/sarPack.ts.
--
-- Why sar_clinical_reviews has no update or delete policy
--   Same reasoning as audit_log (04-data-model.md §13, migration 0012):
--   a clinician's dated, reasoned decision to include or withhold a
--   specific piece of health data is itself part of the compliance
--   record. If a reviewer needs to change their mind, that is a new,
--   dated decision, not an edit to the old one — the same "corrections
--   create a new row" principle CLAUDE.md rule 6 already applies to
--   wellness, gym and nutrition entries, applied here to a decision
--   rather than a measurement.
--
-- Why sar_requests' insert is admin-only but its update allows medical too
--   Matches exports.md's own framing: "Admin-initiated" — an admin, not
--   medical, is the one fielding a real subject access request and
--   tracking its legal deadline (01-roles-and-permissions.md §1 gives
--   admin, not medical, "Configure data retention and run erasure
--   requests" — the adjacent compliance-process capability). Medical
--   needs to update the same row's status once clinical review is
--   complete, which is why update (not insert) is shared.

create table public.sar_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id),
  athlete_id    uuid not null references public.athletes(id),
  requested_by  uuid not null references public.users(id),
  requested_at  timestamptz not null default now(),
  due_at        timestamptz not null,
  status        text not null default 'pending_review',
  released_by   uuid references public.users(id),
  released_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint sar_requests_status_check check (status in ('pending_review', 'reviewed', 'released'))
);

create table public.sar_clinical_reviews (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id),
  sar_request_id  uuid not null references public.sar_requests(id) on delete cascade,
  injury_id       uuid not null references public.injuries(id),
  decision        text not null,
  reason          text,
  reviewed_by     uuid not null references public.users(id),
  reviewed_at     timestamptz not null default now(),
  constraint sar_clinical_reviews_decision_check check (decision in ('include', 'withhold')),
  -- The one rule 09-security-and-compliance.md §6 is most insistent on:
  -- "Withholding is the exception and requires a positive act by a
  -- clinician." A reason is what makes it positive, not just a click.
  constraint sar_clinical_reviews_reason_required check (decision <> 'withhold' or reason is not null),
  unique (sar_request_id, injury_id)
);

alter table public.sar_requests enable row level security;
alter table public.sar_clinical_reviews enable row level security;
revoke all on public.sar_requests, public.sar_clinical_reviews from public, anon;
grant select, insert, update, delete on public.sar_requests, public.sar_clinical_reviews to service_role;

grant select, insert, update on public.sar_requests to authenticated;
grant select, insert on public.sar_clinical_reviews to authenticated;

create policy sar_requests_staff_select on public.sar_requests for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['admin', 'medical']::public.app_role[]));

create policy sar_requests_admin_insert on public.sar_requests for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and requested_by = public.auth_user_id()
    and public.auth_has_any_role(array['admin']::public.app_role[])
  );

-- Shared by admin (setting released_by/released_at/status='released') and
-- medical (setting status='reviewed'). Not split by column for the same
-- reason 0027's own history already documents: a column-level grant does
-- nothing once authenticated already has broader access, so the actual
-- boundary that matters — which org, which two roles — is what the policy
-- enforces; which of those two fields either role touches is an
-- application-layer concern, the same trust level this app already
-- extends to coach/medical for shared tables like sessions.
create policy sar_requests_staff_update on public.sar_requests for update
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['admin', 'medical']::public.app_role[]))
  with check (org_id = public.auth_org_id());

create policy sar_clinical_reviews_staff_select on public.sar_clinical_reviews for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['admin', 'medical']::public.app_role[]));

create policy sar_clinical_reviews_medical_insert on public.sar_clinical_reviews for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and reviewed_by = public.auth_user_id()
    and public.auth_has_any_role(array['medical']::public.app_role[])
  );

-- No update, no delete policy on sar_clinical_reviews — see header.

create index on public.sar_requests (org_id, status);
create index on public.sar_requests (athlete_id, requested_at desc);
create index on public.sar_clinical_reviews (sar_request_id);
