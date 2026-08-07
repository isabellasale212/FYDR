-- 0023_gps_records.sql
--
-- What this does
--   Creates gps_records and its two supporting tables (import_batches,
--   vendor_profiles), in the exact shape 04-data-model.md §8 specifies, plus
--   the two additive columns (running_distance_m, high_intensity_efforts)
--   screens/training-report.md's own "Schema additions required" calls for —
--   folded into the create table directly, since this is a brand-new table in
--   this schema and there is no earlier version to alter forward from.
--
-- Which spec sections this implements
--   04-data-model.md §8 (gps_records, import_batches, vendor_profiles)
--   screens/training-report.md — the single most design-decision-heavy screen
--     this build has touched. Sixteen open questions (O-700 to O-715) are
--     recorded in that file; every one with a stated recommendation is adopted
--     here as a decision, not left open. See lib/queries/trainingReport.ts's
--     header for the full list of which was adopted and how.
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - import_batches and vendor_profiles are created, per the schema, but
--     nothing in this pass writes to them. There is no CSV upload, no vendor
--     column-mapping UI, no unit-detection-on-import pipeline
--     (07-integrations.md) — that is a separate, large feature in its own
--     right, the same scale of decision the GPS domain itself was queued
--     behind all session. Real GPS data has no path into this table yet
--     except a direct insert, which is exactly how this migration's own
--     verification data gets in, documented as such rather than pretended
--     otherwise.
--   - No automatic threshold-driven flag raising for GPS metrics. 'gps' is
--     already a valid flags.domain value (seeded before this migration), so
--     the training report's FLAGGED tile counts real flags.gps rows if any
--     exist; nothing in this pass creates them automatically.
--
-- Learned from every migration since 0018: revoke the default
-- public/anon/authenticated privileges before granting narrowly, in this same
-- migration.

create table gps_records (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organisations(id),
  athlete_id             uuid not null references athletes(id),
  session_id             uuid references sessions(id),
  record_date            date not null,
  vendor                 text,
  device_id              text,
  duration_s             int,
  total_distance_m       numeric(10,1),
  running_distance_m     numeric(10,1),
  high_speed_distance_m  numeric(10,1),
  sprint_distance_m      numeric(10,1),
  high_intensity_efforts int,
  max_speed_ms           numeric(5,2),
  accelerations          int,
  decelerations          int,
  player_load            numeric(10,2),
  impacts                int,
  metabolic_power_avg    numeric(8,2),
  raw                    jsonb,
  source                 data_source not null default 'file_import',
  import_batch_id        uuid,
  created_at             timestamptz not null default now()
);

comment on table gps_records is
  'One row per athlete per GPS-tracked session. running_distance_m and '
  'high_intensity_efforts are additive columns screens/training-report.md '
  'calls for (O-704, O-705) — vendor-specific bands with no fixed threshold '
  'defined by this build; null until a real import maps them. '
  '04-data-model.md §8.';

create table import_batches (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  filename       text,
  vendor_profile_id uuid,
  row_count      int,
  accepted_count int,
  rejected_count int,
  errors         jsonb,
  imported_by    uuid references users(id),
  created_at     timestamptz not null default now()
);

create table vendor_profiles (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organisations(id),
  vendor                text not null,
  column_map            jsonb not null,
  unit_map              jsonb not null default '{}'::jsonb,
  athlete_match_column  text not null default 'Player Name',
  created_at            timestamptz not null default now()
);

alter table gps_records add constraint gps_records_import_batch_fk
  foreign key (import_batch_id) references import_batches(id);
alter table import_batches add constraint import_batches_vendor_profile_fk
  foreign key (vendor_profile_id) references vendor_profiles(id);

create index on gps_records (org_id, record_date, athlete_id);
create index on gps_records (org_id, record_date) include (high_speed_distance_m, high_intensity_efforts);
create index on gps_records (org_id, session_id) where session_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['gps_records', 'import_batches', 'vendor_profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- Coach and medical both read every record — screens/training-report.md's own
-- "Roles and access": "Medical: Full... GPS output is not clinical data." No
-- staff insert/update policy exists yet, matching the "no import pipeline"
-- cut above; when that feature is built it needs its own write policy, not an
-- assumption that read access implies write access.
grant select on public.gps_records to authenticated;

create policy gps_records_staff_select on public.gps_records for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

-- screens/training-report.md's own role table: "Athlete: No access [to this
-- board]. An athlete sees their own GPS data in my-data.md" — that other
-- screen is not built in this pass, but the entitlement is real, so the
-- self-select grant exists ahead of any UI consuming it, the same order
-- other tables in this build have followed when a read is owed but the
-- screen for it isn't built yet.
create policy gps_records_self_select on public.gps_records for select
  to authenticated
  using (org_id = auth_org_id() and athlete_id = auth_athlete_id());

grant select on public.import_batches to authenticated;
create policy import_batches_staff_select on public.import_batches for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

grant select on public.vendor_profiles to authenticated;
create policy vendor_profiles_staff_select on public.vendor_profiles for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));
