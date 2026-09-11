-- ---------------------------------------------------------------------------
-- 0102: a sport scientist cannot grant medic to themselves. §0ae, second
-- half, confirmed by Isabella 2026-09-11.
--
-- WHAT WAS FOUND. user_roles_admin_insert (0012) checks the org and that the
-- caller is a sport scientist — nothing about user_id, nothing about which
-- role. On the running app the admin's own "Medic" toggle is enabled: one
-- click grants CLINICAL_ONLY, the one gate the sport scientist — the superset
-- role — does not hold. It is what keeps athletes' problem reports, diagnoses
-- and mechanisms off the admin's screen. An admin who can self-grant medic
-- can read every athlete's own words to the medical team on a whim, with the
-- only trace an audit row they could also read.
--
-- THE RULE. Granting medic to OTHERS stays allowed (decided). Granting it to
-- auth_user_id() — by INSERT, or by an UPDATE that re-points a medic row at
-- oneself or turns one's own row into medic — is refused. The enum value is
-- 'medic' (0063 renamed 'medical'). A connection with no JWT (service role,
-- seeds, scripts) has no acting user and is not refused: the rule is about
-- self, and there is no self.
--
-- WHAT THIS DOES. Extends user_roles_guard() from 0101 and re-creates the
-- trigger as BEFORE INSERT OR DELETE OR UPDATE. The last-sport-scientist rule
-- is unchanged and 570 still pins it; 580 pins this.
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
  /* 0102: self-grant of medic. auth_user_id() is null with no JWT, and null
     never equals a user_id, so a seed or script is not refused. */
  if tg_op in ('INSERT', 'UPDATE')
     and new.role = 'medic'
     and new.user_id = public.auth_user_id()
     and (tg_op = 'INSERT' or old.role <> 'medic' or old.user_id <> new.user_id) then
    raise exception using
      errcode = '42501',
      message = 'You cannot grant yourself the medic role',
      detail  = format('user %s attempted to grant medic to themselves', new.user_id),
      hint    = 'Another sport scientist can grant it. 0102_user_roles_no_self_medic.sql.';
  end if;

  /* 0101: the last sport scientist. Only a change that takes sport_scientist
     away from a row is of interest: a delete of such a row, or an update that
     changes its role or moves it to another org or user. */
  if tg_op in ('DELETE', 'UPDATE')
     and old.role = 'sport_scientist'
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
  'BEFORE INSERT OR DELETE OR UPDATE on user_roles: refuses a self-grant of medic '
  '(0102) and any change that would leave an organisation with zero sport_scientist '
  'rows (0101). The self rule needs an acting user, so connections with no JWT are '
  'not refused by it; the last-admin rule holds for every caller. See §0ae.';

drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard
  before insert or delete or update on public.user_roles
  for each row execute function public.user_roles_guard();
