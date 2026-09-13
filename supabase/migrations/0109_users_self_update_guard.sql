-- 0109_users_self_update_guard.sql
--
-- §0bd, GATE before pilot — decided by Isabella 2026-09-13: "users_self_update
-- currently grants every column. Narrow it to the columns a person may change
-- themselves (contact details, avatar colour, theme). Status, role and
-- identity fields are refused at the database. Any status change bumps
-- claims_version so a deactivated account stops working immediately, not at
-- token expiry."
--
-- WHAT WAS FOUND (2026-09-12, the reviewer's test-club run). users_self_update
-- (0012:123) is `using / with check (org_id = auth_org_id() and id =
-- auth_user_id())` with no column restriction, and `authenticated` holds
-- UPDATE on every column of users. The only sport scientist of a club
-- deactivated her own account over PostgREST with a 200 — 0101 guards the
-- ROLE row, not the account — and a coach suspended and reactivated herself
-- and renamed her account's email. Deactivation did not bump claims_version,
-- so a still-valid token ran to expiry.
--
-- WHAT THIS DOES. One BEFORE UPDATE trigger on users, for every caller:
--
--   1. SELF (auth_user_id() = old.id, the sport scientist included): the
--      profile columns may change — full_name, phone, avatar_url,
--      avatar_colour, last_seen_at (and updated_at, the row's own trigger) —
--      and nothing that is status, role or identity: status, deleted_at,
--      email, org_id, id, created_at, claims_version. Refused as
--      P0001 users_self_update_profile_only.
--   2. ANOTHER ROW, by an authenticated caller (users_admin_update — the sport
--      scientist): status may change (the Users screen's one write) and the
--      profile columns; email, org_id, id, created_at and claims_version may
--      not. Refused as P0001 users_admin_update_no_identity.
--   3. THE BUMP: a change to status or deleted_at sets claims_version to
--      old + 1 in the same row, so session.ts's per-request comparison
--      (test-claims-version-gate.ts) signs the account out on its next
--      request. A profile change does not bump.
--   4. THE ACCOUNT of the org's only ACTIVE sport scientist stays active:
--      0101's rule (user_roles) extended to users.status / deleted_at, for
--      every caller, service_role included — a script that must deactivate
--      the last sport scientist grants another first, as a person must.
--      42501, the same message family as 0101.
--
-- THE ONE claims_version WRITE THAT PASSES: 0010's user_roles trigger bumps
-- users.claims_version by exactly one with nothing else changed. That shape
-- — +1 and no other column — is allowed for any caller; anything else on that
-- column is refused. Theme is not a users column (it is the phone's own
-- setting), so there is nothing to allow.
--
-- The policy itself is unchanged: the trigger is the column rule the policy
-- could not express, and a service-role recovery script still reaches every
-- column that the account rule (4) does not protect.
-- Test: 650_users_self_update_guard_test.sql (asserts the old rule is gone).

create or replace function public.users_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor     uuid := public.auth_user_id();
  v_self      boolean := (v_actor is not null and v_actor = old.id);
  v_remaining integer;
  v_cv_bump   boolean := (new.claims_version = old.claims_version + 1);
  v_only_cv   boolean;
begin
  /* Is claims_version the only thing changing? That is 0010's role-change
     bump, and it passes for every caller. */
  v_only_cv := v_cv_bump
    and new.status = old.status
    and new.deleted_at is not distinct from old.deleted_at
    and new.email = old.email
    and new.org_id = old.org_id
    and new.id = old.id
    and new.created_at = old.created_at
    and new.full_name = old.full_name
    and new.phone is not distinct from old.phone
    and new.avatar_url is not distinct from old.avatar_url
    and new.avatar_colour is not distinct from old.avatar_colour;

  if v_actor is not null and not v_only_cv then
    /* Identity never changes below the service role, by anyone. */
    if new.id <> old.id
       or new.org_id <> old.org_id
       or new.created_at <> old.created_at
       or new.email <> old.email
       or new.claims_version <> old.claims_version then
      raise exception using
        errcode = 'P0001',
        message = case when v_self then 'users_self_update_profile_only' else 'users_admin_update_no_identity' end,
        detail  = format('users row %s: email, org_id, id, created_at and claims_version are not writable through the app', old.id),
        hint    = '0109_users_self_update_guard.sql';
    end if;
    /* Status and deletion are not a person's own to change. */
    if v_self and (new.status <> old.status or new.deleted_at is distinct from old.deleted_at) then
      raise exception using
        errcode = 'P0001',
        message = 'users_self_update_profile_only',
        detail  = format('users row %s: a person cannot change their own status or delete themselves', old.id),
        hint    = 'Ask the sport scientist. 0109_users_self_update_guard.sql';
    end if;
  end if;

  /* The org's only active sport scientist stays active — for every caller. */
  if (new.status <> 'active' and old.status = 'active')
     or (new.deleted_at is not null and old.deleted_at is null) then
    if exists (select 1 from public.user_roles ur where ur.user_id = old.id and ur.role = 'sport_scientist') then
      select count(*) into v_remaining
        from public.user_roles ur
        join public.users u on u.id = ur.user_id
       where ur.org_id = old.org_id
         and ur.role = 'sport_scientist'
         and ur.user_id <> old.id
         and u.status = 'active'
         and u.deleted_at is null;
      if v_remaining = 0 then
        raise exception using
          errcode = '42501',
          message = 'This would deactivate the last sport scientist in the organisation',
          detail  = format('users row %s is the only active sport_scientist account for org %s', old.id, old.org_id),
          hint    = 'Grant sport_scientist to another active user first. 0109_users_self_update_guard.sql';
      end if;
    end if;
  end if;

  /* A status or deletion change takes effect on the next request. */
  if new.status <> old.status or new.deleted_at is distinct from old.deleted_at then
    new.claims_version := old.claims_version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_update on public.users;
create trigger users_guard_update
  before update on public.users
  for each row execute function public.users_guard_update();

comment on function public.users_guard_update() is
  '0109 (§0bd): a person may change only their own profile columns — status, '
  'deletion and identity are refused; a sport scientist may change another '
  'row''s status but never its identity; any status or deletion change bumps '
  'claims_version; the org''s only active sport scientist cannot be deactivated '
  'by anyone. 0010''s +1 role bump is the one claims_version write that passes.';
