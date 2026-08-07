-- 0028_athlete_self_update_column_guard.sql
--
-- What this does
--   Fixes a real bug in 0027, caught by 110_athlete_self_profile_test.sql
--   before anything shipped on top of it: the column-level grant
--   `grant update (preferred_name) on athletes to authenticated` restricts
--   nothing at all, because migration 0012 already granted blanket
--   `update` on athletes to the same `authenticated` role (needed for
--   coach/admin's athletes_manage_update). Postgres privileges are
--   additive within one role — a narrower grant added afterwards to the
--   same role does not shrink an already-broader one. An athlete could
--   update squad_number on their own row exactly as freely as
--   preferred_name; the test caught it as "not ok" on the second run.
--
-- Why the real fix has to be a trigger, not a grant or an RLS clause
--   Coach/admin and an athlete updating their own row are the *same*
--   Postgres role (`authenticated`) — RLS's `using`/`with check` clauses
--   decide which *rows* a policy applies to, and column grants decide
--   which *columns* the role may touch at all, but neither one can say
--   "this column, only when the acting user is this athlete, not when
--   they're this coach" — that distinction needs the row's OLD value to
--   compare against, which only a trigger has. This is the same reason
--   09-security-and-compliance.md's rectification rules and this schema's
--   own immutable-entry pattern lean on triggers rather than RLS alone
--   wherever a write needs to be conditional on more than "which row".
--
-- What it does not change
--   athletes_manage_update (coach/admin, migration 0012) and
--   athletes_self_update (the athlete's own row, migration 0027) are both
--   unchanged. This migration only adds a BEFORE UPDATE trigger that runs
--   after both policies have already let a statement through, and blocks
--   it if a non-staff actor's update would touch a column other than
--   preferred_name.

create or replace function enforce_athletes_self_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Coach and admin go through athletes_manage_update and may touch any
  -- column — this trigger has nothing to add for them.
  if auth_has_any_role(array['coach','admin']::app_role[]) then
    return new;
  end if;

  -- Anyone else reaching this point already passed athletes_self_update's
  -- row check (org_id and id match the caller's own athlete_id). What's
  -- left to enforce is the column list: preferred_name only.
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

create trigger athletes_self_update_column_guard
  before update on athletes
  for each row
  execute function enforce_athletes_self_update_columns();
