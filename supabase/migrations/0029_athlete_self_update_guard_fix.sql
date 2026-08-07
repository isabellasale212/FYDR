-- 0029_athlete_self_update_guard_fix.sql
--
-- What this does
--   Fixes a second real bug in 0028, caught by the tenancy suite itself
--   this time, not by 110_athlete_self_profile_test.sql: the trigger's
--   condition was "let it through if the actor is coach or admin,
--   otherwise restrict to preferred_name". That's backwards for anyone
--   who isn't going through RLS as an authenticated client at all —
--   tests.fixtures() (this suite's own setup, SECURITY DEFINER) backfills
--   athletes.default_team_id with no JWT role context whatsoever, and
--   0028's trigger read "no role context" as "not coach/admin" and blocked
--   it. SECURITY DEFINER and the table owner already bypass RLS and grants
--   for exactly this kind of internal write; a trigger doesn't know that
--   and fires regardless, so it has to be told explicitly.
--
-- The actual fix
--   Only restrict the write when the JWT positively carries the athlete
--   role — the one case this trigger exists to guard. Everything else
--   (coach, medical, admin, or no role context at all — fixtures,
--   migrations, a service-role script) passes through untouched, which is
--   the same trust boundary athletes_manage_update and every SECURITY
--   DEFINER helper in this schema already assumes.

create or replace function enforce_athletes_self_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only an athlete-role JWT is this trigger's concern. Coach, medical,
  -- admin, and anything running with no role context at all (fixtures,
  -- migrations, a service-role script) pass through unrestricted here —
  -- exactly the same actors athletes_manage_update and RLS more broadly
  -- already trust for a full-column write.
  if not auth_has_any_role(array['athlete']::app_role[]) then
    return new;
  end if;

  if new.org_id            is distinct from old.org_id
     or new.user_id        is distinct from old.user_id
     or new.first_name     is distinct from old.first_name
     or new.last_name      is distinct from old.last_name
     or new.date_of_birth  is distinct from old.date_of_birth
     or new.position       is distinct from old.position
     or new.squad_number   is distinct from old.squad_number
     or new.dominant_side  is distinct from old.dominant_side
     or new.height_cm      is distinct from old.height_cm
     or new.status         is distinct from old.status
     or new.joined_at      is distinct from old.joined_at
     or new.left_at        is distinct from old.left_at
     or new.default_team_id is distinct from old.default_team_id
     or new.deleted_at     is distinct from old.deleted_at
  then
    raise exception 'athletes: preferred_name is the only column an athlete may update on their own row'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
