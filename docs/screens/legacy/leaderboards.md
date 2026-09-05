> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Leaderboards

> **Layout status**: provisional. Awaiting client design photographs.

Screen 26 in the inventory (`02-information-architecture.md` §5). Reached from
`More → Leaderboards` for staff and from `My Data → Leaderboards` for athletes. The whiteboard
drew `Leaderboard ───► Everything`, meaning any metric can be ranked.

---

## Purpose

Rank athletes on a configurable metric, over a configurable population, over a configurable
window, and show that ranking to the squad.

**This is the only screen in Fydr where an athlete sees another athlete's data.** Everything in
this specification follows from that sentence. `01-roles-and-permissions.md` §1 grants an
athlete "view leaderboards they appear on, including other athletes' names and the ranked
metric", and explicitly denies them everything else about another athlete. The design task is
to build the "everything" the whiteboard asked for without turning it into a squad-wide data
leak.

Three jobs:

1. **Let a coach build a leaderboard on any eligible metric**, save it, and publish it to the
   squad or keep it staff-only.
2. **Show athletes where they stand**, on the boards they appear on, with nothing else exposed.
3. **Refuse to rank the things that should not be ranked**, and say why rather than hiding the
   option silently.

**What this screen is not.** It is not analytics (`analytics.md`), which is staff-only,
multi-metric and does not expose athlete-to-athlete comparison. It is not a reward or points
system. It has no streaks, badges or levels.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full. Create, configure, publish, unpublish, delete boards. See every board including unpublished. See every athlete's position |
| Medical / Physio | Same as coach. Additionally can suppress a board for an individual athlete on clinical grounds, see "Medical suppression" |
| Athlete | View published boards where they are in the population **and** eligible. See ranked names, positions and the ranked metric value only. Cannot create or configure |
| Admin | Aggregate only, per the permission matrix: board names, participation counts, opt-out counts. No athlete names against values. This is consistent with an admin not holding athlete data access by default |

Per the matrix in `01-roles-and-permissions.md` §2, "View leaderboards" is `Y` for athlete,
coach and medical, and `A` for admin.

---

## Entry points

| From | Lands on | Context carried |
|---|---|---|
| Staff: `More → Leaderboards` | Board list | Group filter |
| Athlete: `My Data → Leaderboards` | Board list, published boards they appear on | None |
| Athlete: `Today` tab, "You moved up 3 places" card | That board, own row scrolled to and highlighted | `board_id` |
| `testing.md`, "Create leaderboard from this test" | Builder, that test preselected | `test_definition_id` |
| `analytics.md`, a saved view with a single rankable metric | Builder, that metric preselected | `metric_key`, `window` |
| `athlete-profile.md`, "Boards this athlete appears on" | Board list, filtered | `athlete_id` |
| Deep link `fydr://leaderboards/<id>` | That board, role-appropriate rendering | `board_id` |

Per `02-information-architecture.md` §7 rule 4, a deep link resolves to the correct role shell,
and a link to an unpublished board delivered to an athlete resolves to `noPermission`, never to
a partial render.

---

## Layout

### Athlete, mobile, 390 pt

The athlete view is the one that matters most, because it is the one that carries the exposure
risk and the one most people will see.

```
┌─────────────────────────────┐
│ ← Leaderboards              │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ CMJ height              │ │
│ │ Squad · this season     │ │
│ │ You are 7th of 36       │ │
│ │ ▲ up 3 since 1 Jul      │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Total gym volume        │ │
│ │ Forwards · last 28 days │ │
│ │ You are 2nd of 18       │ │
│ │ ▬ no change             │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Weekly running distance │ │
│ │ Squad · last 7 days     │ │
│ │ You are 21st of 34      │ │
│ │ ▼ down 4                │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Opening one:

```
┌─────────────────────────────┐
│ ← CMJ height                │
│ Squad · season to 5 Aug     │
├─────────────────────────────┤
│  1  J. Okafor       45.6 cm │
│  2  L. Ferreira     44.8 cm │
│  3  T. Bennett      43.1 cm │
│  4  A. Mwangi       42.9 cm │
│  5  M. Price        42.8 cm │
│  6  K. Doherty      41.2 cm │
│ ┌─────────────────────────┐ │
│ │ 7  YOU              39.4│ │
│ │    ▲ up 3 since 1 Jul   │ │
│ │    Your PB 39.4 · 13 Aug│ │
│ └─────────────────────────┘ │
│  8  S. Novak        39.1 cm │
│  9  R. Idowu        38.7 cm │
│ 10  P. Grealish     38.2 cm │
│ ...                         │
│ 36  C. Whelan       31.0 cm │
├─────────────────────────────┤
│ Best result per athlete,    │
│ season to date.             │
│ 36 of 38 athletes have a    │
│ result. 2 have not been     │
│ tested.                     │
│ Staff entered 100%.         │
├─────────────────────────────┤
│ [ Leave this leaderboard ]  │
└─────────────────────────────┘
```

**What an athlete sees, exhaustively:**

| Shown | Not shown |
|---|---|
| Other athletes' names, as displayed elsewhere in the app | Any other metric about another athlete |
| Their position | Another athlete's position on a board this athlete is not on |
| The single ranked metric value | The underlying entries, sessions or dates behind another athlete's value |
| The count of athletes in the ranking | Which athletes are excluded, or why |
| The window and the aggregation rule in plain English | Whether another athlete opted out |
| Their own change in position since a previous point | Another athlete's change in position |
| Their own PB and own supporting detail | Another athlete's PB, trend, or history |
| The provenance summary for the board | Another athlete's availability, injury or wellness state |

The exclusion list matters as much as the inclusion list. A leaderboard that says "2 athletes
excluded: M. Chen, D. Rahman" tells the squad that those two did not test, which is
information about them that they did not consent to share. The count is shown, the names are
not.

### Staff, web, 1280 pt

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Fydr  [Group filter: All squad ▾]  [Period: Season ▾]                       Alex R  ▾    │
├────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard  │  Leaderboards                                            [+ New leaderboard]│
│ ...        │  ┌───────────────────────────┬────────────────────────────────────────────┐│
│ More       │  │ Boards (9)                │  CMJ height                    [Edit] [⋯] ││
│  ▸ Leader  │  │ ─────────────────────────  │  Squad · season to 5 Aug 2026 · best result││
│            │  │ ● CMJ height          pub │  Published to athletes · 2 opted out        ││
│            │  │ ● Total gym volume    pub │ ───────────────────────────────────────────││
│            │  │ ● Running distance    pub │   1  J. Okafor      45.6 cm  ▬   PB 13 Aug ││
│            │  │ ○ 1RM back squat      dft │   2  L. Ferreira    44.8 cm  ▲2  PB 13 Aug ││
│            │  │ ○ Yo-Yo IR1           dft │   3  T. Bennett     43.1 cm  ▼1  PB 12 Mar ││
│            │  │ ● Wellness compliance pub │   4  A. Mwangi      42.9 cm  ▲1             ││
│            │  │ ● Programme adherence pub │   5  M. Price       42.8 cm  ▼2             ││
│            │  │ ○ 10 m sprint         dft │   6  K. Doherty     41.2 cm  ▬              ││
│            │  │ ● Sessions attended   pub │   7  S. Adeyemi     39.4 cm  ▲3  PB 13 Aug ││
│            │  │                           │   ...                                       ││
│            │  │ [ Manage opt-outs ]       │  36  C. Whelan      31.0 cm  ▬              ││
│            │  │                           │ ───────────────────────────────────────────││
│            │  │                           │  Not ranked (2)                             ││
│            │  │                           │   M. Chen      no result in window          ││
│            │  │                           │   D. Rahman    opted out                    ││
│            │  │                           │ ───────────────────────────────────────────││
│            │  │                           │  n = 36 of 38 athletes · season to 5 Aug    ││
│            │  │                           │  2026 · Sources: staff entered 100%         ││
│            │  └───────────────────────────┴────────────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

Staff see the "Not ranked" section with names and a single undifferentiated reason, "opted out". A medical suppression must be indistinguishable from an athlete's own opt-out: `leaderboard_opt_outs.reason` and `opt_out_source` are never surfaced to a coach, because a physio's reason for suppressing a board is clinical context by implication (`04-data-model.md` §17.5). Athletes see only the count. This is
the single most important difference between the two renderings.

### The builder

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ New leaderboard                                                    [Cancel]  [Save]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Metric                                                                              │
│    Domain:  [ Testing ▾ ]                                                              │
│    Metric:  [ CMJ height ▾ ]        cm · higher is better                              │
│    ⓘ Some metrics cannot be ranked. [Why?]                                             │
│                                                                                        │
│ 2. Aggregation                                                                         │
│    (•) Best in window    ( ) Latest in window    ( ) Mean    ( ) Total    ( ) Count     │
│    ⓘ "Best" uses the direction of the metric: highest for CMJ, lowest for a sprint.    │
│                                                                                        │
│ 3. Population                                                                          │
│    (•) Whole squad    ( ) Group: [ ▾ ]    ( ) Selected athletes                        │
│    [ ] Exclude athletes who are currently unavailable                                  │
│    [ ] Exclude athletes with fewer than [ 3 ] qualifying records                        │
│                                                                                        │
│ 4. Window                                                                              │
│    ( ) Last 7 days  ( ) Last 28 days  (•) This season  ( ) All time  ( ) Custom        │
│                                                                                        │
│ 5. Visibility                                                                          │
│    ( ) Staff only                                                                      │
│    (•) Published to athletes in the population                                         │
│        [ ] Show full ranking     (•) Show top 10 plus the athlete's own position       │
│        [x] Allow athletes to opt out                                                   │
│                                                                                        │
│ 6. Name                                                                                │
│    [ CMJ height                                                    ]                   │
│                                                                                        │
│ ── Preview ────────────────────────────────────────────────────────────────────────── │
│   1  J. Okafor  45.6    2  L. Ferreira  44.8    3  T. Bennett  43.1   ... 36 ranked    │
│   ✓ 36 athletes qualify. Above the 3-athlete minimum.                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

When an ineligible metric is chosen:

```
│    Metric:  [ Readiness score ▾ ]                                                      │
│                                                                                        │
│  ⚠ Readiness score cannot be ranked.                                                   │
│    It is derived from sleep, fatigue, soreness, stress and mood, which athletes         │
│    report about themselves in confidence. Ranking it publishes a health disclosure      │
│    to the squad and gives every athlete a reason to report a better number than they    │
│    have. That destroys the data the flag system depends on.                             │
│                                                                                        │
│    You can still see readiness across the squad on the Dashboard and in Analytics,      │
│    which are staff-only.                                            [Choose another]    │
```

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Staff only. Scopes the board list and, where a board is squad-wide, filters the displayed ranking without changing the ranking itself |
| `PeriodSelector` | §6.8 | Staff only, on the board list. A board's own window is fixed by its definition |
| `AthleteCard` | §6.1 | Not used for rows. A leaderboard row deliberately carries less than an `AthleteCard`, and reusing it invites someone to add availability or a flag badge to it |
| `EmptyState` | §6.16 | `notStarted`, `noData`, `insufficientData`, `noResults`, `noPermission` |
| `ConfirmSheet` | §6.18 | Publish, unpublish, delete, opt out |
| `BottomSheet` | §6.19 | Metric picker, aggregation picker, "why can't I rank this" explainer |
| `LeaderboardRow` | New, this screen | Position, name, value, own-row emphasis. Renders **only** those fields, by type |
| `LeaderboardCard` | New, this screen | Athlete list item: board name, population, window, own position and movement |
| `MetricPicker` | New, this screen | Domain then metric, with ineligible metrics shown disabled and explained rather than hidden |
| `EligibilityNotice` | New, this screen | The explanation shown when an ineligible metric is chosen |
| `PopulationPicker` | New, this screen | Squad, group, or selected athletes, plus qualification filters |
| `LeaderboardPreview` | New, this screen | Live preview in the builder with the qualifying count and the minimum-n check |
| `OptOutManager` | New, this screen | Staff view of who has opted out of what, counts only where identity is not needed |
| `ProvenanceFooter` | Shared, from §8.3 | n, window, coverage and sources. Mandatory on every board |

`LeaderboardRow` having a narrow, fixed prop type is a deliberate defence. If the row cannot
accept an availability status, nobody can add one in a hurry before a demo.

---

## Data requirements

### The metric catalogue

A leaderboard metric is a named, versioned definition in a catalogue, not an arbitrary column
reference. This is what makes "leaderboard → everything" safe: everything the catalogue
contains, and nothing else.

| Change | Table | Why |
|---|---|---|
| New table `metric_definitions` | new | The catalogue. Shared with `analytics.md` and `thresholds.md`, so a metric is defined once |
| New table `leaderboards` | new | A board's configuration. Could live in `saved_views` with `view_type = 'leaderboard'`, but publication state, opt-outs and eligibility need columns and constraints, not a `jsonb` blob |
| New table `leaderboard_opt_outs` | new | Per athlete, per board or global |

```sql
create table metric_definitions (
  key                text primary key,          -- 'testing.cmj_height', 'gym.total_volume'
  domain             flag_domain not null,
  label              text not null,
  unit               text not null,
  higher_is_better   boolean not null,
  source_table       text not null,
  aggregations       text[] not null,           -- allowed: best|latest|mean|total|count
  leaderboard_eligible boolean not null default false,
  ineligible_reason  text,
  analytics_eligible boolean not null default true,
  threshold_eligible boolean not null default true,
  min_population     int not null default 3,
  requires_tier      subscription_tier
);

create table leaderboards (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id),
  name            text not null,
  metric_key      text not null references metric_definitions(key),
  test_definition_id uuid references test_definitions(id),   -- when metric_key is a test
  aggregation     text not null,                             -- best|latest|mean|total|count
  population_type text not null,                             -- squad|group|selected
  group_id        uuid references groups(id),
  athlete_ids     uuid[],
  exclude_unavailable boolean not null default false,
  min_records     int not null default 1,
  window_type     text not null,                             -- days|season|all_time|custom
  window_days     int,
  window_from     date,
  window_to       date,
  visibility      text not null default 'staff',             -- staff|published
  athlete_view    text not null default 'top_n_plus_self',   -- full|top_n_plus_self
  top_n           int not null default 10,
  allow_opt_out   boolean not null default true,
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (org_id, name),
  check (population_type <> 'group' or group_id is not null),
  check (population_type <> 'selected' or athlete_ids is not null)
);

create table leaderboard_opt_outs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id),
  athlete_id     uuid not null references athletes(id),
  leaderboard_id uuid references leaderboards(id) on delete cascade,  -- null = all boards
  opted_out_by   uuid not null references users(id),
  opt_out_source text not null,        -- 'athlete' | 'medical' | 'admin'
  reason         text,
  created_at     timestamptz not null default now(),
  ended_at       timestamptz,
  unique (athlete_id, leaderboard_id)
);

create index on leaderboards (org_id, visibility) where deleted_at is null;
create index on leaderboard_opt_outs (athlete_id) where ended_at is null;
```

### The eligibility list

Seeded into `metric_definitions`. This table is the specification of "everything" in
"leaderboard → everything".

| Metric key | Domain | Eligible | Reason if not |
|---|---|:--:|---|
| `testing.<any non-body-comp definition>` | testing | **Yes** | |
| `gym.total_volume_kg` | gym | **Yes** | |
| `gym.sessions_completed` | gym | **Yes** | |
| `gym.programme_adherence_pct` | gym | **Yes** | |
| `gps.total_distance_m` | gps | **Yes** | |
| `gps.high_speed_distance_m` | gps | **Yes** | |
| `gps.sprint_distance_m` | gps | **Yes** | |
| `gps.max_speed_ms` | gps | **Yes** | |
| `gps.accelerations` | gps | **Yes** | |
| `gps.running_distance_m` | gps | **Yes** | Added by migration 0056, see note below |
| `gps.high_intensity_efforts` | gps | **Yes** | Added by migration 0056, see note below |
| `gps.decelerations` | gps | **Yes** | Added by migration 0056, see note below |
| `gps.player_load` | gps | **Yes** | Added by migration 0056, see note below |
| `compliance.wellness_pct` | compliance | **Yes** | |
| `compliance.rpe_pct` | compliance | **Yes** | |
| `compliance.overall_pct` | compliance | **Yes** | |
| `training.sessions_attended` | training | **Yes** | |
| `training.total_session_load` | training | **Yes** | Eligible but discouraged, see below |
| `wellness.sleep_hours` | wellness | **No** | Health data reported in confidence |
| `wellness.sleep_quality` | wellness | **No** | Subjective self-report, gameable |
| `wellness.fatigue` | wellness | **No** | Same |
| `wellness.soreness` | wellness | **No** | Same, and a proxy for injury |
| `wellness.stress` | wellness | **No** | Mental health disclosure |
| `wellness.mood` | wellness | **No** | Mental health disclosure |
| `wellness.readiness_score` | wellness | **No** | Composite of all of the above |
| `wellness.resting_hr` | wellness | **No** | Physiological health measure |
| `wellness.body_mass_kg` | wellness | **No** | Body composition. See below |
| `body_comp.body_mass_kg` | testing | **No** | Body composition |
| `body_comp.body_fat_pct` | testing | **No** | Body composition |
| `body_comp.lean_mass_kg` | testing | **No** | Body composition |
| `body_comp.sum_skinfolds_mm` | testing | **No** | Body composition |
| `injury.days_available` | medical | **No** | Availability is medical information |
| `injury.injury_count` | medical | **No** | Medical information |
| `analytics.acwr` | gps | **No** | A risk indicator, not a performance measure |

**What is actually seeded, as of migration 0056.** The `gps.*` and `training.*` rows above
are live; the `testing.*`, `gym.*` and `compliance.*` rows are still waiting on the same
"the source table has to exist first" rule migration 0016 set out, and the ineligible rows
are seeded where their metric exists (the six wellness/body-mass ones) or are covered by the
prohibition without a row where it does not.

Migration 0056 seeded nine GPS metrics, four more than the five this table originally
listed. The four additions — `running_distance_m`, `high_intensity_efforts`,
`decelerations`, `player_load` — are columns `gps_records` really has (migration 0023) and
that the dev database really populates, and they are the metrics a coach asks for beside the
five above: deceleration load is half of the change-of-direction picture accelerations only
half-answer, and `player_load` is the vendor's own composite. Each is a volume or intensity
output with the same `higher_is_better = true` direction as its neighbours, so none of them
changes the shape of this list, only its length.

Three `gps_records` columns are deliberately **not** here. `impacts` and
`metabolic_power_avg` hold no non-null value in any real import to date, and a catalogue row
for an always-null column ships a builder chip that produces an empty board. `duration_s` is
fully populated and still excluded: it measures how long an athlete was on the pitch, which
is a selection fact rather than an output, and `higher_is_better` has no honest answer for
it. See migration 0056's header for the row counts behind each decision.

### Why wellness must never be leaderboarded

Four arguments, in order of strength.

1. **It is health data disclosed in confidence.** Sleep, fatigue, soreness, stress and mood are
   special category data under UK GDPR Article 9. `09-security-and-compliance.md` §3 sets out
   the lawful basis for a club processing them for athlete monitoring. Publishing them to
   teammates is a different processing purpose with no basis at all, and no reasonable athlete
   consenting to wellness monitoring expects their stress score shown to the squad.
2. **It is trivially gameable, and ranking guarantees gaming.** A wellness entry is a
   self-report with no verification. The moment it is ranked, reporting a 5 costs nothing and
   reporting a 2 costs status. `00-product-overview.md` claim 2 says the flag system *is* the
   product. A leaderboard on wellness converts the flag system's input into a performance,
   which does not degrade the data slightly, it invalidates it. Nothing else in Fydr works
   after that.
3. **Ranking soreness ranks injury risk.** Soreness is the earliest signal of a soft-tissue
   problem, and it is the field most directly connected to `injuries`. A public soreness
   ranking tells the squad who is carrying something, and tells the athlete carrying something
   to stop reporting it. Both outcomes are worse than having no leaderboard.
4. **Mood and stress are mental health disclosures.** A squad-visible ranking of who is
   struggling is an actively harmful product feature in a population with known mental health
   pressures. There is no version of this that is acceptable with a consent checkbox.

The counter-argument, which is worth stating because a client will make it: *wellness
compliance* is a useful, motivating, harmless thing to rank. That is correct, and it is why
`compliance.wellness_pct` is eligible while every wellness *value* is not. Ranking whether an
athlete submitted their entry is a behaviour. Ranking what the entry said is a disclosure.

### Why body composition must never be leaderboarded

1. **It is a direct trigger for disordered eating.** Squad sports have a documented prevalence
   of disordered eating and relative energy deficiency. A ranked list of body fat percentage or
   body mass, visible to teammates, is a known risk factor, deployed at scale, by the club's
   own software. No feature in this product is worth that.
2. **It is health data**, on the same Article 9 footing as wellness.
3. **It is not a performance measure.** Lower body fat is not better in every position, and a
   prop and a winger on the same list is meaningless. Ranking it asserts a hierarchy that the
   underlying measure does not support.
4. **The measurement error is large relative to the differences.** Skinfold measurement varies
   between practitioners by more than the gap between adjacent athletes on a squad list. The
   ranking would be substantially an artefact of who held the callipers.

Enforcement is not a UI convention. `metric_definitions.leaderboard_eligible` is false for
every wellness and body composition metric, and the query that builds a board joins that table.
`test_definitions.leaderboard_eligible` is forced false for `test_category = 'body_comp'` by a
check constraint. A board cannot be created on an ineligible metric by any client, including a
direct PostgREST call, because the RLS-protected insert validates against the catalogue.

#### The staff-set body-mass target range is *more* unrankable than the measurement

Migration 0060 adds `body_mass_target_ranges` — the range staff want an athlete's mass to sit in.
The client's fourth rule for it was "never on a leaderboard", and it deserves a stronger guard than
`leaderboard_eligible = false`, because ranking a *target* would publish what staff privately want
an athlete's body to be, which is worse on every count listed above than ranking the measurement.

So the guarantee is structural rather than a catalogue flag, and it rests on **four independent
locks**. `supabase/tests/320_body_mass_target_ranges_test.sql` §6 asserts all four separately, so
any one regressing fails the suite even while the other three hold:

1. **No catalogue row names it.** Nothing in `metric_definitions` has it as `source_table`, and no
   metric key or label refers to a target range. `compute_leaderboard` computes from that table, so
   nothing points at it and nothing here is computable.
2. **No client can add one.** `authenticated` holds `SELECT` only on `metric_definitions` — the
   catalogue is seeded by migration, "the same posture as an enum" (migration 0016). Lock 1 cannot
   be unlocked at runtime by any role.
3. **`leaderboards.metric_key` is a foreign key into the catalogue.** A board naming a metric that
   does not exist is refused by the database, not by an application check somebody can forget. Even
   a coach with full board-authoring rights cannot name it.
4. **Nothing in the schema reads the table** except its own guard trigger. No function body and no
   view definition mentions it, so there is no security-definer side door around locks 1–3 — which
   matters specifically because `compute_leaderboard` *is* `security definer` and therefore bypasses
   the RLS that keeps the table staff-only in the first place.

### Metrics that are eligible but discouraged

`training.total_session_load` is rankable and probably should not be ranked. Rewarding the
highest accumulated load encourages athletes to inflate RPE and to train through fatigue, which
is the opposite of what a load-monitoring product is for. It is left eligible because a coach
may have a legitimate short-term use, and the builder shows a caution when it is selected:
"Ranking total load rewards doing more. Consider ranking adherence to prescribed load instead."

### Query: build a ranking

```sql
create or replace function public.compute_leaderboard(p_leaderboard_id uuid)
returns table (
  position        int,
  athlete_id      uuid,
  first_name      text,
  last_name       text,
  value           numeric,
  record_count    int,
  is_tied         boolean,
  previous_position int
)
language plpgsql
stable
security invoker
as $$
declare
  lb        leaderboards%rowtype;
  md        metric_definitions%rowtype;
  v_from    date;
  v_to      date;
begin
  select * into lb from leaderboards
   where id = p_leaderboard_id and org_id = auth_org_id() and deleted_at is null;
  select * into md from metric_definitions where key = lb.metric_key;

  if not md.leaderboard_eligible then
    raise exception 'Metric % is not eligible for leaderboards: %',
      md.key, coalesce(md.ineligible_reason, 'not eligible');
  end if;

  v_to := coalesce(lb.window_to, current_date);
  v_from := case lb.window_type
              when 'days'     then v_to - lb.window_days
              when 'season'   then (select starts_on from seasons
                                    where org_id = lb.org_id and is_current limit 1)
              when 'all_time' then '1900-01-01'::date
              else lb.window_from
            end;

  return query
  with population as (
    select a.id as athlete_id, a.first_name, a.last_name
    from athletes a
    where a.org_id = lb.org_id
      and a.deleted_at is null
      and a.status <> 'left_club'
      and (
        lb.population_type = 'squad'
        or (lb.population_type = 'selected' and a.id = any(lb.athlete_ids))
        or (lb.population_type = 'group' and exists (
              select 1 from group_memberships gm
              where gm.athlete_id = a.id and gm.group_id = lb.group_id
                and gm.removed_at is null)))
      and (not lb.exclude_unavailable or coalesce((
            select av.status from availability av
            where av.athlete_id = a.id and av.effective_to is null
            order by av.effective_from desc limit 1), 'available') = 'available')
      and not exists (
        select 1 from leaderboard_opt_outs o
        where o.athlete_id = a.id
          and (o.leaderboard_id = lb.id or o.leaderboard_id is null)
          and o.ended_at is null)
      -- Children's Code standard 7, high privacy by default. An athlete under 18 is on a
      -- board only where they granted leaderboard_visibility themselves. This is the
      -- inverse of the adult rule above and it is deliberately in the query, not the UI:
      -- see 09-security-and-compliance.md 4.6 and the note below.
      and (not athlete_is_minor(a.id)
           or exists (
             select 1 from athlete_consents c
             where c.athlete_id = a.id
               and c.purpose = 'leaderboard_visibility'
               and c.granted_at is not null
               and c.withdrawn_at is null))
  ),
  raw as (
    -- One row per athlete per qualifying record, from the metric's source
    select * from public.metric_records(lb.metric_key, lb.test_definition_id,
                                        array(select athlete_id from population),
                                        v_from, v_to)
  ),
  agg as (
    select
      r.athlete_id,
      count(*)::int as record_count,
      case lb.aggregation
        when 'best'   then case when md.higher_is_better
                                then max(r.value) else min(r.value) end
        when 'latest' then (array_agg(r.value order by r.record_date desc))[1]
        when 'mean'   then avg(r.value)
        when 'total'  then sum(r.value)
        when 'count'  then count(*)::numeric
      end as value
    from raw r
    group by r.athlete_id
    having count(*) >= lb.min_records
  ),
  ranked as (
    select
      p.athlete_id, p.first_name, p.last_name,
      a.value, a.record_count,
      rank() over (order by
        case when md.higher_is_better then a.value end desc nulls last,
        case when not md.higher_is_better then a.value end asc nulls last
      )::int as position,
      count(*) over (partition by a.value) > 1 as is_tied
    from population p
    join agg a on a.athlete_id = p.athlete_id
  )
  select r.position, r.athlete_id, r.first_name, r.last_name,
         r.value, r.record_count, r.is_tied,
         null::int as previous_position
  from ranked r
  order by r.position, r.last_name;
end;
$$;
```

`metric_records` is a dispatcher returning `(athlete_id, record_date, value)` for a metric key,
shared with `analytics.md` and the flag engine. Defining the metric-to-source mapping once is
what keeps a leaderboard, a chart and a threshold agreeing about what "total gym volume" means.

### The minimum-population guard

Per `06-design-system.md` §8.5, a leaderboard rank requires **3 athletes with a qualifying
result**. Below that the board renders `insufficientData`: "Not enough results to rank. 2 of 3
athletes have a result."

The guard is not only statistical. On a two-athlete board, "2nd of 2" is a public statement
about one identifiable person with no context, and on a three-athlete board it is barely
better. `metric_definitions.min_population` allows a higher floor per metric, and compliance
metrics default to 5 because a compliance ranking on a small group is a naming exercise.

### Query: the athlete's own view

```sql
select
  l.id, l.name, l.metric_key, md.label, md.unit, l.aggregation,
  l.window_type, l.window_days, l.athlete_view, l.top_n, l.allow_opt_out,
  c.position, c.value, c.is_tied,
  (select count(*) from compute_leaderboard(l.id)) as ranked_count
from leaderboards l
join metric_definitions md on md.key = l.metric_key
cross join lateral compute_leaderboard(l.id) c
where l.org_id = auth_org_id()
  and l.deleted_at is null
  and l.visibility = 'published'
  and c.athlete_id = auth_athlete_id()
order by l.name;
```

An athlete's list contains only boards where `compute_leaderboard` returns them. A board they
are excluded from, opted out of, or unqualified for does not appear at all. It is not shown
greyed with an explanation, because "you are not on the CMJ board" invites the question "who
is" and there is no good answer to give an athlete.

### Writes

| Action | Write | Audit |
|---|---|---|
| Create a board | Insert `leaderboards`, `visibility = 'staff'` | `leaderboard.create` |
| Publish | Update `visibility = 'published'` | `leaderboard.publish`, with the metric and population recorded |
| Unpublish | Update `visibility = 'staff'` | `leaderboard.unpublish` |
| Delete | Soft delete | `leaderboard.delete` |
| Athlete opts out | Insert `leaderboard_opt_outs` with `opt_out_source = 'athlete'` | `leaderboard.opt_out` |
| Athlete opts back in | Set `ended_at` | `leaderboard.opt_in` |
| Medical suppression | Insert with `opt_out_source = 'medical'` and a reason | `leaderboard.suppress` |
| Global opt-out | Insert with `leaderboard_id = null` | `leaderboard.opt_out_all` |

Publication is audited because it is a disclosure decision. `09-security-and-compliance.md`
§8.5 requires an audit trail for consent changes, and publishing a board changes who can see
whose data.

---

## States

### Default

**Staff**: board list, published first, then drafts, alphabetical within each. First board
selected on web, list only on mobile.

**Athlete**: the boards they appear on, ordered by their own position ascending, so the board
they are doing best on is first. This is a deliberate motivational ordering and it is also the
ordering least likely to open the app on a discouraging number.

### Loading

Board list from cache immediately. Rankings load per board; each board card shows a skeleton
position until it arrives. Rankings are cached with a 5-minute `staleTime`, per
`05-architecture.md` §9, so a repeat visit is instant.

### Empty

| Kind | Trigger | Copy | Action |
|---|---|---|---|
| `notStarted` | Staff, no boards | "No leaderboards yet. Any eligible metric can be ranked." | "Create a leaderboard" |
| `notStarted` | Athlete, no published boards | "No leaderboards yet." | none |
| `noData` | Athlete opted out of everything | "You have left all leaderboards. You can rejoin at any time from Me → Privacy." | "Rejoin" |
| `noData` | Board has a population but no records in the window | "No CMJ height results between 1 July and 5 August." | Staff: "Schedule testing". Athlete: none |
| `insufficientData` | Fewer than `min_population` qualifying | "Not enough results to rank. 2 of 3 athletes have a result." | none |
| `noResults` | Staff group filter excludes every ranked athlete | "No athletes in Academy appear on this board." | "Clear filter" |
| `noPermission` | Athlete deep-linking an unpublished or unqualified board | "This leaderboard is not available." | "Back to leaderboards" |

The `noPermission` copy for an athlete is deliberately uninformative. "You are not eligible for
this board" tells them a board exists that they are excluded from, which is a small disclosure
with no benefit.

### Error

Per §11.3. A board whose ranking fails renders the card with "Ranking unavailable" and leaves
the rest of the list working. An athlete never sees a partial ranking: if the query fails, the
board shows the error state rather than a list missing rows, because a leaderboard with rows
silently missing is a factual claim that is wrong.

A board on a metric that has become ineligible, for example a test definition reclassified as
body composition, fails closed. The function raises, the board renders "This leaderboard is no
longer available" for athletes and, for staff, "CMJ height was reclassified as a body
composition test on 4 August and can no longer be ranked."

### Offline

Cached rankings render with the offline chip and the cache timestamp. No board is computed
offline. Opt-out is a staff-owned write in schema terms but an athlete-initiated action, and it
is **queued** when offline, with the confirmation "You have left this leaderboard. It will be
removed when you are back online." Blocking a privacy action on connectivity is the wrong
default. Until it syncs, the board is hidden locally so the athlete's experience matches their
choice immediately.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | Full builder, full rankings, the "Not ranked" section with names and reasons, opt-out management |
| Medical | Same, plus the ability to suppress an athlete from a board on clinical grounds. Suppression reasons are visible to medical only, and coaches see the athlete in the "Not ranked" list with reason **"opted out"**, the same string used for every other exclusion and no detail |
| Athlete | View only. Own row emphasised. Top-N plus own position by default. No "Not ranked" names, only a count. No access to boards they are not on. Opt-out control at the foot of every board |
| Admin | Board names, participation counts, opt-out counts. No names against values. Rendered as an aggregate table, not as a ranking |

---

## Interactions

### Building a board

Six steps in the order shown in the wireframe, because each constrains the next: the metric
determines which aggregations are legal, the aggregation determines whether "best" has meaning,
the population determines whether the minimum is met, and the preview confirms it.

**Metric picker behaviour.** Ineligible metrics are **shown and disabled**, not hidden.
Hiding them produces a support question ("why can't I rank sleep") that a coach asks the club
rather than the product. Selecting one opens `EligibilityNotice` with the argument in plain
English, as in the wireframe, plus the alternative that is available: the staff-only analytics
view.

**Aggregation semantics**, stated in the UI at the point of choice:

| Aggregation | Means | Legal for |
|---|---|---|
| Best in window | The single best record, using the metric's direction | Testing, GPS peaks |
| Latest in window | The most recent record | Testing, body-mass-independent measures |
| Mean | Average across records | Compliance, adherence, per-session GPS |
| Total | Sum across records | Volume, distance, sessions |
| Count | Number of qualifying records | Attendance, sessions completed |

`metric_definitions.aggregations` restricts the choices, so "total CMJ height" is not
offerable.

**Population.** Squad, one group, or a hand-picked set. Group boards use current membership at
compute time, not at creation time, so an athlete joining Forwards appears the next day.

**Qualification filters.** "Exclude athletes with fewer than N qualifying records" is the
control that stops a 28-day GPS distance board being topped by an athlete who trained once and
ran a long way. It defaults to 1 and the builder suggests a higher value when the aggregation
is `mean`.

**Window.** Last 7 days, last 28 days, this season, all time, custom. All time is offered
because a club PB board is a legitimate and popular thing, and it is the one case where the
window genuinely is unbounded.

**Visibility.** Staff-only by default. Publishing is a deliberate act with a confirmation that
names what is about to be disclosed:

```
Publish "CMJ height" to athletes?

36 athletes will be able to see:
  · every ranked athlete's name and CMJ height
  · their own position

They will not see any other data about each other.

Athletes can leave this leaderboard at any time.

                              [Cancel]  [Publish]
```

**Athlete view mode.** Full ranking, or top 10 plus own position. Top-N-plus-self is the
default. It preserves the motivation of a leaderboard for the people near the top and does not
publish a bottom-of-the-squad position to the whole squad. See O-279.

### Opt-out

`09-security-and-compliance.md` §6 lists leaderboards among the genuinely consent-based
processing, alongside HealthKit, wearables and photographs, and Article 7(3) requires that
withdrawal is as easy as giving consent. That has three consequences.

1. **A one-tap "Leave this leaderboard" control at the foot of every board**, no confirmation
   friction beyond a single sheet, no reason required, effective immediately in the UI.
2. **A global opt-out** in `Me → Privacy`: "Do not include me on any leaderboard." One toggle,
   effective across every board including future ones.
3. **Rejoining is equally easy**, from the same places.

Opt-out behaviour in the ranking:

- The athlete is removed from the population before ranking, so positions close up. They are
  not shown as a blank row.
- Other athletes see the ranked count fall by one and see no name. The "not ranked" count
  visible to athletes aggregates opt-outs with no-data exclusions, so an opt-out is not
  distinguishable from not having been tested.
- Staff see the opt-out explicitly, because a coach chasing a missing test result needs to know
  the athlete opted out rather than missed the session. This is a genuine asymmetry: the squad
  cannot tell, the coach can.
- An opted-out athlete still sees their own value in `my-data.md`. Opting out of a leaderboard
  is opting out of disclosure, not out of measurement.

### Athletes under 18: opt-in, not opt-out

**Changed 5 August 2026.** Under-18 athletes are in scope (`09-security-and-compliance.md` §4),
which makes standard 7 of the Children's Code, high privacy by default, binding here. O-280 is
resolved: **an athlete under 18 is not on any leaderboard unless they turned leaderboard
visibility on themselves.**

| | Adult | Under 18 |
|---|---|---|
| Default | On the board, one-tap opt-out | **Off the board** |
| To appear | Nothing to do | The athlete grants `leaderboard_visibility` in the Me tab, and where the club requires parental involvement that must be recorded first (`screens/onboarding.md` step 6) |
| To leave | One tap, immediate | Same |
| Who can turn it on for them | Nobody. A coach cannot add an athlete to a board against the setting | Nobody, and an org-level setting cannot override it |

Consequences to build for rather than discover:

1. **The rule lives in `compute_leaderboard`**, in the population CTE above, not in the client.
   A default enforced in the UI is a default that a direct API call ignores, and this one has to
   survive a reviewer asking how it is enforced.
2. **An academy board may be empty, and that is the correct output.** A coach building a board on
   an under-18 group sees `insufficientData` until athletes opt in. The builder warns at
   configuration time rather than letting the coach discover it after publishing: "12 of 14
   athletes in Colts are under 18 and are not shown on leaderboards unless they choose to be."
3. **The minimum-population guard applies after the minor exclusion**, so a mixed-age board that
   drops below 3 ranked athletes renders `insufficientData` rather than ranking the two adults.
   That is the right failure: it also stops a board becoming a way of identifying which athletes
   are minors.
4. **Turning 18 does not opt an athlete in.** The consent row is absent, not implied, and the
   athlete is told once that the option now exists (`screens/onboarding.md` step 4).
5. **Staff see the reason.** A coach chasing a missing name sees "not shown, under 18" in the
   staff view, the same asymmetry already specified for opt-outs. The squad sees nothing, because
   the "not ranked" count aggregates it with every other exclusion.

`[high on the requirement, medium on whether opt-in for minors is commercially painless. It is
not: an academy leaderboard will be sparse for a season. The alternative is a public ranking of
children who did not ask to be ranked, and that is not defensible under the Code.]`

**Opt-out is not defaulted on for adults.** Boards are published opt-out rather than opt-in, which is a
choice that needs stating: making leaderboards opt-in produces boards with four people on them
and no reason for anyone to look. The consent position that supports opt-out is that the
underlying processing is on legitimate interests for athlete monitoring, and the leaderboard is
an additional disclosure with a genuine, easy, prospective withdrawal. Whether that survives a
DPO's review is O-278.

### Medical suppression

A physio may suppress an athlete from a board without the athlete acting, for example an
athlete in recovery from an eating disorder for whom any ranked list is harmful, or an athlete
whose test result reflects an injury. It is recorded with a reason, visible to medical only,
and it looks identical to an opt-out from every other perspective.

### Movement and change

Change in position is shown for the athlete's own row only, and to staff for every row. It is
computed against a stored snapshot rather than recomputed history, because recomputing "where
was this board a month ago" against today's group membership and today's opt-outs produces a
number that is not a comparison of anything.

| Change | Table | Why |
|---|---|---|
| New table `leaderboard_snapshots` | new | `(leaderboard_id, snapshot_date, athlete_id, position, value)`, written weekly by a `pg_cron` job and on publish |

Movement is against the most recent snapshot at least 7 days old, and the UI names it: "up 3
since 1 July", never a bare arrow.

### Staff filtering

The global group filter applies to what a staff member **sees**, not to how the board is
**ranked**. Filtering a squad board to Forwards shows the forwards with their squad-wide
positions, so a forward ranked 7th overall shows as 7th, not as 2nd. The header states this:
"Showing 18 of 36 ranked athletes. Positions are squad-wide."

Silently re-ranking within a filter would mean two coaches quoting different positions for the
same athlete on the same board, which is exactly the confusion `CLAUDE.md` §3 requires the
persistent filter indicator to prevent.

---

## Validation rules

| Rule | Severity | Message |
|---|---|---|
| Name 1 to 60 characters, unique per org | Block | "A leaderboard called 'CMJ height' already exists." |
| Metric is `leaderboard_eligible` | Block, server-enforced | The eligibility notice, with the metric's reason |
| Test-based metric on a `body_comp` test | Block | "Body composition tests cannot appear on leaderboards." |
| Aggregation in `metric_definitions.aggregations` | Block | "Total is not a meaningful aggregation for CMJ height." |
| Population resolves to at least `min_population` athletes | Block on publish, warn in draft | "Only 2 athletes qualify. A leaderboard needs at least 3." |
| Group population with a group that has no members | Block | "Academy has no members." |
| `window_days` 1 to 365 | Block | "The window must be between 1 and 365 days." |
| Custom window: `window_to` after `window_from` | Block | "The end date must be after the start date." |
| `min_records` 1 to 100 | Block | "Between 1 and 100 qualifying records." |
| `top_n` 3 to 50 | Block | "Show between 3 and 50 positions." |
| `allow_opt_out` false | Block | Not offerable. Opt-out is not optional, per Article 7(3) |
| Population contains athletes under 18 | Warn at configuration, before publish | "12 of 14 athletes in Colts are under 18 and are not shown unless they choose to be. 2 will appear." |
| Population is entirely under 18 with no opt-ins | Block on publish | "Nobody in this group has chosen to appear on leaderboards." |
| Publishing a board on a Premium-tier metric from a Club-tier org | Block | "GPS leaderboards need the Premium tier." |
| Publishing a board where fewer than 50% of the population qualifies | Warn | "Only 14 of 38 athletes have a result. Publish anyway?" |
| Selecting `training.total_session_load` | Caution, non-blocking | "Ranking total load rewards doing more. Consider adherence instead." |
| Deleting a published board | Warn | "36 athletes can currently see this board. Delete it?" |

The `allow_opt_out` row is worth reading twice. The column exists in the schema for symmetry,
and the product does not allow it to be false. A leaderboard an athlete cannot leave is not
defensible under Article 7(3), and building the toggle invites a club to turn it off.

---

## Edge cases

1. **Ties.** Equal values share a position and the next position skips, standard competition
   ranking: 1, 2, 2, 4. Tied rows carry an "=" prefix and are ordered alphabetically among
   themselves. `rank()` rather than `dense_rank()` for exactly this reason.
2. **An athlete with no result.** Excluded from the ranking, counted in the "not ranked" total.
   Never ranked last with a null, which is the intuitive wrong behaviour and is a public
   statement that they did not turn up.
3. **An athlete who leaves the club mid-season.** Excluded by `status <> 'left_club'`. Their
   historical results remain in `test_results` and in their own export.
4. **An athlete who joins mid-window.** Included if they meet `min_records`. For a `total`
   aggregation over 28 days this favours athletes present for all 28, which the builder warns
   about when `min_records` is 1 and the aggregation is `total`.
5. **A board on a group whose membership changes mid-window.** Membership is evaluated at
   compute time. An athlete who left Forwards yesterday disappears from the Forwards board
   today, including from their own view. This is the simple behaviour and it is stated in the
   board's footer: "Group membership as at today."
6. **All athletes opt out.** The board renders `insufficientData` for staff and disappears from
   every athlete's list. No board is auto-deleted, because opt-outs can end.
7. **An athlete opted out who is nonetheless top of the board.** They are removed and everyone
   below moves up one. Their absence is not detectable from the athlete-facing view, which is
   the point.
8. **An unavailable athlete on a fitness board.** `exclude_unavailable` is off by default,
   because an injured athlete's historical best is still their best and hiding them is its own
   disclosure. Turning it on is available and is a coach's judgement.
9. **A board whose window contains a `file_import` and a `staff_entered` source.** The
   provenance footer states both with percentages, per §8.3. Mixed provenance is not blocked,
   because a GPS board legitimately mixes vendor exports.
10. **A Club-tier organisation with a GPS board.** GPS is Premium-tier only per
    `00-product-overview.md`. Existing boards on a downgraded org are unpublished automatically,
    the admin is notified, and the board is retained rather than deleted.
11. **Two boards with the same metric and different windows.** Permitted, and common: an
    all-time PB board and a this-season board. Names must differ.
12. **An athlete appearing on 9 boards.** The list orders by their own position. No cap, but
    the athlete-facing list is capped at 20 boards with a "show all" affordance, because a
    leaderboard list longer than a screen stops being motivating and starts being a chore.
13. **A leaderboard on a compliance metric where an athlete has waived expectations**, for
    example an athlete who objected to wellness processing under Article 21. Their waived days
    are excluded from both numerator and denominator, so they are not penalised for an exercise
    of a statutory right. If every expectation in the window is waived they do not qualify.
14. **A test whose `higher_is_better` is changed after a board exists.** The board inverts. It
    is recomputed on next read, the change is audited on the definition, and staff see a notice
    on the board: "Direction changed on 4 August. This ranking is now inverted."
15. **A snapshot missing because the job did not run.** Movement is suppressed rather than
    computed against a stale snapshot, with the caption "Movement unavailable".

---

## Performance notes

| Path | Budget |
|---|---|
| Athlete board list, 9 boards | 400 ms p95 server |
| One ranking, 40 athletes, season window | 300 ms p95 server |
| Staff board list with all rankings | 800 ms p95, rankings loaded lazily per board |

Rules:

1. **Rankings are computed, not stored**, with a 5-minute `staleTime` per
   `05-architecture.md` §9. A leaderboard that lags a testing session by an hour is a bug a
   coach will notice on the day they use the feature most.
2. **`metric_records` reads from materialised views where one exists**:
   `mv_daily_athlete_summary` for compliance, `mv_programme_adherence` for gym adherence. Only
   testing and GPS peaks read raw tables, and both are indexed for it.
3. **The athlete list computes each board once**, not once for the position and once for the
   count. The function returns the full ranking and the client takes the count and the own row
   from it.
4. **Top-N-plus-self does not fetch fewer rows.** The full ranking is computed server-side and
   truncated server-side, because computing a position requires the whole population anyway,
   and truncating client-side would ship every athlete's value to every athlete's device.
   **That is a security requirement, not an optimisation**: the athlete's device must never
   receive rows it is not permitted to display.
5. **Query keys**: `qk.leaderboards.list(orgId, role)`,
   `qk.leaderboards.ranking(orgId, boardId)`,
   `qk.leaderboards.mine(orgId, athleteId)`,
   `qk.leaderboards.optOuts(orgId)`.
6. **Freshness**: 5 min `staleTime`, 30 min `gcTime`, per the table in `05-architecture.md` §9.
   No refetch on focus, because a leaderboard changing while an athlete reads it is jarring and
   the data is not time-critical.
7. **Snapshots** are written by a weekly `pg_cron` job, `leaderboard_snapshot`, running at
   local Monday 03:00 alongside the analytics refresh.
8. **Indexes**: the two on `leaderboards` and `leaderboard_opt_outs` above, plus the existing
   `test_results (test_definition_id, test_date desc) where is_best` added in `testing.md`.
9. **Invalidation**: logging a test result invalidates rankings for boards on that test.
   Opting out invalidates that board and the athlete's list. Publishing invalidates every
   athlete's list, which is broad and correct.

---

## Accessibility

1. **The ranking is a real ordered list or table**, with the position as a row header. Each row
   announces "Position 7, S. Adeyemi, 39.4 centimetres". Own row announces "Position 7, you,
   39.4 centimetres, up 3 places since 1 July".
2. **Own-row emphasis is not colour alone.** It carries a border, the label "YOU", and
   `aria-current="true"`.
3. **Movement arrows have text equivalents.** "up 3", "down 4", "no change", never a bare
   glyph.
4. **The provenance footer is part of the accessible description of the board**, not a visual
   caption. A screen reader user must hear "36 of 38 athletes have a result" as part of reading
   the board.
5. **The eligibility notice is `role="alertdialog"`** with the full explanation as its
   accessible description, so the reason is heard, not just "not eligible".
6. **Opt-out is a labelled control**, "Leave the CMJ height leaderboard", not "Leave".
7. **Touch targets** 44 pt. Rows are not interactive on the athlete view, which removes an
   accidental-tap risk on a dense list.
8. **Dynamic type** to 200%. Rows wrap to two lines with the value beneath the name rather than
   truncating the name. A truncated teammate's name on a leaderboard is a small indignity and
   an easy one to avoid.
9. **Reduced motion** removes the position-change animation on refresh. Positions update
   without moving.
10. **Numerals are tabular**, per §5.2, so values align down the column and are comparable at a
    glance.
11. **The board list announces its count** and, for athletes, their own best position: "3
    leaderboards. Your best position is 2nd, on total gym volume."

---

## Open questions

- **O-278**: Are leaderboards opt-out or opt-in? I have specified opt-out with a one-tap
  withdrawal, on the basis that opt-in produces empty boards. `09-security-and-compliance.md`
  §6 lists leaderboards as consent-based processing, and a strict reading of consent requires
  opt-in. This needs the DPO answer, not mine, and it is the highest-risk open question on this
  screen.
- **O-279**: Should the athlete-facing default be the full ranking or top 10 plus own
  position? I have chosen top-N-plus-self, so an athlete ranked 34th of 36 does not publish
  that to the squad. Some coaches will want the full list visible on the grounds that the squad
  knows anyway.
- **O-280**: **Resolved 5 August 2026.** Under-18s are in scope, so they are excluded from every
  board by default and appear only where they granted `leaderboard_visibility` themselves. The
  rule is enforced in `compute_leaderboard`, not in the UI. See the section above.
- **O-281**: **Closed by O-11, 5 August 2026.** Nutrition adherence was eligible here as an
  org-level opt-in. It has been removed from the catalogue along with `compliance.nutrition_pct`,
  because meals and macros are not logged and neither metric has a source
  (`nutrition-guidance.md` §9). **O-890 was resolved the same day** and the weekly check-in now
  produces one metric, `nutrition.protein_target_met_weekly`. It is **prohibited here**, not
  opt-in: `metric_definitions.leaderboard_eligible` is false for it, forced, on the same
  reasoning that bars body composition. Ranking children on a three-level self-report of whether
  they ate enough is the clearest example in the product of a board that should not exist, and
  it would also destroy the honesty of the variable itself, because an athlete ranked on an
  answer stops giving a true one.
- **O-282**: Should positional context be available, so a prop is ranked against props rather
  than against wingers? It makes speed and endurance boards fairer and it makes very small
  populations, which runs into the minimum-population guard immediately.
- **O-283**: Movement is computed against a weekly snapshot. Is weekly the right cadence, and
  should snapshots be taken on publish and on any material configuration change as well? I have
  specified weekly plus on publish.
- **O-284**: Should a coach be able to create a private board visible to one athlete, as a
  personal target? It is a different feature wearing this screen's clothes and I have excluded
  it.
- **O-285**: When an athlete opts out, should their prior appearances in snapshots be purged?
  Withdrawal is prospective under Article 7(3), so past processing was lawful, but a snapshot
  is a stored record of a disclosure. I have specified that snapshots are retained and are
  never displayed for an opted-out athlete.
