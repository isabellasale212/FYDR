-- 0039_nutrition_rules.sql
--
-- What this does
--   Adds nutrition_rules: a per-kilogram macro RULE (protein/carb/fat g per kg of body
--   mass, fluid ml per kg), scoped athlete / group / org-default exactly like
--   nutrition_targets (migration 0019). This is new storage, not a replacement for
--   nutrition_targets — nutrition_targets keeps storing the resolved ABSOLUTE numbers
--   the athlete app already reads (resolve_nutrition_targets, /programme, /today);
--   nutrition_rules stores the RULE those absolute numbers are computed from, so a
--   nutritionist can change one number (say protein 1.9 -> 2.0 g/kg) and have it apply
--   to every athlete on the plan at their own current mass, recomputing again on their
--   next weigh-in, without hand-editing N target rows.
--
-- Why this table needs to exist at all
--   NUTRITION-SPEC.md's whole mechanic is "a plan is a set of rules per kilogram of body
--   mass, not a list of numbers" — the target recomputes on its own when the athlete next
--   weighs in. nutrition_targets cannot represent that: it stores one absolute number per
--   scope, so a group-scoped row would have to mean the same gram figure for every athlete
--   in the group regardless of their own mass, which is exactly what the per-kg rule is
--   for. screens/nutrition-plans.md already ran into this precisely: O-313 ("A group
--   target set in g/kg... not permitted... The correct long-term answer is probably
--   resolution at read time") specifies per-kg entry as athlete-scoped-only in that
--   screen's own editor, with read-time resolution flagged as the better answer it did not
--   have time to build. This table is that answer: a group- or org-scoped row IS
--   permitted, because it is never itself the stored target — it is resolved per athlete,
--   against that athlete's own current mass, by application code (src/lib/nutritionRules.ts),
--   the same precedence order nutrition_targets already uses (athlete beats group beats
--   org default).
--
-- What is NOT stored here
--   - The day-type carbohydrate multiplier (training x1, match x1.25, rest x0.58).
--     NUTRITION-SPEC.md §3 shows these as three fixed, non-editable rows — there is no
--     "edit the match-day multiplier" affordance anywhere in the spec — so they are a
--     plain application constant (src/lib/nutritionRules.ts DAY_TYPES), not a column or a
--     table. Storing three unchangeable numbers in a table just to read them back once is
--     a lookup with no write path, which is not what a table is for.
--   - A "plan name" or "reference athlete". NUTRITION-SPEC.md's Plans rail names three
--     invented plans with a fixed "reference mass". This build has no separate plans
--     table (see nutrition/page.tsx's own header comment for the full reasoning) — the
--     rule row's group (or "org default") IS the plan, named from the real group name,
--     and its reference mass is the real current mean mass of that group's real members,
--     not an authored constant.
--
-- Shape, RLS and the resolution precedence: copied from nutrition_targets (0019) on
-- purpose, so the two tables read the same way to anyone who already knows one of them.
-- Differences from 0019, each one deliberate:
--   - No md_offset. A rule is not day-specific — NUTRITION-SPEC.md's day type selector
--     changes which of the three fixed carbohydrate multipliers is APPLIED when a target is
--     computed, it does not change which rule ROW is read. Keeping md_offset off this table
--     means there is exactly one live rule per scope to reason about, not one per scope per
--     day, which nutrition_targets needs and this table does not.
--   - energy_kcal_cap replaces nutrition_targets.energy_kcal: NUTRITION-SPEC.md §4's own
--     targets() function is explicit that "Energy is derived, never set... The only
--     exception is an explicit kcalCap override, which clamps the total." A rule cannot
--     set energy directly without contradicting its own macros, so there is no
--     energy_kcal column here at all — only the optional clamp.
--   - tolerance_pct dropped: nothing in this pass reads it (same reasoning 0019's own
--     header already gives for shipping the identical column on nutrition_targets and
--     having nothing read it there either).

create table nutrition_rules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id),
  athlete_id        uuid references athletes(id),
  group_id          uuid references groups(id),
  -- Same explicit third fact as nutrition_targets.org_default (0019): true only when
  -- both scope columns are null, so a bug that clears one by accident cannot silently
  -- promote a personal or group rule into the org-wide fallback.
  org_default       boolean not null default false,

  protein_g_per_kg  numeric(4,2) not null,
  carb_g_per_kg     numeric(4,2) not null,
  fat_g_per_kg      numeric(4,2) not null,
  fluid_ml_per_kg   numeric(5,1) not null,
  -- NUTRITION-SPEC.md §8's OVERRIDE.kcalCap: "Energy capped at 3,600 kcal, agreed with
  -- medical staff." Clamps the derived kcal total; never itself the source of energy.
  energy_kcal_cap   numeric(7,1),

  -- Coach- or medical-authored context, required for a personal rule by the same
  -- validation nutrition-plans.md specifies for nutrition_targets ("a personal target
  -- that nobody can explain gets copied forward for years") — enforced in application
  -- code (nutritionRules.ts), not a check constraint, because the same requirement on
  -- 0019 is enforced there and not in SQL either, for consistency.
  reason            text,

  effective_from    date not null default current_date,
  effective_to      date,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  check (num_nonnulls(athlete_id, group_id) <= 1),
  check (org_default = (athlete_id is null and group_id is null)),
  check (effective_to is null or effective_to >= effective_from),
  -- Sanity rails, deliberately wider than the UI stepper's own range (1.2-2.6 / 2-10 /
  -- 0.6-1.8 / 25-60 respectively) — the same "block" vs "the UI's own tighter default"
  -- split nutrition-plans.md's validation table already draws for nutrition_targets.
  check (protein_g_per_kg between 0.5 and 4),
  check (carb_g_per_kg between 1 and 14),
  check (fat_g_per_kg between 0.2 and 3),
  check (fluid_ml_per_kg between 10 and 100),
  check (energy_kcal_cap is null or energy_kcal_cap between 800 and 10000)
);

comment on table nutrition_rules is
  'Per-kilogram macro rules (protein/carb/fat g per kg, fluid ml per kg), resolved '
  'athlete then group then org default. The target is rule x an athlete''s own current '
  'body_composition mass, computed in application code (lib/nutritionRules.ts) and, on '
  'Assign, written into nutrition_targets so the athlete-facing resolution path stays '
  'fed. Never edited once superseded, same interval style as nutrition_targets. '
  'NUTRITION-SPEC.md.';

-- One live organisation default rule.
create unique index nutrition_rules_one_default
  on nutrition_rules (org_id)
  where org_default and deleted_at is null and effective_to is null;

-- One live rule per athlete or group scope.
create unique index nutrition_rules_one_live_per_scope
  on nutrition_rules (org_id, coalesce(athlete_id, group_id))
  where deleted_at is null and effective_to is null;

create index nutrition_rules_org_effective
  on nutrition_rules (org_id, effective_from desc)
  where deleted_at is null;

alter table nutrition_rules enable row level security;
revoke all on public.nutrition_rules from public, anon, authenticated;
grant select, insert, update on public.nutrition_rules to authenticated;
grant select, insert, update, delete on public.nutrition_rules to service_role;

-- Access mirrors nutrition_targets exactly (0019): coach full write any scope, medical
-- personal-scope only for an athlete with an open injury, staff-only select — an athlete
-- never reads this table directly (they read their own resolved nutrition_targets row,
-- same as every other guidance number).
create policy nutrition_rules_staff_select on public.nutrition_rules for select
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['coach','medical']::app_role[]));

create policy nutrition_rules_coach_insert on public.nutrition_rules for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['coach']::app_role[])
              and created_by = auth_user_id());

create policy nutrition_rules_coach_update on public.nutrition_rules for update
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['coach']::app_role[]))
  with check (org_id = auth_org_id());

create policy nutrition_rules_medical_insert on public.nutrition_rules for insert
  to authenticated
  with check (org_id = auth_org_id()
              and auth_has_any_role(array['medical']::app_role[])
              and created_by = auth_user_id()
              and athlete_id is not null
              and exists (select 1 from injuries i
                          where i.athlete_id = nutrition_rules.athlete_id
                            and i.org_id = auth_org_id()
                            and i.status <> 'closed'));

create policy nutrition_rules_medical_update on public.nutrition_rules for update
  to authenticated
  using (org_id = auth_org_id()
         and auth_has_any_role(array['medical']::app_role[])
         and athlete_id is not null
         and exists (select 1 from injuries i
                     where i.athlete_id = nutrition_rules.athlete_id
                       and i.org_id = auth_org_id()
                       and i.status <> 'closed'))
  with check (org_id = auth_org_id());

-- No delete policy. Superseded by a later row, per the table comment, not deleted.


-- ---------------------------------------------------------------------------
-- Starter data: two real plans, not three.
--
-- Forwards and Backs each get a live rule row at NUTRITION-SPEC.md §4's own literal
-- defaults (protein 1.9, carb 6.0, fat 1.0, fluid 40) — an org opening this screen for
-- the first time needs at least one real plan to select, the same reasoning
-- nutrition_targets' own already-live org-default row (energy 3200 / protein 160 / carb
-- 400 / fat 90 / fluid 3000, set through this same app's real "+ New target" form by an
-- earlier session) represents for absolute targets.
--
-- Deliberately no third "Return from injury" / Rehab-group rule. NUTRITION-SPEC.md's own
-- version of that plan implies specific clinical deltas (lower energy, protein held) that
-- nutrition-plans.md caps this whole product at exactly one nutritional-judgement warning
-- and is explicit Fydr "must not appear to be prescribing" (§"Validation rules", the note
-- under the low-protein warning) — inventing a second, numeric clinical rule here would be
-- exactly that. The real mechanism for a rehab athlete is the one NUTRITION-SPEC.md itself
-- documents as the general case, "an override replaces the rule for one athlete and never
-- touches the plan": the one athlete-scoped row below, for a real athlete who is really in
-- the real Rehab group (group_memberships, seeded n=2, migration-independent) and who
-- already carries a real personal nutrition_targets override with the identical note
-- ("Return to play, energy reduced during limited training") set by an earlier session
-- through the existing form. A nutritionist who wants a distinct Rehab plan with their own
-- numbers can create one for real through "New plan" — this pass wires that action rather
-- than pre-guessing the numbers for them.
insert into nutrition_rules (org_id, group_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, reason, created_by)
select 'a0000000-0000-4000-8000-000000000001', g.id, 1.9, 6.0, 1.0, 40,
       'Season default', 'e5e20000-0000-4000-8000-00000000000a'
from groups g
where g.org_id = 'a0000000-0000-4000-8000-000000000001' and g.name in ('Forwards', 'Backs')
  and not exists (
    select 1 from nutrition_rules r
    where r.org_id = 'a0000000-0000-4000-8000-000000000001' and r.group_id = g.id and r.deleted_at is null
  );

-- The real athlete-level override, matching the existing nutrition_targets personal row
-- for the same athlete (James Barnes, a71e...0002 — Hooker, real member of both Forwards
-- and Rehab per seed.sql's group_memberships insert). Protein raised, everything else
-- inherited from whichever group/org rule resolves for him.
insert into nutrition_rules (org_id, athlete_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, reason, created_by)
select 'a0000000-0000-4000-8000-000000000001', a.id, 2.2, 6.0, 1.0, 40,
       'Protein raised while returning from injury', 'e5e20000-0000-4000-8000-00000000000a'
from athletes a
where a.org_id = 'a0000000-0000-4000-8000-000000000001' and a.id = 'a71e0000-0000-4000-8000-000000000002'
  and not exists (
    select 1 from nutrition_rules r
    where r.org_id = 'a0000000-0000-4000-8000-000000000001' and r.athlete_id = a.id and r.deleted_at is null
  );
