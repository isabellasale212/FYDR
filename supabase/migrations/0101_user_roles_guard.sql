-- ---------------------------------------------------------------------------
-- 0101: user_roles is guarded at the database — an organisation is never left
-- without a sport scientist. §0ae, 2026-09-11.
--
-- WHAT WAS FOUND. user_roles_admin_delete (0012) lets any sport scientist
-- delete any user_roles row in their org, their own included, and nothing
-- counted. The only rule against removing the last admin was
-- setUserRoles in src/lib/queries/userManagement.ts — JavaScript that runs
-- in the admin's own browser. One delete from the console, and the club has
-- no user who can insert into user_roles (user_roles_admin_insert needs a
-- sport scientist): nobody in the app can grant the role back, and recovery
-- is database access. The spec's own guardrail ("requireTyped for removing
-- the last admin") exists because admins make mistakes; it was enforceable
-- by anyone who opened devtools.
--
-- WHAT THIS DOES. A BEFORE DELETE OR UPDATE row trigger refuses any change
-- that would leave the row's organisation with zero sport_scientist rows.
-- Counted per org, on the rows that would remain. The client's message is now
-- a courtesy in front of a rule that holds.
--
-- IT HOLDS FOR EVERY CALLER, service_role included. The rule is about the
-- organisation's integrity, not about who is asking: a script that must
-- remove the last admin grants another first, exactly as a person must.
-- TRUNCATE fires no row triggers, so reset-scratch.mjs, which truncates,
-- is unaffected — and a cascade from users IS reached, so deleting the only
-- sport scientist's user row is refused too, which is the same protection
-- by another door.
--
-- SECURITY DEFINER, because the count has to see every sport_scientist row
-- in the org whatever the caller's own RLS view is; search_path is pinned.
--
-- NOT HERE: the second half of §0ae, refusing a self-grant of medic. It waits
-- on Isabella's confirmation after the reviewer's check and lands as its own
-- migration, extending this function.
-- ---------------------------------------------------------------------------

create or replace function public.user_roles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  /* Only a change that takes sport_scientist away from a row is of interest:
     a delete of such a row, or an update that changes its role or moves it to
     another org or user. Everything else passes straight through. */
  if old.role = 'sport_scientist'
     and (tg_op = 'DELETE'
          or new.role <> 'sport_scientist'
          or new.org_id <> old.org_id
          or new.user_id <> old.user_id) then
    select count(*) into v_remaining
      from public.user_roles ur
     where ur.org_id = old.org_id
       and ur.role = 'sport_scientist'
       and ur.id <> old.id;

    if v_remaining = 0 then
      raise exception using
        errcode = '42501',
        message = 'This would remove the last sport scientist from the organisation',
        detail  = format('user_roles row %s is the only sport_scientist row for org %s', old.id, old.org_id),
        hint    = 'Grant sport_scientist to another user first, then remove it here. 0101_user_roles_guard.sql.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.user_roles_guard() is
  'BEFORE DELETE OR UPDATE on user_roles: refuses any change that would leave an '
  'organisation with zero sport_scientist rows. Holds for every caller, service_role '
  'included; TRUNCATE is not a row event and is unaffected. See §0ae.';

revoke execute on function public.user_roles_guard() from public;
revoke execute on function public.user_roles_guard() from anon;
revoke execute on function public.user_roles_guard() from authenticated;

drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard
  before delete or update on public.user_roles
  for each row execute function public.user_roles_guard();
