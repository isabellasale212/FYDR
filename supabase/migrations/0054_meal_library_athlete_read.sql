-- 0054_meal_library_athlete_read.sql
--
-- What this does
--   Adds exactly one thing: a read-only, org-scoped RLS policy letting an athlete
--   SELECT their own club's meal_library and meal_library_items rows. Nothing else
--   about migration 0051 changes — coach write, medical read-for-context, and
--   admin's no-access are all untouched, and no new grant is needed (0051 already
--   granted select/insert/update on meal_library and select/insert on
--   meal_library_items to the single `authenticated` Postgres role; every app role
--   shares that one Postgres role, so RLS policies are the only thing that ever
--   decided who could actually see a row).
--
-- Why this is additive, not a reversal of 0051's own words
--   0051's header says, correctly at the time: "no athlete ever writes a row here,
--   and no policy below grants the athlete role any access at all, read or write."
--   That was true because nothing athlete-facing read this table yet. It now does:
--   docs/screens/nutrition-guidance.md's real, coach/S&C-facing "Food library" and
--   "+ Meal" tools (NutritionWorkspace.tsx) needed no athlete read at all, but the
--   athlete-facing "Meal ideas" screen this migration unblocks
--   (src/app/(athlete)/programme/nutrition/page.tsx, docs/20-route-map.md's G-4 row,
--   "meal ideas... on /programme/nutrition") is the same real content, browsed
--   read-only by the athlete it is written for — the same relationship an athlete
--   already has with `exercises` (migration 0021: "reading the list is harmless...
--   writing to it is staff only"). The WRITE half of 0051's premise — "no athlete
--   ever writes a row here" — is completely unchanged: this migration adds no
--   insert, update, or delete policy for the athlete role, on either table. If a
--   future change ever does add one, that is the change 0051 warned should not be
--   made quietly, not this one.
--
-- Why org-scoped and not personal-scoped
--   meal_library has no athlete_id column (0051's own reasoning: "a meal idea is a
--   meal idea regardless of who picks it for their day"). An athlete reads every
--   live meal in their own org, same shape as coach and medical's existing select
--   policies, just adding 'athlete' to the role check rather than restricting
--   further — there is no "this athlete's own meals" subset to restrict to.
--
-- Docs updated in the same commit: docs/screens/nutrition-guidance.md (O-892's own
-- note) and docs/20-route-map.md (G-4), per CLAUDE.md §5, "update the spec when
-- behaviour changes." Test file updated in place: supabase/tests/260_meal_library_test.sql
-- (same file 0051 shipped, per the precedent migration 0020 set of amending an
-- existing feature's own test file rather than opening a new one for a follow-up
-- migration on the same table).

create policy meal_library_athlete_select on public.meal_library for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['athlete']::app_role[]));

create policy meal_library_items_athlete_select on public.meal_library_items for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['athlete']::app_role[]));
