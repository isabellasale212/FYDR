-- Three independent carbohydrate targets, one per day type.
--
-- WHAT THIS REMOVES, deliberately. nutrition_rules held ONE carb_g_per_kg and
-- the application multiplied it by a fixed per-day factor — training x1, match
-- x1.25, rest x0.58 (src/lib/nutritionRules.ts DAY_TYPES). The editor showed
-- `carb x multiplier` and divided the entered value back down into the shared
-- field, so typing a match-day number silently moved training and rest with it.
-- A nutritionist could not say "match day 7.5, rest day 3.0" unless the ratio
-- between them happened to be exactly 1.25 : 0.58.
--
-- This is a removal of that design, decided 2026-09-07, not a reshaping of it.
-- There is no shared rate left to derive the three from, on purpose: a later
-- "simplification" back to a rate plus ratios would reintroduce the exact
-- coupling this exists to end.
--
-- NOBODY'S TARGETS MOVE ON DEPLOY. The backfill writes each row's CURRENT
-- effective number into each new column — the same multipliers the application
-- was applying a moment earlier. An athlete on 6.0 g/kg keeps 6.00 training,
-- 7.50 match, 3.48 rest, which is what they were already being served. The
-- three become independent from the next edit onwards; nothing is recalculated
-- underneath anyone.
--
-- Rest is 0.58, not a rounder number, because 0.58 is what the code applied.
-- Backfilling a tidier 0.6 would be a silent 3% change to every rest-day carb
-- target in the club, which is a clinical change wearing a cosmetic disguise.

alter table public.nutrition_rules
  add column carb_g_per_kg_training numeric(4,2),
  add column carb_g_per_kg_match    numeric(4,2),
  add column carb_g_per_kg_rest     numeric(4,2);

update public.nutrition_rules
set carb_g_per_kg_training = round(carb_g_per_kg * 1.00, 2),
    carb_g_per_kg_match    = round(carb_g_per_kg * 1.25, 2),
    carb_g_per_kg_rest     = round(carb_g_per_kg * 0.58, 2);

alter table public.nutrition_rules
  alter column carb_g_per_kg_training set not null,
  alter column carb_g_per_kg_match    set not null,
  alter column carb_g_per_kg_rest     set not null;

/* Dropped rather than left in place. Two sources of truth for the same number
   is how the old value silently wins later — some query keeps selecting it, or
   a future writer keeps it in sync "just in case" and the coupling grows back.
   The data it held is fully represented by the three columns above. */
alter table public.nutrition_rules
  drop column carb_g_per_kg;
