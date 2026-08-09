-- 0037_week_template_apply_tracking.sql
--
-- What this does
--   Adds sessions.template_key and sessions.applied_template_id.
--   week_templates itself has existed since migration 0003 with real RLS
--   (0012) and zero application code reading or writing it — the same
--   shape of gap already found and closed this pass for organisations.tier,
--   session_attendance, and audit_log: real schema, real grants, nothing
--   built on top. screens/md-planner.md O-287 names this exact addition:
--   "sessions.template_key and sessions.applied_template_id do not exist.
--   Without them the applier cannot detect a repeat application or offer a
--   useful undo. I recommend adding both."
--
-- Why applied_template_id and not just template_key
--   template_key is stable *within* a template's own structure (matches a
--   template's own session entry back to the row it created); it says
--   nothing about *which* template. applied_template_id is what lets the
--   template list compute a real "used 14 times, last used 3 Aug" without
--   scanning session titles. Both nullable: every session created outside
--   the planner (the entire real product today) has neither, and that is
--   the correct default, not a migrated-in guess.
--
-- The index
--   The spec's own performance note: "needs create index on sessions
--   (applied_template_id) where deleted_at is null. Without it, the usage
--   count scans the session table per template." Written now, before any
--   real usage makes it matter, same as every other partial index in this
--   schema.

alter table public.sessions add column template_key text;
alter table public.sessions add column applied_template_id uuid references public.week_templates(id);

create index sessions_applied_template_id_idx
  on public.sessions (applied_template_id)
  where deleted_at is null;
