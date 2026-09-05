-- 0063_role_model_enum.sql
--
-- G-02 / D-07, part one of two: the app_role enum itself.
--
-- The agreed model (Architecture To-Do List 2026-09-04, build handoff step 1):
-- five staff roles and no admin. Admin's duties fold into sport scientist.
--
--     athlete  coach  medic  sport_scientist  strength_conditioning  nutritionist
--
-- WHY THIS IS TWO MIGRATIONS AND NOT ONE
--   Postgres refuses to use an enum value in the same transaction that added
--   it. 0064 rewrites the policies that reference the two NEW values, so it
--   has to be a separate migration. Splitting is not a style choice here, a
--   single file would fail at apply time.
--
-- WHY RENAME RATHER THAN ADD-AND-BACKFILL
--   Postgres has no DROP VALUE for an enum, so removing 'admin' by hand would
--   mean building a replacement type, migrating four columns, rewriting every
--   dependent function and policy, and dropping the old type. RENAME does the
--   whole job in one statement per value and carries three things with it that
--   a rebuild would have to redo by hand:
--
--     1. Every row. The two live 'admin' rows in user_roles become
--        'sport_scientist' with no UPDATE, because the label moved, not the
--        data.
--     2. Every policy. A policy reading array['admin']::app_role[] references
--        the value, not the string, so it now reads
--        array['sport_scientist']::app_role[] and keeps working. That is
--        exactly the intent: admin's duties become the sport scientist's.
--     3. audit_log.actor_role. Historic rows recorded as 'admin' now read
--        'sport_scientist'.
--
--   Point 3 is the one real cost and it is a rewrite of history: an audit entry
--   from August will claim a sport scientist did something when the role was
--   called admin at the time. The alternative is worse — leaving a dangling
--   'admin' value alive purely so old audit rows keep their label, which is the
--   exact "value nobody should have but still exists" this migration removes.
--   Recorded here rather than hidden: the audit log's actor_id is unchanged, so
--   WHO did it is still exact, only the label of their role has moved.
--
-- WHICH WAY THIS FAILS IF IT LANDS ALONE
--   Fail-closed, verified rather than assumed. All 25 negated guards in the app
--   have the shape `if (!roles.includes('admin')) refuse`, so with no 'admin'
--   value the condition is permanently true and those screens refuse everyone,
--   including the sport scientist who now owns them. Loud and safe. Nobody
--   gains access. 0064 and the app change in the same push are what restore
--   them. See scripts/test-role-model.ts for the same reasoning as a test.

-- 'medical' is the value; "Medic" is the word the spec uses on screen. Renaming
-- the value keeps the two in step and costs nothing: every policy naming it
-- follows automatically.
alter type app_role rename value 'medical' to 'medic';

-- The load-bearing statement. Removes 'admin', creates 'sport_scientist', and
-- migrates both live rows and every policy, in one operation.
alter type app_role rename value 'admin' to 'sport_scientist';

-- The two genuinely new roles. Nobody holds either yet and no policy names
-- either, so both are inert until 0064 gives them meaning: a person granted
-- only one of these is refused everywhere, which is the right starting point.
alter type app_role add value if not exists 'strength_conditioning';
alter type app_role add value if not exists 'nutritionist';

comment on type app_role is
  'Six values: athlete plus five staff roles. No admin — its duties belong to '
  'sport_scientist, which is the same enum value renamed in 0063, so every '
  'policy and every historic row moved with it. Agreed 2026-09-04.';
