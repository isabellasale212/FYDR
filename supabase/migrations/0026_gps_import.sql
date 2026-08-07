-- 0026_gps_import.sql
--
-- What this does
--   Adds the one thing migration 0023 deliberately left out: a write path
--   onto gps_records. 0023's own header called this out by name — "no import
--   pipeline is built" — and this migration is that pipeline's database
--   half, scoped the same reduced way lib/queries/gpsImport.ts explains in
--   full.
--
-- Which spec sections this implements
--   screens/imports.md, docs/07-integrations.md — see
--   lib/queries/gpsImport.ts's header for exactly how much of both, and why
--   the answer is "the core mechanic, not the pipeline".
--
-- Deliberately smaller than the full spec, and every cut is real — see
-- lib/queries/gpsImport.ts's header for the complete list. The schema
-- consequence of the two biggest cuts (no staging/review table, no vendor
-- column-mapping) is that this migration adds nothing new: import_batches
-- and vendor_profiles already exist, in the exact shape 04-data-model.md §8
-- specifies, and this pass's reduced import writes straight to gps_records
-- in one step rather than through import_batch_rows staging, so that table
-- (and import_row_status, import_batch_status, athlete_import_aliases —
-- all specified in imports.md's own "Schema changes required", none built
-- here) is not created. What's needed is two grants and two policies.

grant insert on public.gps_records to authenticated;

-- Coach and medical both read every GPS record (migration 0023); the same
-- two roles both write here, matching screens/imports.md's own role table
-- ("Coach / S&C: Full" and "Medical / Physio: Full, identically" — GPS
-- import has no coach-owns/medical-owns split, the same shape testing.md's
-- write access has, not programmes' or rehab's).
create policy gps_records_staff_insert on public.gps_records for insert
  to authenticated
  with check (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

grant insert on public.import_batches to authenticated;

create policy import_batches_staff_insert on public.import_batches for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach','medical']::app_role[])
              and imported_by = auth_user_id());
