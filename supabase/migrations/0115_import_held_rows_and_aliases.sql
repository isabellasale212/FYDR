-- 0115_import_held_rows_and_aliases.sql
--
-- PATTERN-S8 C11 (2026-09-13): "an import holds what it cannot match, named
-- on screen; matching once teaches the vendor's spelling."
--
-- What this does
--   Two tables 0026 named and deliberately did not build, sized for what the
--   screen now needs and no more:
--
--   import_held_rows — a row in an uploaded GPS file whose "Player Name"
--     matched no athlete, or more than one, is HELD rather than rejected:
--     its vendor spelling, its date and its parsed values are kept against
--     the batch, so the sport scientist can match it to an athlete on
--     screen (which writes the gps_records row then) or discard it. A row
--     with a bad number is still rejected with its reason, as before — a
--     held row is one the club can resolve; a rejected row is one the
--     vendor must fix.
--
--   athlete_import_aliases — the vendor's spelling, remembered: matching a
--     held row once writes (org, alias → athlete), and the parser reads the
--     aliases before it gives up on a name, so the same spelling in the next
--     file matches without a second question. One alias per org per
--     spelling (normalised: trimmed, lower-cased, single spaces); an alias
--     that would collide is refused by the unique key, never silently
--     re-pointed.
--
-- Who may do what
--   Reading and writing both is the GPS importer's — GPS_IMPORT in
--   lib/access.ts, the sport scientist alone (0065's narrowing of 0026's
--   coach-or-medical) — inside their own org. No delete: a held row is
--   resolved by status (held → matched | discarded), never removed; an alias
--   is a fact about a vendor file and stays. service_role keeps full access
--   for the tests and for retention, whose schedule these do not join today
--   (import_held_rows carries no athlete data beyond a name the vendor
--   typed; it goes with its batch's own 30-day clock when that is extended).

create table public.import_held_rows (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id),
  batch_id            uuid not null references public.import_batches(id) on delete cascade,
  row_number          int  not null,
  player_name         text not null,
  record_date         date not null,
  values              jsonb not null default '{}'::jsonb,
  reason              text not null,
  status              text not null default 'held' check (status in ('held', 'matched', 'discarded')),
  matched_athlete_id  uuid references public.athletes(id),
  resolved_by         uuid references public.users(id),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index import_held_rows_org_status_idx on public.import_held_rows (org_id, status);
create index import_held_rows_batch_idx on public.import_held_rows (batch_id);

comment on table public.import_held_rows is
  'PATTERN-S8 C11: rows of a GPS import whose player name matched no athlete (or more than one), held with their values until a sport scientist matches or discards them. Migration 0115.';

alter table public.import_held_rows enable row level security;

-- The schema's default privileges hand every new table to anon and
-- authenticated (the 0013 / 0090 lesson); revoke first, then grant only the
-- verbs the policies below govern. No delete for authenticated.
revoke all on public.import_held_rows from public, anon, authenticated;
grant select, insert, update on public.import_held_rows to authenticated;
grant select, insert, update, delete on public.import_held_rows to service_role;

create policy import_held_rows_importer_select on public.import_held_rows for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]));

create policy import_held_rows_importer_insert on public.import_held_rows for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]));

create policy import_held_rows_importer_update on public.import_held_rows for update
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]))
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]));


create table public.athlete_import_aliases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id),
  athlete_id  uuid not null references public.athletes(id),
  alias       text not null,
  source      text not null default 'gps_import',
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  constraint athlete_import_aliases_one_per_spelling unique (org_id, alias),
  constraint athlete_import_aliases_normalised check (alias = lower(btrim(alias)) and alias !~ '\s\s')
);

create index athlete_import_aliases_athlete_idx on public.athlete_import_aliases (org_id, athlete_id);

comment on table public.athlete_import_aliases is
  'PATTERN-S8 C11: a vendor file''s spelling of an athlete''s name, remembered when a held row is matched, read by the GPS parser before it gives up on a name. One per org per spelling. Migration 0115.';

alter table public.athlete_import_aliases enable row level security;

revoke all on public.athlete_import_aliases from public, anon, authenticated;
grant select, insert on public.athlete_import_aliases to authenticated;
grant select, insert, update, delete on public.athlete_import_aliases to service_role;

create policy athlete_import_aliases_importer_select on public.athlete_import_aliases for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]));

create policy athlete_import_aliases_importer_insert on public.athlete_import_aliases for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]) and created_by = public.auth_user_id());
