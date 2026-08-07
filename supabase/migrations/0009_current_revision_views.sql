-- 0009_current_revision_views.sql
--
-- What this does
--   Creates the current revision views that every read of "current" entry data goes
--   through, so that superseded rows are excluded once, in one place, rather than by a
--   "where superseded_by is null" that a caller can forget.
--
-- Which spec sections this implements
--   04-data-model.md §17.9 (current revision views)
--   decisions/adr-005-immutable-entries.md rule 3: "every read of current data filters
--   superseded_by is null, enforced by querying views rather than base tables"
--
-- security_invoker = true is load bearing
--   These views must run with the CALLER's privileges so the base table RLS policies in
--   0012 apply unchanged. A view created without it runs as its owner and silently
--   bypasses row level security, which 04-data-model.md §17.16 calls out as "the classic
--   way an RLS policy gets bypassed by accident". Every view in this file is invoker
--   rights. The one deliberate exception in the whole schema is
--   injury_clinical_athlete_view in 0010, which carries its own tenancy and subject
--   predicates and is commented at length for that reason.
--
-- Note on nutrition_entries_current
--   04-data-model.md §17.9 lists three views. nutrition_entries is dormant (CLAUDE.md
--   rule 8) and is not created by these migrations, so its view is not created either.
--   nutrition_checkins is the one nutrition thing an athlete submits and it carries the
--   same revision columns, so it gets the same treatment.

create view wellness_entries_current with (security_invoker = true) as
  select * from public.wellness_entries
  where superseded_by is null;

create view training_entries_current with (security_invoker = true) as
  select * from public.training_entries
  where superseded_by is null;

create view nutrition_checkins_current with (security_invoker = true) as
  select * from public.nutrition_checkins
  where superseded_by is null
    and deleted_at is null;

comment on view wellness_entries_current is
  'Live wellness entries only. ADR-005 rule 3. Read this, never the base table.';

comment on view training_entries_current is
  'Live training entries only. ADR-005 rule 3. Read this, never the base table.';

comment on view nutrition_checkins_current is
  'Live weekly check ins only. ADR-005 rule 3 applied to 04-data-model.md §17.15.';

grant select on wellness_entries_current   to authenticated;
grant select on training_entries_current   to authenticated;
grant select on nutrition_checkins_current to authenticated;
