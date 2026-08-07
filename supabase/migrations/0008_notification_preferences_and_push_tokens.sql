-- 0008_notification_preferences_and_push_tokens.sql
--
-- What this does
--   Moves notification_preferences and push_tokens into the schema.
--
-- Which spec sections this implements
--   20-route-map.md §11 gap G-5: both tables are defined in 08-notifications.md, not in
--   04-data-model.md, which CLAUDE.md §1 names as the schema document. The instruction in
--   the gap table is "move or mirror both into 04-data-model.md §17 so one document is the
--   schema". This migration is the schema half of closing G-5; the documentation half is a
--   §17 entry in 04-data-model.md.
--   08-notifications.md §5.1 (the four layer preference resolution order)
--   08-notifications.md §8.2 (token registration, and why shell is recorded)
--   05-architecture.md §5 (resolveShell, and the rule that shell is a routing hint only)
--
-- Not closed here
--   notification_outbox (gap G-13) is the dispatcher's queue and belongs with Phase 1
--   notifications, not with the Phase 0 schema. G-13 says "resolve with G-5"; the two
--   preference tables are what routes need at Phase 0, the outbox is what the sender needs.

-- ---------------------------------------------------------------------------
-- notification_preferences
--
-- Layer five of five. The resolution order is:
--   system default -> children's floor -> organisation default -> organisation lock
--   -> user preference
-- The children's floor is resolved before the organisation because it is the one layer a
-- club cannot raise. 08-notifications.md §5.1 and §5.4.
--
-- The athlete mute rule, 08-notifications.md §5.2: an athlete can mute everything except
-- athlete.availability.changed and athlete.consent.required. That set is enforced by the
-- resolver rather than by a constraint, because the mandatory set is catalogue data.
-- ---------------------------------------------------------------------------

create table notification_preferences (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id),
  user_id           uuid not null references users(id) on delete cascade,
  -- A catalogue key such as 'athlete.wellness.prompt'. Free text rather than an enum
  -- because 08-notifications.md §12 records that the catalogue changes without a data
  -- migration, which an enum would force.
  notification_id   text not null,
  push_enabled      boolean,          -- null = inherit
  email_enabled     boolean,          -- null = inherit
  -- Always true. The column exists for symmetry with the other two channels.
  in_app_enabled    boolean not null default true,
  quiet_hours_start time,             -- null = inherit the organisation setting
  quiet_hours_end   time,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, notification_id)
);

comment on table notification_preferences is
  'Per user, per notification, per channel. Layer five of the resolution order in '
  '08-notifications.md §5.1. A user reads and writes only their own rows.';


-- ---------------------------------------------------------------------------
-- push_tokens
--
-- One binary carries both shells, so the token alone does not say which interface the
-- device is signed into. Three rules follow, 08-notifications.md §8.2:
--   the shell is taken from the CLAIMS, never from a client supplied field, which is
--     CLAUDE.md §2 rule 2 applied to a row that decides routing;
--   switching shell RE-REGISTERS rather than updating in place, so a stale row can never
--     route a flag to a phone showing the athlete tab bar;
--   the shell on the token is a routing hint and never an authorisation input.
-- ---------------------------------------------------------------------------

create table push_tokens (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id),
  user_id            uuid not null references users(id) on delete cascade,
  token              text not null,
  platform           text not null,
  shell              text not null,
  device_name        text,
  app_version        text,
  is_active          boolean not null default true,
  invalidated_reason text,
  last_used_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (token),

  check (platform in ('ios', 'android')),
  check (shell in ('athlete', 'staff'))
);

comment on column push_tokens.shell is
  'Resolved server side from the JWT claims by resolveShell, 05-architecture.md §5. '
  'A routing hint. Never an authorisation input.';
