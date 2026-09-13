-- PATTERN-S9 artboard 6 and the reachability figure (Isabella, 13 September
-- 2026; the Step 1 answer to question 5 in docs/overnight-records-2026-09-13.md).
--
-- "Can the app tell whether it is running installed, and can that be stored
-- per athlete?" Neither existed. The athlete app now records, once per session
-- start, how it is running: the platform (from the user agent), the display
-- mode (standalone — added to a Home Screen — or a browser tab) and whether the
-- browser can hold a push subscription at all. One row per athlete per
-- (platform, display mode), refreshed on each open; the staff squad view reads
-- "N of M athletes can receive reminders" as "has a standalone row", which is
-- what the figure honestly measures until push itself (S11) exists — its
-- caption says so.
--
-- Not a device registry and not push_tokens (43 seeded rows from the
-- abandoned Expo plan that no code has ever written —
-- docs/platform-decision.md: "Do not read them as devices"). No identifier
-- of the phone is stored: platform and display mode are the only two facts
-- the figure needs, and a row that could fingerprint a child's phone would be
-- a Children's Code question this product does not need to ask.

create table public.athlete_devices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id),
  athlete_id     uuid not null references public.athletes(id),
  platform       text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  display_mode   text not null check (display_mode in ('standalone', 'browser')),
  push_supported boolean not null default false,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  constraint athlete_devices_one_per_mode unique (athlete_id, platform, display_mode)
);
comment on table public.athlete_devices is
  'How each athlete''s app is running: platform, standalone or browser, push-capable. One row per athlete per (platform, display_mode), refreshed on each open by record_athlete_device. The reachability figure reads it. No device identifier is stored. 0121.';

alter table public.athlete_devices enable row level security;
-- 0090's default-privilege discipline: revoke, then grant only what the
-- policies govern. Writes go through the function below, as definer.
revoke all on public.athlete_devices from public, anon, authenticated;
grant select on public.athlete_devices to authenticated;
grant select, insert, update, delete on public.athlete_devices to service_role;

create policy athlete_devices_self_select on public.athlete_devices for select
  to authenticated
  using (org_id = public.auth_org_id() and athlete_id = public.auth_athlete_id());
create policy athlete_devices_staff_select on public.athlete_devices for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist','coach','medic','strength_conditioning','nutritionist']::public.app_role[]));

create index athlete_devices_org_idx on public.athlete_devices (org_id, display_mode);

-- The athlete's own beacon. Upserts the row for this platform and mode and
-- stamps last_seen_at; nothing else can be written. Not audited: a session
-- start is not an event a person took (the last_seen_at rule, 0093).
create or replace function public.record_athlete_device(p_platform text, p_display_mode text, p_push_supported boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.auth_athlete_id();
  v_org uuid := public.auth_org_id();
begin
  if v_athlete is null or v_org is null then
    raise exception 'no athlete for this session' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android', 'desktop', 'other') or p_display_mode not in ('standalone', 'browser') then
    raise exception 'unknown platform or display mode' using errcode = '22023';
  end if;
  insert into public.athlete_devices (org_id, athlete_id, platform, display_mode, push_supported)
  values (v_org, v_athlete, p_platform, p_display_mode, coalesce(p_push_supported, false))
  on conflict (athlete_id, platform, display_mode)
  do update set last_seen_at = now(), push_supported = excluded.push_supported;
end;
$$;
revoke all on function public.record_athlete_device(text, text, boolean) from public;
grant execute on function public.record_athlete_device(text, text, boolean) to authenticated;
