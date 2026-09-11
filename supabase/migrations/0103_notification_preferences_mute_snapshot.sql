-- 0103_notification_preferences_mute_snapshot.sql
--
-- §0z, decided by Isabella 2026-09-11: "un-mute must restore each type to its
-- state before muting, not force all on." Built 2026-09-12.
--
-- What was wrong. muteAll upserted push_enabled = false, email_enabled = false
-- for every disableable notification without reading the rows it overwrote,
-- and unmuteAll upserted true, true. So the pair was set-all-off / set-all-on:
-- four of the sixteen types default to off, and any the athlete had turned off
-- by choice came back ON after "Turn notifications back on" — including email
-- on types that have no email channel.
--
-- The rule, precisely. muteAll records, per type, what push_enabled and
-- email_enabled were immediately before it set them false. unmuteAll writes
-- those recorded values back — not true, not the catalogue default. A type the
-- athlete had off before muting is off after. A type that was on comes back
-- on. A single chip changed WHILE muted is the athlete's newer intent and wins
-- over the snapshot for that one type.
--
-- Where the pre-mute state lives: on the row, so it survives a sign-out and a
-- different device (not localStorage). Three columns rather than the two the
-- decision sketched: pre_mute_push / pre_mute_email hold the snapshot, and
-- muted_at is the marker that a snapshot is HELD — needed because null is a
-- legitimate snapshot value ("inherit the catalogue default"), so the snapshot
-- columns alone cannot say whether a row is muted. muted_at also makes "Turn
-- notifications back on" show on reload and on another device, which the
-- client-only `muted` flag never did.
--
-- The logic lives in two functions rather than in the client, so it is one
-- round trip, atomic per call, testable with pgTAP against the real schema,
-- and cannot be re-implemented differently by a second caller:
--
--   mute_notifications(ids)   snapshot + set false, for the caller's own rows,
--                             creating rows that do not exist yet; never
--                             overwrites a snapshot already held (pressing
--                             Mute twice is not a second mute).
--   unmute_notifications(ids) restore + clear, only for rows that hold a
--                             snapshot; returns what it restored so the client
--                             can render it without a refetch.
--
-- A single-chip write (setNotificationChannel) clears the snapshot for that
-- row in the same upsert — see lib/queries/notificationPreferences.ts.

alter table public.notification_preferences
  add column pre_mute_push  boolean,
  add column pre_mute_email boolean,
  add column muted_at       timestamptz;

comment on column public.notification_preferences.pre_mute_push is
  'push_enabled as it was immediately before "Mute everything else" set it false; restored by '
  'unmute_notifications. Meaningful only while muted_at is set — null there means "was inheriting".';
comment on column public.notification_preferences.pre_mute_email is
  'email_enabled as it was immediately before muting; see pre_mute_push.';
comment on column public.notification_preferences.muted_at is
  'Set by mute_notifications, cleared by unmute_notifications and by any single-channel write. '
  'While set, the row holds a snapshot in pre_mute_push / pre_mute_email.';

-- ---------------------------------------------------------------------------
-- mute_notifications: snapshot, then silence. Own rows only — the caller is
-- resolved from the JWT, never taken as a parameter, and the row-level policy
-- (0012, notification_preferences_self) still applies because this runs as
-- the invoker.
-- ---------------------------------------------------------------------------
create or replace function public.mute_notifications(p_notification_ids text[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org  uuid := public.auth_org_id();
  v_user uuid := public.auth_user_id();
  v_n    integer := 0;
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Rows that exist and are not already muted: snapshot their current
  -- channels, then set both false. An already-muted row keeps the snapshot it
  -- holds — pressing Mute twice must not record "off" as the state to restore.
  update public.notification_preferences
     set pre_mute_push  = push_enabled,
         pre_mute_email = email_enabled,
         muted_at       = now(),
         push_enabled   = false,
         email_enabled  = false
   where user_id = v_user
     and org_id = v_org
     and notification_id = any(p_notification_ids)
     and muted_at is null;
  get diagnostics v_n = row_count;

  -- Types the athlete never touched have no row: their state was "inherit",
  -- which is what a null snapshot restores. Create the row muted.
  insert into public.notification_preferences
    (org_id, user_id, notification_id, push_enabled, email_enabled, pre_mute_push, pre_mute_email, muted_at)
  select v_org, v_user, id, false, false, null, null, now()
    from unnest(p_notification_ids) as t(id)
   where not exists (
     select 1 from public.notification_preferences p
      where p.user_id = v_user and p.notification_id = t.id
   );

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- unmute_notifications: restore what was recorded, for rows that hold a
-- snapshot. A row without muted_at is left alone — either it was never muted
-- or the athlete changed it by hand while muted, and that newer intent wins.
-- Returns the restored channels so the client can render them directly.
-- ---------------------------------------------------------------------------
create or replace function public.unmute_notifications(p_notification_ids text[])
returns table (notification_id text, push_enabled boolean, email_enabled boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org  uuid := public.auth_org_id();
  v_user uuid := public.auth_user_id();
begin
  if v_org is null or v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  return query
  update public.notification_preferences p
     set push_enabled   = p.pre_mute_push,
         email_enabled  = p.pre_mute_email,
         pre_mute_push  = null,
         pre_mute_email = null,
         muted_at       = null
   where p.user_id = v_user
     and p.org_id = v_org
     and p.notification_id = any(p_notification_ids)
     and p.muted_at is not null
  returning p.notification_id, p.push_enabled, p.email_enabled;
end;
$$;

grant execute on function public.mute_notifications(text[]) to authenticated;
grant execute on function public.unmute_notifications(text[]) to authenticated;
revoke execute on function public.mute_notifications(text[]) from anon;
revoke execute on function public.unmute_notifications(text[]) from anon;
