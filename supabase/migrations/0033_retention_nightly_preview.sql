-- 0033_retention_nightly_preview.sql
--
-- What this does
--   Installs pg_cron and schedules a real nightly job — the specific
--   piece 09-security-and-compliance.md §7's own words ask for ("a
--   nightly Edge Function") that lib/retention/compute.ts's own header
--   named as cut, because this build has no Edge Function deployment
--   wired up. pg_cron needs no such deployment: it is a Postgres
--   extension, already available on this hosted project, that runs a
--   scheduled SQL job inside the database itself.
--
-- Why this job previews and never redacts
--   §7's own words, two paragraphs after the sentence asking for a
--   nightly job: "Retention automation that silently destroys data is
--   worse than no automation. Run it in report-only mode for the first
--   three months in production and read the reports." The spec is
--   explicit that going straight to unattended destructive automation is
--   the wrong rollout, not a shortcut this migration is taking. The
--   actual redaction — real, tested, see lib/retention/compute.ts and
--   the live verification in this session's own build log — stays
--   admin-triggered, with its own mandatory preview-then-confirm gate,
--   exactly the "read the reports" posture §7 asks for. This job is the
--   automated half of that: a report an admin doesn't have to remember
--   to go generate, sitting in audit_log every morning, whether anyone
--   opens Settings that day or not.
--
-- Why it re-implements the counting logic in SQL rather than calling
-- lib/retention/compute.ts
--   That file runs in the Next.js server process, which pg_cron cannot
--   reach — a scheduled job runs inside Postgres itself, with no HTTP
--   surface to call out through. The counting rules are duplicated here
--   deliberately, in plain SQL, doing the same two computations
--   computeRetentionPreview already does for import_batches and injuries
--   (the two categories with a deleted_at column to redact through) —
--   not the three preview-only performance-data categories, which need
--   nothing scheduled since their own "not yet eligible" state changes
--   once a season closes, not once a night passes.
--
-- Why actor_id and actor_role are null on these rows
--   audit_log.actor_id/actor_role are nullable specifically for this
--   case — a system job has no human actor, and inventing one (a fake
--   "system" user row) would be less honest than simply saying there
--   wasn't one. SECURITY DEFINER is what lets this function write to
--   audit_log at all without a JWT/session in context — the same
--   technique migration 0010's own auth_* helper functions already use,
--   applied here for the same reason: a controlled, narrow bypass of the
--   RLS this whole schema otherwise depends on.

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists retention;

create or replace function retention.nightly_preview()
returns void
language plpgsql
security definer
set search_path = public, retention
as $$
declare
  org record;
  import_count bigint;
  injury_count bigint;
begin
  for org in select id from public.organisations where deleted_at is null loop
    select count(*) into import_count
      from public.import_batches
      where org_id = org.id
        and created_at < now() - interval '30 days';

    select count(*) into injury_count
      from public.injuries i
      join public.athletes a on a.id = i.athlete_id
      where i.org_id = org.id
        and i.status = 'closed'
        and i.deleted_at is null
        and i.updated_at < now() - interval '8 years'
        and (
          a.date_of_birth is null
          or age(i.updated_at, a.date_of_birth) >= interval '18 years'
          or (a.date_of_birth + interval '25 years') < now()
        );

    insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
    values (
      org.id,
      null,
      null,
      'retention.nightly_preview',
      'organisation',
      org.id,
      jsonb_build_object(
        'import_batches_eligible', import_count,
        'injuries_eligible', injury_count,
        'note', 'Automated, read-only. No row was modified — see lib/retention/compute.ts for the admin-triggered action that actually redacts.'
      )
    );
  end loop;
end;
$$;

-- 02:15 UTC, after most of Europe's staff are done for the day and
-- before the earliest morning check-in in any timezone this build's
-- seeded clubs use.
select cron.schedule('retention-nightly-preview', '15 2 * * *', $$select retention.nightly_preview()$$);
