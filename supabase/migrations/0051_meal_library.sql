-- 0051_meal_library.sql
--
-- What this does
--   Creates the meal library: meal_library (one saved meal — a name, a time-of-day
--   label, provenance) and meal_library_items (its line items — a food, a quantity and
--   unit, and its protein/carb/fat grams). Coach-authored content that a "Food library"
--   picker and a "+ Meal" form (src/components/NutritionWorkspace/NutritionWorkspace.tsx)
--   can actually write to and read from — both of those buttons shipped disabled,
--   `title="Not available yet"`, because until this migration nothing existed for
--   either action to write to. lib/nutritionMeals.ts's own header explained why in
--   detail; that file's header is corrected in the same commit as this migration.
--
-- What this is not, and the non-negotiable boundary it does not cross
--   CLAUDE.md §2 rule 8: "Athletes do not log nutrition daily... There is no daily
--   nutrition entry, no per-meal macros, and no nutrition compliance domain." This
--   table is a coach/medical-authored CONTENT LIBRARY — the same category of thing as
--   the five fixed reference meals lib/nutritionMeals.ts already ships (MEALS, scaled by
--   scaleMeal/scaleDay against a real athlete's real body_composition mass and the real
--   day-type multiplier, both unchanged by this migration). No athlete_id column exists
--   anywhere in this migration. No athlete ever writes a row here, and no policy below
--   grants the athlete role any access at all, read or write. This is a library of meal
--   IDEAS, not a record of what anyone ate — it is scaled and displayed exactly like the
--   fixed five meals, never logged against, never compared to what was "actually eaten"
--   (no such number exists to compare against — see nutrition_entries' dormancy, same
--   rule). If a future change makes this table athlete-writable in any form, that
--   change contradicts this migration's whole premise and should not be made quietly.
--
-- O-892, resolved: org-scoped only, no shared library
--   docs/screens/nutrition-guidance.md's own O-892 asked "Who authors the meal ideas? A
--   library you write once and ship to every club, a per-club library, or both with club
--   overrides?" This migration answers it the same way this codebase has already,
--   independently, answered the identical question twice:
--     - migration 0021_programmes.sql, on exercises: "No global exercise library
--       (exercises.org_id stays nullable, matching the column exactly, but nothing seeds
--       a null-org row)... A shared cross-club library is a content decision for someone
--       who runs the product, not a schema gap."
--     - migration 0024_testing.sql, on test_definitions: "No global, org_id-null 'Fydr
--       standard' test library to copy from — every test_definitions row this pass
--       creates is already org-scoped. The same 'no shared library' call gym-programme's
--       exercises made."
--   This migration follows that precedent a third time, and goes one step further than
--   both: org_id below is `not null`, not nullable-but-unused, so there is no dormant
--   column inviting a future migration to quietly seed a null-org "standard" row without
--   a real schema change forcing the question back open. Every meal_library row belongs
--   to exactly one club, structurally, not just by convention. Shipping a real cross-club
--   library later (docs/10-roadmap.md §5's Phase 2 line item, "a meal-idea library with
--   images served through a CDN transform") is still a real, separately-scoped piece of
--   work — this migration does not build images, a CDN transform, or a shared library,
--   only the org-scoped data and authoring path. Do not read this migration as having
--   closed that roadmap line item; it has closed O-892's authorship question only.
--
-- RLS: coach writes, medical reads, admin and athlete see nothing
--   Mirrors the write/read split src/app/(staff)/programmes/page.tsx's own copy states
--   for this whole domain: "Coach authors gym, conditioning and nutrition programmes.
--   Medical authors rehab programmes only, and reads every gym programme for context."
--   Meal ideas are nutrition content, not rehab content, so: coach full write (any meal
--   in their org), medical read-only (the same "read everything, for context" shape
--   01-roles-and-permissions.md §1 gives Medical over Coach's whole domain), admin no
--   access at all (§1's admin carve-out: "Cannot, by default: View individual athlete
--   wellness, nutrition, gym, GPS, or medical detail" — admin never sees performance-
--   domain detail), athlete no access at all. This is deliberately NOT the same split
--   nutrition_rules (migration 0039) uses — that table gives medical a personal-scope,
--   open-injury-gated WRITE, because a nutrition_rules row can be a clinical adjustment
--   for one named athlete. A meal_library row cannot be that: there is no athlete_id on
--   this table to gate a personal override against, the same way migration 0021's
--   exercises comment puts it — "a hamstring curl is a hamstring curl regardless of
--   which programme prescribes it" applies here too: a meal idea is a meal idea
--   regardless of who picks it for their day, so there is no personal-scope carve-out to
--   write, only the plain coach/medical split above.
--
-- Deliberately smaller than the full spec, and every cut is real:
--   - No images, no CDN transform. docs/10-roadmap.md §5's Phase 2 line item names both;
--     neither is built here. name/time_label/items are text and numbers only.
--   - No edit path for a saved meal or its items, and no per-item update or delete grant
--     at all — a meal is created whole (one meal_library row plus its
--     meal_library_items rows, written together by the query layer) or soft-deleted
--     whole. Getting "edit one line item of an already-saved meal" right is real,
--     separately-scoped UI and RLS work (compare exercise_overrides, migration 0043,
--     which exists precisely because "tailor one thing without touching the parent" is
--     its own problem) that this pass does not need: the UI only ever creates a meal in
--     one action or removes one.
--   - meal_library_items has no deleted_at of its own. It is a structural child of
--     meal_library the same way programme_exercises (migration 0021) is a structural
--     child of programmes with no deleted_at of its own — soft-deleting the parent is
--     what makes the whole meal, items included, stop showing up; the query layer's
--     fetchMealLibrary always filters on meal_library.deleted_at, never on the items
--     table.
--   - No global sort/search/tagging (allergens, dietary flags). docs/screens/
--     nutrition-guidance.md's own O-891 ("dietary restrictions... not modelled") is
--     still open and is not touched by this migration.
--
-- Learned from every migration since 0018: revoke the default public/anon/authenticated
-- privileges before granting narrowly, in this same migration.

create type meal_unit as enum ('g', 'ml', 'ea');

create table meal_library (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  name        text not null,
  time_label  text not null,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table meal_library is
  'A coach-authored meal idea: a name and a time-of-day label. Org-scoped only, no '
  'shared cross-club library — see this migration''s own header for O-892. Displayed and '
  'portion-scaled exactly like lib/nutritionMeals.ts''s fixed five reference meals '
  '(scaleMeal/scaleDay), never logged against by an athlete.';

create table meal_library_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id),
  meal_id     uuid not null references meal_library(id) on delete cascade,
  sequence    int not null default 0,
  name        text not null,
  qty         numeric(7,2) not null,
  unit        meal_unit not null,
  protein_g   numeric(6,2) not null default 0,
  carb_g      numeric(6,2) not null default 0,
  fat_g       numeric(6,2) not null default 0,

  check (qty > 0),
  check (protein_g >= 0 and carb_g >= 0 and fat_g >= 0)
);

comment on table meal_library_items is
  'One food line within a meal_library meal: qty/unit reuse the MealUnit shape '
  '(''g''|''ml''|''ea'') lib/nutritionMeals.ts''s fixed reference meals already use, so '
  'a library meal maps onto the same Meal/MealItem shape scaleMeal/scaleDay scales. No '
  'deleted_at of its own — a structural child of meal_library, same relationship '
  'programme_exercises (migration 0021) has to programmes.';

create index meal_library_org on meal_library (org_id) where deleted_at is null;
create index meal_library_items_meal on meal_library_items (meal_id, sequence);

alter table meal_library enable row level security;
alter table meal_library_items enable row level security;

revoke all on public.meal_library from public, anon, authenticated;
revoke all on public.meal_library_items from public, anon, authenticated;

grant select, insert, update on public.meal_library to authenticated;
grant select, insert on public.meal_library_items to authenticated;

grant select, insert, update, delete on public.meal_library to service_role;
grant select, insert, update, delete on public.meal_library_items to service_role;

-- ---------------------------------------------------------------------------
-- meal_library: coach full write (insert, update — update is how a meal is
-- soft-deleted, setting deleted_at, the same shape as every other soft-deleted
-- coach-owned table in this schema), medical read-only for context, admin and
-- athlete: no policy at all, so no access. See this migration's own header for why
-- this is a plain coach/medical split rather than nutrition_rules' personal-scope
-- medical carve-out.
-- ---------------------------------------------------------------------------

create policy meal_library_staff_select on public.meal_library for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy meal_library_coach_insert on public.meal_library for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and created_by = auth_user_id()
  );

create policy meal_library_coach_update on public.meal_library for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]))
  with check (org_id = auth_org_id());

-- No delete policy anywhere in this migration. A meal is soft-deleted (deleted_at),
-- never removed — CLAUDE.md rule 4.


-- ---------------------------------------------------------------------------
-- meal_library_items: same coach/medical split, checked against the parent
-- meal_library row's own org (not against who created it — any coach in the org may
-- add items to any meal in their org's library, the same "any coach may write any
-- programme's structure" shape migration 0021's programme_exercises_write uses).
-- ---------------------------------------------------------------------------

create policy meal_library_items_staff_select on public.meal_library_items for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach','medical']::app_role[]));

create policy meal_library_items_coach_insert on public.meal_library_items for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and exists (
      select 1 from meal_library m
      where m.id = meal_id and m.org_id = auth_org_id() and m.deleted_at is null
    )
  );

-- No update, no delete policy, and no update/delete grant to authenticated at all on
-- meal_library_items — see this migration's own header, "no edit path... at all".
