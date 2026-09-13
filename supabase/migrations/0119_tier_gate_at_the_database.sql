-- The tier gate moves to the database (Isabella, decision batch 13 September
-- 2026: "Keep and hide is currently enforced only in the app: every tier check
-- is app-side and the one database rule lives inside compute_leaderboard, so a
-- base club's GPS data is reachable through a direct API call. This is the same
-- shape as the leaderboard gate already fixed once, and as the default-privilege
-- gap: a rule that looks enforced and is not. The subject access read path
-- stays open as a written, tested exception, because gps_records is
-- deliberately readable on Basic so a SAR can be answered.").
--
-- WHAT IS PREMIUM AT THE DATABASE. The GPS import and everything it writes:
-- gps_records (staff reads, inserts, the upsert's update), import_batches,
-- import_held_rows and athlete_import_aliases (0115). docs/12-product-tiers.md
-- §2: GPS is the Premium upsell; the training report, the analytics bar chart
-- and the GPS boards are its surfaces. The analytics bar chart is a drawing of
-- gym and wellness data every club holds, so it stays an app-side gate: there
-- is no premium ROW to hide, only a premium VIEW. compute_leaderboard's own
-- gate (0094) is unchanged.
--
-- THE RULE. A club's tier is read from organisations by auth_org_is_premium()
-- — 0061's helper, which already gates the Apple Health consent write and
-- reads the table rather than the JWT so an upgrade applies at once — and
-- every staff policy on the four tables gains `and public.auth_org_is_premium()`. Keep and hide
-- (docs/decisions/premium-downgrade.md): the rows stay, the reads stop. A base
-- club's staff SELECT returns no rows — an empty result, never an error — so
-- an app screen that forgets its own gate shows nothing rather than everything.
--
-- THE WRITTEN, TESTED EXCEPTION. Two reads are NOT gated, on purpose, and
-- supabase/tests/740_tier_gate_at_the_database_test.sql asserts both:
--   1. The service role. lib/queries/sarPackAssembly.ts assembles a subject
--      access pack with createAdminClient(), which bypasses RLS, and it must:
--      Article 15 does not lapse when a club stops paying, and the data is
--      kept (premium-downgrade.md). RLS never applied to service_role; this
--      migration changes nothing there and the test pins it.
--   2. The athlete's own rows (gps_records_self_select, 0023). An athlete's
--      right to read what is held about them is theirs, not the club's plan's.
--      The athlete app's premium surfaces (/my-data/boards' GPS boards) stay
--      app-gated as before; the row itself stays readable.
--
-- THE PREVIEW. Fydr staff previewing Basic (lib/tierPreview.ts) do so on the
-- REAL tier at the database: a preview is a view, and the rows a previewing
-- premium admin's queries return are hidden by the app, as before.
--
-- Fail closed: the helper is an equality against 'performance', the same shape
-- lib/tier.ts isPremium() has, so a future third tier value is not premium
-- until somebody says it is. Not re-created here; its comment is widened.

comment on function public.auth_org_is_premium() is
  'True when the caller''s organisation is on the Premium tier. Reads organisations.tier, '
  'not the JWT, so an upgrade applies immediately. Fails closed to Basic. 12-product-tiers.md §8. '
  '0061: the Apple Health consent write. 0119: the GPS tables — the row-level half of keep and '
  'hide (docs/decisions/premium-downgrade.md).';

-- ---------------------------------------------------------------------------
-- gps_records: the staff read, the import's insert and the upsert's update.
-- gps_records_self_select (0023) is deliberately NOT touched — see the header.
-- ---------------------------------------------------------------------------
drop policy if exists gps_records_staff_select on public.gps_records;
create policy gps_records_staff_select on public.gps_records
  as permissive
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[])
    and public.auth_org_is_premium()
  );

drop policy if exists gps_records_staff_insert on public.gps_records;
create policy gps_records_staff_insert on public.gps_records
  as permissive
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and public.auth_org_is_premium()
  );

drop policy if exists gps_records_staff_update on public.gps_records;
create policy gps_records_staff_update on public.gps_records
  as permissive
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and public.auth_org_is_premium()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and public.auth_org_is_premium()
  );

comment on policy gps_records_staff_select on public.gps_records is
  '0119: staff read GPS rows only while the club is on Premium (keep and hide). The athlete''s '
  'own rows (gps_records_self_select) and the service role (the SAR pack) are the written exception.';

-- ---------------------------------------------------------------------------
-- import_batches: the import is Premium.
-- ---------------------------------------------------------------------------
drop policy if exists import_batches_staff_select on public.import_batches;
create policy import_batches_staff_select on public.import_batches
  as permissive
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[])
    and public.auth_org_is_premium()
  );

drop policy if exists import_batches_staff_insert on public.import_batches;
create policy import_batches_staff_insert on public.import_batches
  as permissive
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_has_any_role(array['sport_scientist']::public.app_role[])
    and imported_by = public.auth_user_id()
    and public.auth_org_is_premium()
  );

-- ---------------------------------------------------------------------------
-- import_held_rows and athlete_import_aliases (0115): the import's own tables.
-- ---------------------------------------------------------------------------
drop policy if exists import_held_rows_importer_select on public.import_held_rows;
create policy import_held_rows_importer_select on public.import_held_rows for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and public.auth_org_is_premium());

drop policy if exists import_held_rows_importer_insert on public.import_held_rows;
create policy import_held_rows_importer_insert on public.import_held_rows for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and public.auth_org_is_premium());

drop policy if exists import_held_rows_importer_update on public.import_held_rows;
create policy import_held_rows_importer_update on public.import_held_rows for update
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and public.auth_org_is_premium())
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and public.auth_org_is_premium());

drop policy if exists athlete_import_aliases_importer_select on public.athlete_import_aliases;
create policy athlete_import_aliases_importer_select on public.athlete_import_aliases for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and public.auth_org_is_premium());

drop policy if exists athlete_import_aliases_importer_insert on public.athlete_import_aliases;
create policy athlete_import_aliases_importer_insert on public.athlete_import_aliases for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and created_by = public.auth_user_id() and public.auth_org_is_premium());
