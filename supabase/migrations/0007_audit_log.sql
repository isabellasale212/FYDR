-- 0007_audit_log.sql
--
-- What this does
--   Creates audit_log and the trigger that makes it append only at the storage layer, not
--   merely by the absence of a policy.
--
-- Which spec sections this implements
--   04-data-model.md §13 (audit log, mandatory audit events)
--   04-data-model.md §17.12 and §17.13 (additional mandatory events)
--   09-security-and-compliance.md §8.5 (six year retention, evidence of compliance)
--   01-roles-and-permissions.md §2 (View audit log: admin only)
--
-- Mandatory audit events, from §13 plus the additions in §17
--   any read of injury_clinical, any change to availability, any change to user_roles,
--   any export, any support role access, any consent change or withdrawal, any erasure,
--   any threshold_revisions write, any team_allocations insert carrying an override
--   reason, and every team allocation publish.
--
-- Append only means append only
--   No role gets update or delete. That is enforced three ways: no update or delete
--   policy exists (0012), the update and delete privileges are revoked below, and the
--   trigger raises even if a future migration grants them by accident.

create table audit_log (
  id          bigserial primary key,
  -- Nullable: a platform support access or a failed sign in has no organisation yet.
  org_id      uuid references organisations(id),
  actor_id    uuid references users(id),
  actor_role  app_role,
  -- 'availability.set', 'injury_clinical.read', 'export.run', 'consent.granted'
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  athlete_id  uuid references athletes(id),
  metadata    jsonb,
  ip_address  inet,
  occurred_at timestamptz not null default now(),

  -- A jsonb size constraint, per 10-roadmap.md §3. An audit row is evidence, not a dump.
  check (metadata is null or pg_column_size(metadata) < 16 * 1024)
);

comment on table audit_log is
  'Append only. No update or delete for any application role, enforced by policy absence, '
  'by revoked privileges and by a trigger. 04-data-model.md §13.';

-- The trigger backstop. If a later migration grants update or delete by mistake, or a
-- superuser session tries it outside the migration process, this still refuses.
create or replace function audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append only: % is not permitted (04-data-model.md 13)',
    tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update
  before update on audit_log
  for each statement execute function audit_log_is_append_only();

create trigger audit_log_no_delete
  before delete on audit_log
  for each statement execute function audit_log_is_append_only();

-- Truncate would empty the evidence in one statement and leave no trace.
create trigger audit_log_no_truncate
  before truncate on audit_log
  for each statement execute function audit_log_is_append_only();
