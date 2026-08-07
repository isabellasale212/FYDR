-- 0014_group_memberships_one_live.sql
--
-- What this does
--   Adds the partial unique index screens/groups.md O-250 recommends and calls the fix for
--   "add a member who is already a member": without it, `unique (group_id, athlete_id,
--   added_at)` from 0002 does not stop two simultaneous live memberships, because a second
--   row with a different added_at satisfies it. A double-tap on "Add" would silently create
--   a duplicate live row and every member count would then be wrong by one.
--
-- Which spec sections this implements
--   screens/groups.md, "Validation rules": "An athlete may have only one live membership
--   per group | Partial unique index, recommended below | Adding an existing member is a
--   no-op, reported as a skip, never an error." And O-250 directly.
--
-- Why a new migration
--   CLAUDE.md §5: migrations are additive. 0002 is already applied.

create unique index group_memberships_one_live
  on group_memberships (group_id, athlete_id)
  where removed_at is null;
