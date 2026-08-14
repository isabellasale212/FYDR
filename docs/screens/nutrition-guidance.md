# Screen: Nutrition guidance

> **Layout status**: provisional. Awaiting client design photographs.
>
> **Scope decision, 5 August 2026.** Open question O-11 is resolved. Athletes **do not log
> nutrition**. Fydr provides guidance: targets, meal plan ideas, and what to eat around
> training. Nothing is recorded by the athlete on this screen. This screen replaces
> `nutrition-entry.md`, which is superseded and must not be built.
>
> **Amended the same day, O-890 resolved.** Athletes answer **one question, once a week**, on
> a separate screen (`nutrition-checkin.md`). That is not meal logging and it is not macro
> logging: it is a single three-level self-report. Everything on this screen is unchanged and
> remains read-only. See §9.

Screen 3 in the inventory (`02-information-architecture.md` §5).

---

## Purpose

Tell an athlete what to eat, when, and why, in a form they will actually read on a phone
between sessions. It is reference content, not a task.

This is a deliberate reduction in scope. The alternative, daily per-meal macro logging, was
specified and rejected because it asks an athlete to weigh food and record it every day, and
the realistic outcome is that compliance collapses within a month and the resulting data is
too patchy to analyse. Guidance that gets read beats logging that gets abandoned.

**Read §9 before assuming this is a free win.** Removing nutrition logging removes nutrition
as an input to the cross-domain correlation that `00-product-overview.md` names as the
product's durable differentiator.

---

## Roles and access

| Role | Access |
|---|---|
| Athlete | Read their own targets and the guidance content assigned to them |
| Coach / S&C | Read and author guidance, set targets per athlete or group, vary by MD-n |
| Medical | Read. Author only for athletes with an active rehab assignment. |
| Admin | No access to individual athlete targets by default, per `01-roles-and-permissions.md` |

No athlete writes anything on this screen. There is no submit action.

**The row above describes targets** (`nutrition_targets` / `nutrition_rules`), where medical's
personal-scope, open-injury-gated write is real. The meal library resolved by O-892
(`meal_library` / `meal_library_items`, migration 0051) is narrower: medical is read-only there,
full stop — no rehab or injury carve-out, because a meal idea has no `athlete_id` to gate a
personal override against. See O-892's own resolution note in §11 for why.

---

## Entry points

| From | Carries in |
|---|---|
| Athlete `Programme` tab, Nutrition section | Athlete id, today's date, today's `md_offset` |
| Athlete `Today` tab, "Fuelling for today" card | Today's `md_offset` and session type |
| Staff sidebar, `Nutrition` | Group filter, period |
| Athlete profile, Nutrition tab | Athlete id |
| Push notification `athlete.nutrition.matchday` | Deep link to the matchday guidance |

---

## Layout

### Athlete, mobile, 390 pt

```
┌────────────────────────────────────────┐
│  Nutrition                             │
│  ─────────────────────────────────     │
│  TODAY · MD-2 · HIGH LOAD              │  <- eyebrow, .eyebrow 11/.12em/up
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Today's targets                │    │  <- .card, radius 18, padding 16
│  │                                │    │
│  │  Protein   180 g               │    │  <- .mono, tabular
│  │  Carbs     450 g               │    │
│  │  Fluid     3.5 L               │    │
│  │  Energy    3,400 kcal          │    │
│  │                                │    │
│  │  Higher carbs than a rest day  │    │  <- one line of plain-English why
│  │  because tomorrow is heavy.    │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Around training                │    │
│  │  2-3 h before  ▸               │    │  <- expandable rows
│  │  Within 30 min after ▸         │    │
│  │  Before bed ▸                  │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Meal ideas                     │    │
│  │  [ Breakfast ][ Lunch ][ … ]   │    │  <- .squad-chip segmented
│  │  ┌──────────┐ ┌──────────┐     │    │
│  │  │ Overnight│ │ Eggs on  │     │    │  <- 2-col grid, gap 12
│  │  │ oats     │ │ toast    │     │    │
│  │  │ 42g P    │ │ 28g P    │     │    │
│  │  └──────────┘ └──────────┘     │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Matchday plan            ▸     │    │  <- only when md_offset in (-1, 0)
│  └────────────────────────────────┘    │
│                                        │
│  Set by your S&C coach · 12 Jul        │  <- provenance, .faint
└────────────────────────────────────────┘
```

**Targets first, ideas second.** The number is what a coach has told them to hit. The meal
ideas are how. Reversing the order buries the instruction under recipes.

### Staff, web, 1280 px

Three regions: a squad target grid (athletes down, MD-n across, showing assigned target
sets), a guidance content library, and an editor. The squad grid is the "whole squad" view
from the hand-drawn map.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `MetricTile` | `06-design-system.md` §5 | Each target, mono numeral plus label |
| `GroupFilter` | §5 | Staff squad grid |
| `DayWeekToggle` | §5 | Staff, day versus week targets |
| `ExpandableRow` | §5 | Around-training timing rows |
| `MealCard` | new, §5 | One meal idea: name, image, protein, prep time |
| `EmptyState` | §5 | No targets assigned yet |
| `.squad-chip` | real design system | Meal slot segmentation |

---

## Data requirements

| Field | Source | Transformation |
|---|---|---|
| Protein target | `nutrition_targets.protein_g` | Resolved by athlete, then group, then org default |
| Carbs target | `nutrition_targets.carbs_g` | As above |
| Fat target | `nutrition_targets.fat_g` | As above |
| Fluid target | `nutrition_targets.fluid_ml` | Display in litres to 1 dp |
| Energy target | `nutrition_targets.energy_kcal` | As above |
| Applicable day | `nutrition_targets.md_offset` | Matched against today's `sessions.md_offset` |
| Effective range | `nutrition_targets.effective_from`, `effective_to` | Current row only |
| Guidance content | `nutrition_guidance` (new, §17.14) | Filtered by `md_offset` and `context` |
| Meal ideas | `meal_ideas` (new, §17.14) | Filtered by `meal_slot`, ordered by `sort_order` |
| Author and date | `nutrition_targets.created_by`, `updated_at` | Provenance line |

`nutrition_entries` is **not queried by this screen**. See §9.

### Resolution order for a target

```
athlete-specific row for today's md_offset
  → athlete-specific row with null md_offset
    → group row for today's md_offset
      → group row with null md_offset
        → org default
          → no target, show the guidance without numbers
```

---

## States

| State | What the athlete sees |
|---|---|
| Default | Targets, around-training timing, meal ideas for the current slot |
| No targets set | Guidance content only, with "Your coach has not set targets yet". Never invent numbers. |
| No guidance authored | Targets only, with a neutral empty state. Do not ship placeholder recipes. |
| Rest day | Targets for `md_offset` of a rest day, and the around-training block is hidden |
| Matchday | Matchday plan promoted to the top, everything else collapsed |
| Rehab athlete | Medical-authored guidance replaces coach guidance, labelled as such |
| Offline | Fully readable. Content is cached on assignment and on every open. |
| Loading | Skeleton cards, never a spinner over the whole screen |

**Offline matters more here than on most screens.** An athlete checks what to eat in a
kitchen, a supermarket, or a hotel. Cache the current guidance set and the current targets
on assignment, not on demand.

---

## Interactions

| Action | Result |
|---|---|
| Tap a timing row | Expands in place, no navigation |
| Tap a meal slot chip | Filters meal ideas, persists for the session |
| Tap a meal card | Opens the full idea: ingredients, method, macros, prep time |
| Pull to refresh | Re-fetches targets and guidance |
| Tap "Matchday plan" | Opens the matchday sheet |
| Long press a meal card | Share sheet, so an athlete can send it to a family member who cooks |

There is no submit, no save, and no logging action anywhere on this screen.

---

## Validation rules

Authoring side only, since athletes enter nothing.

- Protein 0 to 400 g, carbs 0 to 1000 g, fat 0 to 300 g, fluid 0 to 10000 ml, energy 0 to 8000 kcal
- Warn, do not block, when macros and energy disagree by more than 10%, computing energy as
  `4P + 4C + 9F`. Coaches set these by rule of thumb and the arithmetic often does not close.
- `effective_from` must not be after `effective_to`
- A target set with every field null is rejected

---

## Edge cases

1. **Two fixtures in a week.** `md_offset` is ambiguous. Use the same resolution as
   `03-flows.md` §8: label relative to the next fixture, and show both labels.
2. **No fixture scheduled.** Fall back to the group's default target row with null `md_offset`.
3. **Athlete in two groups with different targets.** Lowest `groups.sort_order` wins. Log
   the conflict for the coach, do not silently pick.
4. **Rehab athlete with a coach target and a medical target.** Medical wins, and the screen
   says so.
5. **Target changed mid-day.** The athlete sees the new one immediately. Do not version
   targets to the athlete, they are guidance not a record.
6. **Guidance references a supplement.** Add a standing note that supplement use is the
   athlete's own decision and, in a tested sport, their own anti-doping responsibility. See §10.
7. **Athlete with a dietary restriction or allergy.** Not modelled. See O-891, and until it
   is resolved do not present meal ideas as personalised.
8. **Very long guidance content.** Cap the cached payload. A coach pasting a 5,000 word
   article is a real risk.

---

## Performance notes

- Targets and guidance for today must render from cache in under 100 ms
- Meal images are the payload risk. Serve at most 200 KB each from Supabase Storage with a
  CDN transform, and lazy-load below the fold.
- One query for targets, one for guidance, one for meal ideas. Do not fan out per meal slot.

---

## Accessibility

- Every target announced as "Protein target, 180 grams", not "180"
- Meal cards are buttons with an accessible name of the meal, not the image
- Expandable rows expose expanded state to screen readers
- Numbers use tabular figures per `06-design-system.md`, and honour dynamic type up to XXL
- Touch targets 44 pt minimum, including the meal slot chips

---

## 9. What this scope change costs, stated plainly

Removing nutrition logging is the right call for compliance. It is not free.

| Lost | Consequence |
|---|---|
| Nutrition as a correlation input | `00-product-overview.md` names "nutrition against gym output against on-pitch load" as the durable differentiator. Without logged intake there is no nutrition variable. **Partly recovered by option 2 below**, which is now commissioned: there is a weekly three-level self-reported axis, and there is nothing better. |
| Nutrition compliance | `compliance_expectations.domain = 'nutrition'` has nothing to measure. Remove it from compliance calculations or every athlete shows a false gap. **Still lost, and deliberately so**: the weekly check-in is not a compliance domain either. See `nutrition-checkin.md` §"Compliance". |
| Protein intake versus lean mass analysis | Specified in the analytics presets. Not computable, and option 2 does not make it computable. Gone for good. |
| Any evidence guidance was followed | **Recovered, weakly.** One self-reported answer a week is evidence of a kind. It is not evidence of intake. |

**Three ways to recover a nutrition signal without daily logging**, in increasing cost:

1. **Read receipts.** Record that an athlete opened the guidance for a given day. Weak, free,
   and honest about being weak. Recommended for v1.
2. **A weekly one-tap check-in.** "Did you hit your protein target most days this week?
   Yes / Roughly / No." One tap, once a week, gives a coarse variable that is good enough for
   a trend and cheap enough that athletes will do it. **Recommended, and now commissioned.**
3. **Periodic detailed audit.** A proper 3-day weighed intake record, twice a season, run as
   a testing session rather than a daily habit. This is what sports nutritionists actually
   do, and it produces better data than a year of half-hearted daily logs.

### O-890: RESOLVED, 5 August 2026. Option 2 is in scope.

The client has commissioned the weekly one-tap check-in. It is specified as its own screen:

| Where | What |
|---|---|
| Screen | **`nutrition-checkin.md`**, screen 45 in `02-information-architecture.md` §5. A bottom sheet over Today, one question, three tap targets, an optional note, under 10 seconds |
| Schema | `nutrition_checkins`, `04-data-model.md` §17.15. One live row per athlete per ISO week, immutable with revisions, a three-week submission window, athlete-insert-only |
| Notification | `athlete.nutrition.checkin`, `08-notifications.md` §2 and §3.7. Sunday 19:00 local, once a week, P3, disableable, no nudge, no streak or guilt mechanics |
| Analytics | `nutrition.protein_target_met_weekly` in `analytics.md`, weekly grain, three levels, self-reported, Spearman only, with a fixed coarseness note on every result and preset 5 as a descriptive trend |
| Compliance | **Not a compliance domain.** A missed check-in is not non-compliance. Argued in `nutrition-checkin.md` §"Compliance" |
| Effort | 1 week, split across Phase 2 and Phase 3. `10-roadmap.md` §5 and §6 |

**What this does and does not change about the table above.** It gives back a nutrition axis,
which is why the first row now reads "partly recovered". It does not give back grams, days,
per-nutrient detail, or the protein-against-lean-mass analysis, and it does not give back
nutrition compliance, which was removed on purpose and stays removed. A weekly three-level
self-report is a real variable and a poor one. Do not quote either half of that on its own.

Option 3 remains out of scope until you say so. It is why `nutrition_entries` stays dormant.

**Schema consequence.** Keep `nutrition_entries` in the schema, unused, rather than dropping
it. Option 3 needs it, and re-adding a table is more work than leaving one dormant. Mark it
clearly as not used in v1 so nobody builds against it.

---

## 10. Anti-doping and duty of care

Fydr publishes nutrition guidance to athletes, some of whom compete in tested sport.

- Never name a specific branded supplement product in guidance content
- Include a standing, non-dismissible line on any guidance mentioning supplements:
  supplement use is at the athlete's own risk and is their own anti-doping responsibility
- Do not present guidance as clinical or dietetic advice. Fydr is not a medical service.
  This also matters for the trademark class decision in `13-legal-and-trademark.md` §6.
- Guidance authored by an unqualified coach carries the club's liability, not yours, but the
  DPA and terms should say so explicitly

---

## 11. Open questions

| ID | Question |
|---|---|
| **O-890** | **RESOLVED, 5 August 2026. Yes.** The weekly one-tap check-in is commissioned. Specified in `nutrition-checkin.md`, schema `04-data-model.md` §17.15, notification `08-notifications.md` §3.7, analytics variable in `analytics.md`. Estimated at 1 week rather than the two days quoted here, because the two days costed the sheet and not the analytics guards. See §9 and `10-roadmap.md` §5. New questions raised by the decision run from O-970. |
| **O-891** | Dietary restrictions, allergies and religious requirements are not modelled. Meal ideas cannot be safely personalised without them. Do you want them on the athlete profile, and if so, note they are health-adjacent data with their own consent implications. |
| **O-892** | **RESOLVED, 14 August 2026. Per-club library, no shared "write once, ship to every club" library.** `meal_library` / `meal_library_items` (migration 0051) are org-scoped only, no exceptions — `org_id` is `not null` on both tables, not nullable-and-unused. This follows precedent this codebase had already set twice independently for the identical question: `exercises` (migration 0021 — "No global exercise library... a shared cross-club library is a content decision for someone who runs the product, not a schema gap") and `test_definitions` (migration 0024 — "No global, org_id-null 'Fydr standard' test library... The same 'no shared library' call gym-programme's exercises made"). Authoring is coach-only (write); medical reads for context, the same split `programmes/page.tsx` states for the whole nutrition-programme domain; admin has no access, per `01-roles-and-permissions.md` §1's "no performance-domain detail by default." Query layer: `src/lib/queries/mealLibrary.ts`. UI: the "Food library" picker and "+ Meal" form in `NutritionWorkspace.tsx`, both previously permanently disabled. Not resolved by this change: the images and CDN transform `10-roadmap.md` §5's Phase 2 line item also names — still not built, tracked there, not reopened here. O-893's tiering question is separate and still open. |
| **O-893** | Should guidance be tiered? `12-product-tiers.md` puts nutrition in both tiers. A prebuilt meal library is a plausible Premium hook. |
| **O-894** | Does `nutrition_targets` still need per-meal granularity now that nothing is logged per meal, or do daily totals suffice? Daily totals would simplify the schema. |
| **O-895** | Should read receipts (§9 option 1) be recorded at all, given they tell an athlete they are being monitored for reading a page? |

---

## Related

- The weekly check-in commissioned by O-890: `nutrition-checkin.md`, screen 45
- Superseded screen: `nutrition-entry.md`, do not build
- Staff authoring: `nutrition-plans.md`
- Targets schema: `04-data-model.md` §5, guidance schema §17.14
- MD-n resolution: `03-flows.md` §8
- Tiering: `12-product-tiers.md`
