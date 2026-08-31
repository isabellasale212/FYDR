# Screen: Testing

> **Layout status**: provisional. Awaiting client design photographs.

Screen 25 in the inventory (`02-information-architecture.md` §5). Reached from
`More → Testing`. The whiteboard drew `Testing ──► Log results` and `──► Left / right
reports`, and both are specified here: bulk logging is the core of this screen, and the
horizontal report pager is specified in `reports.md`.

---

## Purpose

Define standardised tests, schedule a testing session, log the squad's results fast, and read
the history.

Five jobs:

1. **Maintain the test definitions library.** What the club measures, in what unit, with which
   direction meaning better, and under what protocol.
2. **Schedule a testing session** as a `sessions` row with `session_type = 'testing'`, with a
   battery of tests and a participant list.
3. **Log results for the squad efficiently.** This is the load-bearing requirement. Staff test
   30 athletes in an afternoon, standing on a pitch or in a gym, often on one phone or tablet,
   often with no signal. A form that takes eight taps per result does not survive contact with
   that afternoon and the data ends up back in a spreadsheet.
4. **Handle attempts, best-attempt marking, and bilateral tests** correctly, because a CMJ is
   three jumps and an isometric hamstring test has a left and a right, and flattening either
   into a single number destroys the asymmetry analysis that makes the test worth doing.
5. **Show history, personal bests, and squad comparison**, and feed `percent_1rm` programme
   prescriptions from the result.

**What this screen is not.** It is not a force-plate or timing-gate integration. Device import
is Phase 2 file import and Phase 4 vendor API, per `03-flows.md` §7. Everything here is
`staff_entered` provenance with a CSV import path.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full. Define tests, schedule sessions, log results for any athlete, edit and delete results, view all history |
| Medical / Physio | Full, identically. Return-to-play testing is a medical workflow and the same battery is used |
| Athlete | Own results only: history, personal bests, and their position on any leaderboard they appear on. No access to the definitions library, scheduling, or bulk entry. Athlete-facing views are `my-data.md` and `leaderboards.md` |
| Admin | No access |

Per `01-roles-and-permissions.md` §2, athletes have `S` on "View other athletes' test results",
meaning own data only, and coach and medical have `Y` on "Log test results for others".

---

## Entry points

| From | Lands on | Context carried |
|---|---|---|
| `More → Testing` | Sessions tab, upcoming sessions | Group filter |
| `schedule.md`, a `testing` session | Log tab for that session | `session_id` |
| `session-detail.md`, "Log results" | Log tab, fast entry mode, first test in the battery | `session_id`, `test_definition_id` |
| `athlete-profile.md → Testing tab`, "Add result" | Log tab, single-athlete mode | `athlete_id` |
| `programme-builder.md`, "Schedule a test" from the 1RM coverage panel | New session form, that test preselected, missing athletes preselected as participants | `test_definition_id`, `athlete_ids[]` |
| `leaderboards.md`, a test-based leaderboard | Results tab for that test | `test_definition_id`, window |
| `analytics.md`, a testing metric | Results tab | `test_definition_id` |
| Deep link `fydr://testing/session/<id>/log` | Log tab, fast entry | `session_id` |

---

## Layout

Four tabs: **Sessions**, **Log**, **Results**, **Tests**.

### Web, 1280 pt design target

**Sessions tab.**

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Fydr  [Group filter: All squad ▾]  [Period: Season ▾]                       Alex R  ▾    │
├────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard  │  Testing                                          [+ Schedule testing]      │
│ Schedule   │  ┌──────────────────────────────────────────────────────────────────────┐  │
│ Squad      │  │ Sessions │ Log │ Results │ Tests (18)                                  │  │
│ Programmes │  └──────────────────────────────────────────────────────────────────────┘  │
│ More       │                                                                             │
│  ▸ Analyt  │  Upcoming                                                                   │
│  ▸ Reports │  ┌────────────────────────────────────────────────────────────────────────┐│
│  ▸ Leader  │  │ Pre-season testing battery          Thu 13 Aug 2026, 14:00 · MD-4      ││
│  ▸ Testing │  │ 6 tests · 38 athletes · 0 of 228 results logged                        ││
│  ▸ Setting │  │ CMJ height · 10m sprint · 40m sprint · Yo-Yo IR1 · 1RM back squat ·    ││
│            │  │ Nordic break point                                                     ││
│            │  │                       [Log results]  [Edit battery]  [Print sheet]     ││
│            │  └────────────────────────────────────────────────────────────────────────┘│
│            │  Recent                                                                     │
│            │  ┌────────────────────────────────────────────────────────────────────────┐│
│            │  │ Mid-block retest                    Wed 15 Jul 2026 · MD-3      ✓ done  ││
│            │  │ 2 tests · 34 of 38 athletes · 96 results · 4 athletes missing           ││
│            │  │                       [Log results]  [View results]  [Export]          ││
│            │  ├────────────────────────────────────────────────────────────────────────┤│
│            │  │ Baseline testing                    Mon 1 Jul 2026 · no fixture ✓ done  ││
│            │  │ 6 tests · 38 of 38 athletes · 228 results                               ││
│            │  │                       [View results]  [Export]                          ││
│            │  └────────────────────────────────────────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

**Log tab, fast entry mode.** This is the screen the afternoon depends on. One test, the whole
squad, a single column of numbers.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Pre-season testing battery · 13 Aug 2026                      ⟳ 4 queued   [Done]      │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Test:  ◄ [ CMJ height ]  ►   2 of 6      cm · higher is better · 3 attempts               │
│ Mode:  (•) By test   ( ) By athlete      Order: [Squad number ▾]   [ ] Hide completed     │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  #  Athlete           │ Attempt 1 │ Attempt 2 │ Attempt 3 │ Best │ PB      │ vs last     │
│ ────────────────────────────────────────────────────────────────────────────────────────│
│  1  S. Adeyemi        │ [ 38.2  ] │ [ 39.4  ] │ [ 38.9  ] │ 39.4★│ 39.4 PB │ +1.8  ▲     │
│  2  T. Bennett        │ [ 41.0  ] │ [ 40.2  ] │ [       ] │ 41.0 │ 43.1    │ -0.6        │
│  3  M. Chen           │ [ 35.5  ] │ [       ] │ [       ] │ 35.5 │ 35.5 PB │ first test  │
│  4  J. Okafor         │ ⊘ excused                                │ 44.2    │             │
│  5  M. Price          │ [ 42.▮  ] │ [       ] │ [       ] │      │ 42.8    │             │
│  6  D. Rahman         │ [       ] │ [       ] │ [       ] │      │ 37.0    │             │
│ ... 32 more                                                                              │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 14 of 38 athletes logged · 3 excused · ⟳ 4 results waiting to sync                        │
│ [Previous test]                                              [Next test: 10m sprint →]   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

For a bilateral test the attempt columns split:

```
│  #  Athlete           │  A1 L  │  A1 R  │  A2 L  │  A2 R  │ Best L │ Best R │ Asym  │
│ ─────────────────────────────────────────────────────────────────────────────────────│
│  1  S. Adeyemi        │[ 312 ] │[ 298 ] │[ 318 ] │[ 305 ] │  318   │  305   │ 4.1% L│
│  2  T. Bennett        │[ 276 ] │[ 341 ] │[ 281 ] │[ 338 ] │  281   │  341   │ 17.6%R│ ⚠
│  3  M. Chen           │[     ] │[     ] │[     ] │[     ] │        │        │       │
```

**Results tab.** History, personal bests, squad comparison.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Test: [ CMJ height ▾ ]   [Group: All squad ▾]   [Period: Season ▾]      [Export ▾]     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Squad distribution, latest result per athlete                                          │
│   50┤                                                                                   │
│     │                      ·   ·                                                        │
│   45┤            ·    ·  · · · ·  ·                                                     │
│     │        ·  · ·  ·· ·· ·· ·· · ·   ·                                                │
│   40┤ ─────────────────── median 40.1 ────────────────────────                          │
│     │    ·  · ·· ·  ·  ·                                                                │
│   35┤ ·   ·                                                                             │
│     └────────────────────────────────────────────────────────────────                   │
│   n = 36 athletes with a result · 2 athletes excluded, no result in window              │
│   Sources: staff entered 100%                                                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Athlete      │ Latest │ Date      │ PB    │ PB date   │ vs PB  │ Change │ 4-test trend │
│  T. Bennett   │ 41.0   │ 13 Aug 26 │ 43.1  │ 12 Mar 26 │ -4.9%  │ -0.6   │ ▅▇▆▅         │
│  S. Adeyemi   │ 39.4   │ 13 Aug 26 │ 39.4  │ 13 Aug 26 │  PB    │ +1.8   │ ▂▃▄▇         │
│  M. Price     │ 42.8   │ 15 Jul 26 │ 44.0  │ 1 Nov 25  │ -2.7%  │ +0.4   │ ▆▅▆▆         │
│  J. Okafor    │ 44.2   │ 1 Jul 26  │ 45.6  │ 4 Feb 26  │ -3.1%  │ -1.4   │ ▇▇▆▅         │
│  M. Chen      │ 35.5   │ 13 Aug 26 │ 35.5  │ 13 Aug 26 │  PB    │ first  │ ▃            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Tests tab.** The definitions library.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Test definitions (18)                        [+ New test]  [ ] Show Fydr standard only │
│ [Search        ]  Category: [All ▾]                                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ▾ Power (4)                                                                            │
│   CMJ height              cm    higher better  3 attempts  bilateral   38 athletes  [⋯]│
│   Broad jump              cm    higher better  3 attempts  bilateral   38 athletes  [⋯]│
│   Isometric mid-thigh pull N    higher better  2 attempts  bilateral   12 athletes  [⋯]│
│ ▾ Speed (3)                                                                            │
│   10 m sprint             s     lower better   3 attempts  bilateral   38 athletes  [⋯]│
│   40 m sprint             s     lower better   2 attempts  bilateral   38 athletes  [⋯]│
│ ▾ Strength (5)                                                                         │
│   1RM back squat          kg    higher better  1 attempt   bilateral   34 athletes  [⋯]│
│     ↳ linked to exercise: Back squat · resolves % of 1RM prescriptions                 │
│   Nordic break point      N     higher better  2 attempts  per side    31 athletes  [⋯]│
│ ▾ Endurance (2)                                                                        │
│   Yo-Yo IR1               m     higher better  1 attempt   bilateral   38 athletes  [⋯]│
│ ▾ Body composition (2)                                                                 │
│   Sum of 8 skinfolds      mm    lower better   1 attempt   bilateral   38 athletes  [⋯]│
│     ⚠ excluded from leaderboards                                                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile, 390 pt design target

Fast entry on mobile is the primary case, because the person with the tablet is often the
person with the stopwatch. One athlete at a time, big number pad, swipe to advance.

```
┌─────────────────────────────┐
│ ← CMJ height      2 of 6  ⟳4│
│ Athlete 14 of 38            │
├─────────────────────────────┤
│                             │
│      S. ADEYEMI    #1       │
│      PB 37.6 cm             │
│      Last 37.6 · 12 Mar     │
│                             │
│  Attempt 1    Attempt 2     │
│  ┌────────┐  ┌────────┐     │
│  │  38.2  │  │  39.4  │     │
│  └────────┘  └────────┘     │
│  Attempt 3                  │
│  ┌────────┐                 │
│  │ 38.▮   │  ← entering     │
│  └────────┘                 │
│                             │
│  Best 39.4 ★  NEW PB +1.8   │
│                             │
├─────────────────────────────┤
│  1     2     3      ⌫       │
│  4     5     6      .       │
│  7     8     9              │
│  ⊘     0            ✓       │
│ excuse       next athlete → │
├─────────────────────────────┤
│ ●●●●●●●●●●●●●○○○○○○○ 14/38  │
└─────────────────────────────┘
```

The number pad is in-app, not the OS keyboard. This is deliberate: the OS numeric keyboard on
iOS lacks a decimal point on some locales, animates in and out, and steals a third of the
screen unpredictably. A fixed in-app pad means the layout never moves, the decimal point is
always in the same place, and the "next athlete" key is a thumb-reachable target that never
shifts. Per `06-design-system.md` §9.5, all four action keys sit in the one-handed reach zone.

Bilateral entry on mobile alternates sides within an attempt, with the side named in large
type above the field, and a left/right toggle for correcting a mis-tap:

```
│      S. ADEYEMI    #1       │
│      Nordic break point     │
│                             │
│   ┌───────────────────────┐ │
│   │        LEFT           │ │
│   │       ┌───────┐       │ │
│   │       │  312  │       │ │
│   │       └───────┘       │ │
│   └───────────────────────┘ │
│    Right: 298   Asym 4.5% L │
│         [ L ] [ R ]         │
```

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Scopes participants, results and the distribution chart |
| `PeriodSelector` | §6.8 | Window on the Results tab |
| `AthleteCard` | §6.1 | Participant pickers |
| `AvailabilityPill` | §6.5 | Shown against every participant, so an unavailable athlete is not tested by mistake |
| `MetricTile` | §6.2 | Latest, PB and change tiles on an athlete's test detail |
| `TrendSparkline` | §6.3 | Last four results per athlete in the Results table |
| `SyncStatusIndicator` | §6.17 | The queued-results counter during fast entry. Load-bearing on this screen |
| `EmptyState` | §6.16 | All kinds |
| `ConfirmSheet` | §6.18 | Delete a result, delete a definition, discard an unsaved session |
| `BottomSheet` | §6.19 | Test picker, athlete picker, result detail, conditions note |
| `NumberStepper` | §6.11 | Not used in fast entry. Steppers are too slow for a three-digit value |
| `FastEntryGrid` | New, this screen | The web bulk grid: athletes down, attempts across, keyboard-driven |
| `FastEntryPad` | New, this screen | The mobile in-app number pad and athlete pager |
| `AttemptRow` | New, this screen | One athlete's attempts for one test, with best marking and PB comparison |
| `BilateralPair` | New, this screen | Left and right fields with live asymmetry percentage |
| `TestDefinitionCard` | New, this screen | One definition with unit, direction, attempts, side mode, links |
| `TestBatteryEditor` | New, this screen | Ordered list of tests attached to a testing session |
| `PBBadge` | New, this screen | Personal-best marker with the date it was set |
| `AsymmetryChip` | New, this screen | Percentage difference between sides with a direction letter |
| `SquadDistributionDot` | New, this screen | Jittered dot strip with median rule, per §8.1 |

---

## Data requirements

### Reads

| Field | Source `table.column` | Transformation |
|---|---|---|
| Test name, unit, direction | `test_definitions.name`, `.unit`, `.higher_is_better` | Direction drives best-attempt selection, PB comparison, sort order and chart orientation everywhere |
| Test category | `test_definitions.test_category` | Groups the library |
| Protocol and equipment | `test_definitions.protocol`, `.equipment` | Shown in a sheet from the test header during logging, so the person testing can check the protocol without leaving the screen |
| Global versus club test | `test_definitions.org_id is null` | Null org means a Fydr standard definition, read-only, copyable |
| Session | `sessions.title`, `.starts_at`, `.md_offset`, `.status` where `session_type = 'testing'` | Ordered by `starts_at` |
| Participants | `session_participants.athlete_id`, `.group_id` | Groups expand through `group_memberships` at the session date |
| Attendance | `session_attendance.attendance` | `excused` and `absent` render as the ⊘ state in the grid rather than an empty field |
| Result value | `test_results.value` | `numeric(10,3)`. Displayed at the precision defined per test, see below |
| Attempt | `test_results.attempt_number` | Column position in the grid |
| Best marking | `test_results.is_best` | Computed on write, see "Best attempt" |
| Side | `test_results.side` | `left`, `right`, `bilateral` |
| Conditions | `test_results.conditions` | Free text per result, for example "wet surface, indoor" |
| Provenance | `test_results.source`, `.recorded_by` | Footer per §8.3 |
| Personal best | `max(value)` or `min(value)` over the athlete's non-deleted results | Direction-dependent. Scoped per side for per-side tests |
| Previous result | Latest `test_results` before this test date | Drives the "vs last" column |
| Squad distribution | Latest result per athlete in the window | Jittered dot strip, median rule |
| 1RM link | `exercises.one_rm_test_definition_id` | Reverse lookup: which exercises resolve from this test |
| Body mass, for relative scores | `body_composition.body_mass_kg` latest | Used by derived metrics such as relative strength |

### Schema changes required

| Change | Table | Why |
|---|---|---|
| Add `default_attempts int not null default 1` | `test_definitions` | The grid needs to know how many attempt columns to draw before any result exists |
| Add `side_mode side_mode not null default 'bilateral'` | `test_definitions` | New enum `bilateral \| per_side`. `test_results.side` exists but nothing declares whether a test *should* have sides |
| Add `decimal_places int not null default 1` | `test_definitions` | A 10 m sprint is 1.72 s, a Yo-Yo is 1480 m. Precision per test, per `06-design-system.md` §5.3 |
| Add `min_plausible numeric`, `max_plausible numeric` | `test_definitions` | Range validation per test, so a mistyped 392 cm CMJ is caught at entry rather than in a leaderboard |
| Add `leaderboard_eligible boolean not null default true` | `test_definitions` | Body composition tests must never be leaderboarded. See `leaderboards.md` |
| Add `sort_order int not null default 0` | `test_definitions` | Battery order in the library |
| New table `test_batteries`, `test_battery_items` | new | A named, reusable ordered set of tests, attached to a session |
| New table `session_tests` | new | Which tests a specific testing session includes, and in what order |
| Add unique key `(athlete_id, test_definition_id, test_date, attempt_number, side)` | `test_results` | Makes offline replay idempotent, per `03-flows.md` §10 |

```sql
create type side_mode as enum ('bilateral','per_side');

alter table test_definitions
  add column default_attempts    int not null default 1,
  add column side_mode           side_mode not null default 'bilateral',
  add column decimal_places      int not null default 1,
  add column min_plausible       numeric,
  add column max_plausible       numeric,
  add column leaderboard_eligible boolean not null default true,
  add column sort_order          int not null default 0;

create table test_batteries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  name       text not null,
  description text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, name)
);

create table test_battery_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  battery_id uuid not null references test_batteries(id) on delete cascade,
  test_definition_id uuid not null references test_definitions(id),
  sequence   int not null,
  attempts   int,                       -- overrides the definition default for this battery
  unique (battery_id, test_definition_id)
);

create table session_tests (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id),
  session_id uuid not null references sessions(id) on delete cascade,
  test_definition_id uuid not null references test_definitions(id),
  sequence   int not null,
  attempts   int,
  unique (session_id, test_definition_id)
);

alter table test_results
  add constraint test_results_natural_key
  unique (athlete_id, test_definition_id, test_date, attempt_number, side);

create index on test_results (test_definition_id, test_date desc)
  where deleted_at is null and is_best;
create index on test_results (athlete_id, test_definition_id, side, value)
  where deleted_at is null;
create index on session_tests (session_id, sequence);
```

### Query: the fast entry grid for one test

Returns one row per athlete with attempts pivoted, plus the context a tester needs: previous
result, personal best, availability and attendance.

```sql
with participants as (
  select distinct coalesce(sp.athlete_id, gm.athlete_id) as athlete_id
  from session_participants sp
  left join group_memberships gm
    on gm.group_id = sp.group_id and gm.removed_at is null
  where sp.session_id = $1 and sp.org_id = auth_org_id()
),
today as (
  select tr.athlete_id, tr.attempt_number, tr.side, tr.value, tr.is_best,
         tr.id as result_id, tr.conditions
  from test_results tr
  where tr.org_id = auth_org_id()
    and tr.test_definition_id = $2
    and tr.session_id = $1
    and tr.deleted_at is null
),
pb as (
  select distinct on (tr.athlete_id, tr.side)
         tr.athlete_id, tr.side, tr.value as pb_value, tr.test_date as pb_date
  from test_results tr
  join test_definitions td on td.id = tr.test_definition_id
  where tr.org_id = auth_org_id()
    and tr.test_definition_id = $2
    and tr.deleted_at is null
    and tr.is_best
  order by tr.athlete_id, tr.side,
           case when td.higher_is_better then tr.value end desc nulls last,
           case when not td.higher_is_better then tr.value end asc nulls last,
           tr.test_date desc
),
prev as (
  select distinct on (tr.athlete_id, tr.side)
         tr.athlete_id, tr.side, tr.value as prev_value, tr.test_date as prev_date
  from test_results tr
  where tr.org_id = auth_org_id()
    and tr.test_definition_id = $2
    and tr.deleted_at is null
    and tr.is_best
    and tr.session_id is distinct from $1
  order by tr.athlete_id, tr.side, tr.test_date desc
)
select
  a.id as athlete_id, a.first_name, a.last_name, a.squad_number,
  av.status as availability_status, av.restrictions,
  sa.attendance,
  jsonb_object_agg(
    coalesce(t.attempt_number, 0)::text || ':' || coalesce(t.side::text, 'bilateral'),
    jsonb_build_object('value', t.value, 'is_best', t.is_best, 'id', t.result_id)
  ) filter (where t.value is not null) as attempts,
  max(pb.pb_value)   as pb_value,
  max(pb.pb_date)    as pb_date,
  max(prev.prev_value) as prev_value,
  max(prev.prev_date)  as prev_date
from participants p
join athletes a on a.id = p.athlete_id and a.deleted_at is null
left join lateral (
  select status, restrictions from availability
  where athlete_id = a.id and effective_to is null
  order by effective_from desc limit 1
) av on true
left join session_attendance sa on sa.session_id = $1 and sa.athlete_id = a.id
left join today t on t.athlete_id = a.id
left join pb    on pb.athlete_id = a.id
left join prev  on prev.athlete_id = a.id
where ($3::uuid[] is null or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id and gm.group_id = any($3::uuid[])
          and gm.removed_at is null))
group by a.id, a.first_name, a.last_name, a.squad_number,
         av.status, av.restrictions, sa.attendance
order by a.squad_number nulls last, a.last_name;
```

### Best attempt

`test_results.is_best` is computed on write, per test date, per athlete, per side, by a trigger
rather than by the client. Two clients logging attempts for the same athlete must not disagree
about which is best.

```sql
create or replace function public.mark_best_attempt()
returns trigger
language plpgsql
security definer
as $$
declare v_higher boolean;
begin
  select higher_is_better into v_higher
  from test_definitions where id = new.test_definition_id;

  update test_results tr
  set is_best = (tr.id = (
    select id from test_results x
    where x.athlete_id = new.athlete_id
      and x.test_definition_id = new.test_definition_id
      and x.test_date = new.test_date
      and x.side is not distinct from new.side
      and x.deleted_at is null
    order by
      case when v_higher then x.value end desc nulls last,
      case when not v_higher then x.value end asc nulls last,
      x.attempt_number asc
    limit 1))
  where tr.athlete_id = new.athlete_id
    and tr.test_definition_id = new.test_definition_id
    and tr.test_date = new.test_date
    and tr.side is not distinct from new.side
    and tr.deleted_at is null;

  return new;
end;
$$;

create trigger test_results_mark_best
  after insert or update of value, deleted_at on test_results
  for each row execute function public.mark_best_attempt();
```

Rules the function encodes:

- **Best is per test date, per side.** A left-side best and a right-side best are separate.
- **Direction comes from the definition.** A 10 m sprint's best is the *lowest* number, and
  hard-coding "max" is the single most likely bug on this screen.
- **Ties break on the earliest attempt.** If attempts 1 and 3 are identical, attempt 1 is best.
  Arbitrary, but deterministic, and it means the marking does not flip when a later duplicate
  is entered.
- **A manual override exists.** A coach may mark a different attempt as best, for example when
  attempt 2 was wind-assisted. Manual marking sets `is_best_manual = true` (schema addition)
  and the trigger skips rows where it is set. The result carries a "manually marked" chip and
  requires a `conditions` note.

### Query: history and personal bests for one athlete and test

```sql
select
  tr.test_date, tr.value, tr.attempt_number, tr.side, tr.is_best,
  tr.conditions, tr.source, u.full_name as recorded_by_name,
  s.title as session_title,
  td.unit, td.higher_is_better, td.decimal_places,
  case when td.higher_is_better
       then tr.value = max(tr.value) filter (where tr.is_best)
              over (partition by tr.side)
       else tr.value = min(tr.value) filter (where tr.is_best)
              over (partition by tr.side)
  end as is_personal_best,
  lag(tr.value) over (partition by tr.side order by tr.test_date) as previous_value
from test_results tr
join test_definitions td on td.id = tr.test_definition_id
left join users u on u.id = tr.recorded_by
left join sessions s on s.id = tr.session_id
where tr.org_id = auth_org_id()
  and tr.athlete_id = $1
  and tr.test_definition_id = $2
  and tr.deleted_at is null
  and ($3::daterange is null or tr.test_date <@ $3::daterange)
order by tr.test_date desc, tr.side, tr.attempt_number;
```

### Query: how a test result resolves a `percent_1rm` prescription

The read side of the link specified in `programme-builder.md`. It is repeated here because a
coach on this screen needs to see the downstream effect of entering a 1RM.

```sql
select
  e.id as exercise_id, e.name as exercise_name,
  p.id as programme_id, p.name as programme_name,
  pe.load_value as percent,
  round(tr.value * pe.load_value / 100.0, 1) as new_prescribed_kg,
  round(prev.value * pe.load_value / 100.0, 1) as previous_prescribed_kg
from exercises e
join programme_exercises pe on pe.exercise_id = e.id and pe.load_basis = 'percent_1rm'
join programme_sessions ps  on ps.id = pe.programme_session_id
join programme_blocks pb    on pb.id = ps.block_id
join programmes p           on p.id = pb.programme_id and p.status = 'active'
join test_results tr on tr.test_definition_id = e.one_rm_test_definition_id
                    and tr.athlete_id = $1 and tr.is_best and tr.deleted_at is null
left join lateral (
  select value from test_results x
  where x.test_definition_id = e.one_rm_test_definition_id
    and x.athlete_id = $1 and x.is_best and x.deleted_at is null
    and x.test_date < tr.test_date
  order by x.test_date desc limit 1
) prev on true
where e.one_rm_test_definition_id = $2
  and tr.test_date = $3
order by p.name, e.name;
```

After logging a 1RM, the confirmation sheet reads: "J. Okafor's back squat 1RM is now 145 kg,
up from 138 kg. 6 prescriptions across 2 programmes will resolve to new loads from tomorrow."
The coach sees the consequence at the moment they cause it, rather than discovering it when an
athlete asks why their weights went up.

### Writes

| Action | Write | Notes |
|---|---|---|
| Log a result | Insert `test_results` with client-generated UUID, `source = 'staff_entered'`, `recorded_by = auth_user_id()` | Offline-safe, idempotent via the natural key |
| Correct a result | Update `value` in place | See the immutability note below |
| Delete a result | Soft delete, `deleted_at` | Triggers best-attempt recomputation |
| Mark best manually | Update `is_best`, `is_best_manual`, require `conditions` | Audited |
| Excuse an athlete | Insert or update `session_attendance` with `attendance = 'excused'` | |
| Create a definition | Insert `test_definitions` | |
| Copy a Fydr standard definition | Insert with `org_id = auth_org_id()`, all fields copied | Standards are read-only |
| Schedule a session | Insert `sessions` with `session_type = 'testing'`, plus `session_participants` and `session_tests` | |
| Import results CSV | Insert batch via `import_batches`, `source = 'file_import'` | Reuses the vendor-profile column mapping from `07-integrations.md` |

**`test_results` is not covered by `CLAUDE.md` rule 6.** That rule governs athlete-submitted
entries: wellness, gym, nutrition. A test result is staff-entered, and the correction case is
overwhelmingly a typo caught within seconds by the person who made it, not an athlete revising
a submission. Forcing a revision row for a mistyped digit during a testing afternoon would
double the correction cost on a screen whose entire justification is entry speed.

The safeguards instead are: an edit window, and an audit trail.

- Edits within the same session by the same user, before the session is marked complete, are
  silent in-place updates.
- Edits after the session is complete, or by a different user, write to `audit_log` with the
  before and after values and require a reason. The result then carries an "edited" chip
  showing who changed it and when.
- Deletion is always soft and always audited.

See O-384, because this is a deliberate exception to a `CLAUDE.md` rule and needs signing off.

---

## States

### Default

Sessions tab, upcoming sessions first, then the last five completed. If a testing session is
scheduled for today, the screen opens on the Log tab for that session instead, because that is
what the person opening the app during a testing afternoon wants.

### Loading

Sessions tab: three session card skeletons. Log tab: the athlete list renders immediately from
the cached squad, attempt fields render enabled and empty while previous results and PBs load
in behind them. **Entry is never blocked on the history load.** A tester holding a stopwatch
must be able to type a number 200 ms after the screen opens, and the PB comparison filling in
half a second later costs nothing.

### Empty

| Kind | Trigger | Copy | Action |
|---|---|---|---|
| `notStarted` | No test definitions | "No tests defined yet. Start from the Fydr standard set or create your own." | "Browse standard tests", "Create a test" |
| `notStarted` | Definitions exist, no sessions | "No testing sessions yet." | "Schedule testing" |
| `notStarted` | Session with no results | Rendered inline in the grid, not as a state | none |
| `noData` | Results tab, no results for this test in the window | "No CMJ height results between 1 July and 5 August." | "Change period", "Schedule testing" |
| `noResults` | Group filter excludes everyone | "No athletes in Academy are in this testing session." | "Clear filter" |
| `insufficientData` | Distribution chart with fewer than 5 athletes | "Not enough athletes with a result to show a distribution. 3 of 5 needed." | none |
| `insufficientData` | Trend sparkline with fewer than 3 results | "Not enough results for a trend. 2 of 3 needed." | none |
| `noData` | Athlete with no result for a test | "First test" in the vs-last column, not an empty state | none |

### Error

Per §11.3, at the smallest scope. A failed PB lookup blanks the PB column with a caption and
leaves entry fully functional. A failed save during fast entry does **not** show an error: the
result is already written locally and queued, and the `SyncStatusIndicator` shows the queue
depth. This mirrors `03-flows.md` §3 for athlete entries, extended to staff bulk entry, and it
is the one place where staff writes are queued rather than disabled.

That is a deliberate exception to `06-design-system.md` §11.4, which says staff writes are not
queued in v1. The exception exists because testing happens on pitches with no signal, and a
product that loses an afternoon of testing data is worse than one that queues it. See O-383.

### Offline

| Surface | Behaviour |
|---|---|
| Fast entry | **Fully functional.** Results write to local SQLite with client-generated UUIDs and queue. The header shows "⟳ 14 queued". Best-attempt marking and PB comparison are computed locally from the cached history and reconciled on sync |
| Session list | Cached, with the offline chip |
| Results tab | Cached, with the offline chip and the cache timestamp |
| Tests tab | Cached. Definitions have a 24-hour `staleTime` and are persisted |
| Creating a definition or session | Disabled, with the standard copy |

Sync conflict rule: staff-owned data, so server wins per `03-flows.md` §10. In practice a
conflict on a test result means two staff logged the same athlete on the same attempt from two
devices, which the natural key turns into an upsert rather than a duplicate, and the later
`logged_at` wins. Both values are retained in `audit_log` so the discrepancy is recoverable.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | Full |
| Medical | Identical. No difference. Testing is shared between the roles |
| Athlete | Not this screen. `my-data.md → Test results` shows own history, PBs and trend, with squad comparison limited to what `leaderboards.md` permits |
| Admin | Route not registered |

---

## Interactions

### Fast entry: the design requirements

The measurable target: **a two-attempt test on 30 athletes in under 6 minutes**, which is 12
seconds per athlete including reading the number off a device and looking up. Everything below
serves that number.

**Web grid.**

| Key | Action |
|---|---|
| Type digits | Enters into the focused cell |
| `Enter` or `↓` | Commit and move to the same attempt for the next athlete |
| `Tab` or `→` | Commit and move to the next attempt for the same athlete |
| `Shift+Tab`, `←`, `↑` | Reverse |
| `.` | Decimal point, once per value |
| `Escape` | Revert the cell to its stored value |
| `x` | Mark the athlete excused, move on |
| `n` | Jump to the next athlete with no result |
| `]` and `[` | Next and previous test in the battery |
| `Ctrl+B` | Toggle manual best on the focused result |

The default movement is **down, not across**. A tester runs the whole squad through attempt 1,
then the whole squad through attempt 2. Moving across after each entry matches how the data is
shaped and not how the afternoon runs.

**Mobile pad.**

- One athlete per screen, name in display type, squad number, PB and last result above the
  fields.
- Fixed in-app number pad. No OS keyboard.
- `✓` commits and advances to the next athlete. Swipe left does the same. Swipe right goes
  back.
- `⊘` marks excused and advances.
- Progress dots along the bottom, tappable to jump.
- Haptic feedback on commit, on new PB, and on a plausibility warning, per §7.4. Three
  distinguishable patterns.
- The athlete's name is announced by the screen reader on advance, so a tester can work with
  the screen in a pocket and the phone in a lanyard.

**Ordering.** Squad number by default, because that is how athletes line up. Alternatives:
alphabetical, group, previous result descending (useful for a max test where you load the bar
in ascending order), and custom drag order saved per session.

**Skipping and returning.** An athlete not present is skipped with `n`, not marked absent.
Marking absent is a separate deliberate action, because "not yet" and "did not attend" are
different and conflating them corrupts the completion count.

**Attempt count is a per-session choice.** The definition carries a default, the battery may
override it, and the tester may add an attempt in the moment with `[+ attempt]`, which adds a
column for that session only.

### Bilateral tests

`test_definitions.side_mode` decides the shape:

- `bilateral`: one value per attempt. `test_results.side` is stored as `bilateral`.
- `per_side`: two values per attempt, stored as two rows with `side = 'left'` and
  `side = 'right'`.

For a `per_side` test the grid shows an **asymmetry percentage** live as both sides are
entered:

```
asymmetry_pct = abs(left - right) / greatest(left, right) × 100
```

with a letter indicating the stronger or faster side. The threshold at which it warns is
configurable per test on the definition, defaulting to 10%, and above it the chip renders in
`status.modified` with a ⚠ glyph. A `thresholds.md` rule with `domain = 'testing'` and
`metric = 'asymmetry_pct'` can raise a flag from it.

The asymmetry formula uses `greatest()` as the denominator regardless of `higher_is_better`,
which is the convention in the limb-symmetry literature and means the value is always between
0 and 100.

**Best attempt is per side.** An athlete's best left is attempt 2 and best right is attempt 1,
and asymmetry is computed between the two bests, not within one attempt. This is the standard
approach and it is worth stating because computing it within an attempt is the intuitive wrong
answer.

**`dominant_side` context.** `athletes.dominant_side` is shown next to the asymmetry chip, so
a coach reads "17.6% stronger on the right, right-dominant" rather than an unqualified number.

### Personal bests

- A PB is the best `is_best` result across all sessions, per athlete, per test, per side,
  direction-aware.
- A new PB is announced at the moment of entry: the value flashes, a `PBBadge` appears, and on
  mobile a distinct haptic fires. This costs nothing and it is the one moment where the product
  can make a testing afternoon feel worth doing.
- **PBs are not notified to athletes automatically.** Per `08-notifications.md` §1, every
  notification must pass the four tests, and a PB push arriving before the coach has looked at
  the data undermines the coach's conversation. A PB becomes visible to the athlete when the
  session is marked complete. See O-386.
- **First result is not a PB.** It renders as "first test". Marking the first ever value as a
  personal best is technically true and reads as a hollow celebration.
- PBs are scoped to the club. An athlete's PB from a previous club is not in the system and the
  UI does not imply otherwise.

### Historical comparison

The Results tab and the per-athlete detail both show:

| Comparison | Definition | Suppressed when |
|---|---|---|
| vs last | Change against the previous `is_best` result | No previous result. Renders "first test" |
| vs PB | Percentage difference from the personal best | Same |
| vs baseline | Change against the earliest result in the season | Fewer than 2 results in the season |
| vs squad | Percentile within the group filter's population, latest result each | Fewer than 5 athletes with a result, per §8.5 |
| Trend | Sparkline of the last 4 `is_best` results | Fewer than 3 results, per §8.5 |

Every comparison states its window and n, per §8.3. A change of "+1.8 cm" without "since 12
March" is not a fact a coach can use.

**The smallest worthwhile change.** `test_definitions` optionally carries `swc_value`, the
smallest worthwhile change, as an absolute in the test's unit. Where it is set, a change below
it renders in neutral type with the caption "within typical variation", rather than as an
improvement or a decline. Where it is not set, no such claim is made. This is the honest
treatment: a 0.02 s change in a 10 m sprint is measurement noise, and rendering it with a green
up-arrow is exactly the confident nonsense that product principle 5 exists to prevent. See
O-387.

### Scheduling a testing session

`[+ Schedule testing]` creates a `sessions` row with `session_type = 'testing'` and opens:

1. **When**: date, time, duration, location. The MD-n label is computed and shown, with a
   warning if the session lands on MD-1 or MD, because maximal testing the day before a fixture
   is usually a mistake and occasionally deliberate.
2. **Who**: groups and individuals, with availability shown. Unavailable athletes may be
   included, and are marked so the tester knows to skip or modify.
3. **What**: the battery. Either pick a saved `test_batteries` row or assemble tests ad hoc.
   Order matters and is draggable, because a 1RM before a sprint test invalidates the sprint.
4. **Print sheet**: a PDF of the grid with empty boxes, for the club that will always use
   paper as a backup. This is not a concession, it is realistic, and it means the paper sheet
   matches the app's athlete order so transcription is mechanical.

The session appears on `schedule.md` and `timetable.md` like any other session, and generates
`compliance_expectations` per the week template.

### Importing results

CSV import for clubs whose force plate or timing gates export a file. Reuses
`vendor_profiles.column_map` from `04-data-model.md` §8, matching athletes on the configured
column with a manual review step for unmatched names. Import writes `source = 'file_import'`
and the provenance appears in every downstream footer. Errors are collected into
`import_batches.errors` and reviewed rather than failing the batch.

---

## Validation rules

| Rule | Severity | Message |
|---|---|---|
| `value` present and numeric | Block | Silent. The pad does not permit non-numeric input |
| `value` within `min_plausible` and `max_plausible` | Warn, confirmable | "39.4 cm is normal for CMJ. 394 cm is not. Save anyway?" |
| `value` more than 30% better than the athlete's PB | Warn, confirmable | "That would beat S. Adeyemi's PB by 41%. Check the number." |
| `value` more than 30% worse than the athlete's last result | Warn, confirmable | "That is 38% below T. Bennett's last result. Injury or a typo?" |
| Decimal places beyond `decimal_places` | Auto | Rounded on save, with the rounded value shown before commit |
| `attempt_number` between 1 and 10 | Block | "Maximum 10 attempts per test per day." |
| Duplicate `(athlete, test, date, attempt, side)` | Auto | Upsert. Later value wins, both retained in `audit_log` |
| `side` set on a `bilateral` test | Block | Silent. The UI does not offer it |
| `side` missing on a `per_side` test | Block | "Record both sides, or mark the missing side as not tested." |
| Only one side recorded on a `per_side` test | Warn on session completion | "4 athletes have only one side recorded for Nordic break point." |
| Test on an athlete marked `unavailable` | Warn | "J. Okafor is unavailable: hamstring. Test anyway?" and the override is audited |
| Test on an athlete whose restrictions prohibit it | Warn | "S. Adeyemi is restricted from sprinting." Warns, never blocks, per `03-flows.md` §6 |
| Test date in the future | Block | "You cannot log a result for a future date." |
| Test date more than 365 days ago | Warn | "That date is 14 months ago. Correct?" |
| Marking best manually without a reason | Block | "Say why this attempt is the best one." |
| Definition: name unique per org | Block | "A test called 'CMJ height' already exists." |
| Definition: unit required, maximum 12 characters | Block | "Give the unit, for example cm, s, kg." |
| Definition: `min_plausible < max_plausible` | Block | "The minimum must be below the maximum." |
| Definition: `decimal_places` 0 to 3 | Block | "Between 0 and 3 decimal places." |
| Definition: deleting one with results | Block | "This test has 412 results. Archive it instead." |
| Definition: `test_category = 'body_comp'` and `leaderboard_eligible = true` | Block | "Body composition tests cannot appear on leaderboards." See `leaderboards.md` |
| Battery: at least one test | Block | "Add at least one test." |
| Session: at least one participant | Warn | "Nobody is assigned to this testing session." |

The plausibility warnings are all confirmable rather than blocking. A genuine outlier exists,
and a product that refuses to record a real 4.2 kg improvement because it looks wrong will be
worked around within a week.

---

## Edge cases

1. **An athlete tested twice on the same day in two sessions.** The natural key includes
   `test_date`, not `session_id`, so the second session's attempt 1 collides with the first's.
   Resolution: attempt numbers continue rather than restart, so the second session's first
   attempt is attempt 3. The grid shows this and the session column disambiguates in the
   history.
2. **A result logged against the wrong athlete.** Correcting it is a delete plus an insert, not
   an update, because the natural key includes the athlete. The UI offers "Move to another
   athlete" which performs both in one transaction and audits it as `test_result.reassign`.
3. **An athlete who joins mid-season with no baseline.** Every comparison renders "first test"
   and the trend is suppressed. Their result still counts toward the squad distribution.
4. **A test definition whose direction is changed after results exist.** Changing
   `higher_is_better` inverts every PB and best-attempt marking for that test. The edit is
   permitted, requires confirmation naming the affected result count, and triggers a full
   recomputation of `is_best` for that definition. It is audited as
   `test_definition.direction_change`, because it silently rewrites what "best" means across
   the history.
5. **A `per_side` test where an athlete has only one limb tested**, for example post-surgery.
   Permitted. Asymmetry is suppressed rather than computed against a missing side, and the
   result carries a "one side only" chip.
6. **Two testers on two devices logging the same test simultaneously.** The natural key makes
   the writes idempotent per attempt. Where both enter attempt 1 for the same athlete, the
   later `logged_at` wins and the discrepancy is in `audit_log`. The grid shows a "changed by
   Sam Rees" chip on any row updated by another user while the current user has the screen
   open, delivered by Realtime.
7. **A 1RM logged that makes an athlete's current prescription heavier than they can lift.**
   The prescription resolves from the new number, which is correct. Where a `load_cap` override
   exists, `least()` still applies. The confirmation sheet after logging a 1RM names every
   affected prescription, per the query above.
8. **A 1RM test result deleted.** The `percent_1rm` prescriptions fall back to the next most
   recent result, and if none exists the athlete's programme shows "load not set, see your
   coach" and a `testing`-domain flag is raised. Silent reversion to a default weight is
   prohibited by `04-data-model.md` §7.
9. **An offline afternoon with 228 queued results.** The queue is persisted to SQLite and
   survives app termination and device restart. Sync pushes in order. The sync indicator shows
   depth and, above 50 items, an estimated time. A partial sync leaves the remainder queued and
   never loses an item.
10. **A body composition test.** `body_composition` is a separate table with its own columns.
    A test definition with `test_category = 'body_comp'` writes to `test_results` for
    single-value measures such as sum of skinfolds, and the dedicated `body_composition` table
    holds the multi-field measurement. Both exist, and the Tests tab links between them.
    `leaderboard_eligible` is forced false for the category.
11. **A session marked complete with missing results.** Permitted, with a summary: "34 of 38
    athletes tested. 4 missing: M. Chen, D. Rahman, and 2 more." Marking complete locks the
    silent-edit window, so later corrections require a reason.
12. **An athlete who leaves the club.** Their results are retained, excluded from squad
    distributions by `athletes.status <> 'left_club'`, and remain in their own history for
    export and subject access purposes.
13. **A test result logged with `test_date` before the athlete joined the club.** Warned, and
    permitted, because clubs do transcribe historical results from a previous system at
    onboarding.
14. **A definition copied from the Fydr standard set and then edited.** The copy is
    independent. No propagation from the standard. The card shows the provenance.

---

## Performance notes

| Path | Budget |
|---|---|
| Fast entry grid open, 40 athletes | 300 ms p95 to first interactive field |
| Single result commit | **50 ms p95, local**. Not a network operation |
| Test switch within a battery | 200 ms p95, from prefetched data |
| Results tab, one test, season window, 40 athletes | 500 ms p95 server |
| Squad distribution chart | 300 ms p95 server |

Rules:

1. **Entry is a local write.** The commit path writes to SQLite and enqueues. It never awaits
   the network. The 50 ms budget is a rendering budget, and anything slower is a rendering
   fault, exactly as `05-architecture.md` §11 says of the wellness submit path.
2. **The next test in the battery is prefetched** while the current one is being logged, so
   `]` is instant. Prefetch depth is one test forward and one back.
3. **PBs and previous results are fetched once per session open**, for every participant and
   every test in the battery, in one query, and held for the duration. Fetching per athlete per
   test is 228 round trips for a six-test battery.
4. **Best-attempt marking is computed locally during entry** and authoritatively by the trigger
   on sync. The local computation uses the same shared fixture set as the server logic, in
   `packages/core/testing.ts`, tested against it, exactly as ADR-006 requires of programme
   resolution.
5. **The grid virtualises above 25 rows** but keeps the focused row and its neighbours mounted,
   so keyboard movement never lands on an unmounted cell.
6. **Query keys**: `qk.testing.sessions(orgId, groupIds, range)`,
   `qk.testing.grid(orgId, sessionId, testDefinitionId, groupIds)`,
   `qk.testing.history(orgId, athleteId, testDefinitionId, range)`,
   `qk.testing.results(orgId, testDefinitionId, groupIds, range)`,
   `qk.testing.definitions(orgId)`.
7. **Freshness**: definitions 24 h and persisted, sessions 5 min, results 5 min, grid 0 with
   Realtime invalidation so two testers see each other's entries.
8. **Realtime** is subscribed on `test_results` filtered to the open `session_id` only. A
   squad-wide subscription during a testing afternoon is unnecessary traffic.
9. **Indexes**: the two added in the schema block above, plus the existing
   `test_results (athlete_id, test_definition_id, test_date desc)` from `04-data-model.md` §15.
10. **`refresh_views_after_import`** is called after a results CSV import so leaderboards and
    analytics reflect the new data without waiting for the nightly refresh.

---

## Accessibility

1. **The fast entry grid is a real table** with row and column headers. Each input's accessible
   name is "S. Adeyemi, CMJ height, attempt 2, centimetres", not "attempt 2".
2. **Focus movement is announced** in a polite live region: "Row 15, T. Bennett, attempt 1".
   Without this, keyboard-driven bulk entry is unusable with a screen reader.
3. **The mobile pad's keys are 56 pt minimum**, above the 44 pt floor, because they are used at
   speed with cold hands. The `✓` and `⊘` keys are visually and physically distinct.
4. **New PB is announced**, not only flashed and haptically signalled: "New personal best,
   39.4 centimetres, up 1.8".
5. **Plausibility warnings are `role="alertdialog"`** and require an explicit choice. They are
   never a toast that can be missed at speed.
6. **Asymmetry is text plus a glyph**, never colour alone: "17.6 percent stronger on the right,
   above the 10 percent threshold".
7. **The number pad has a hardware keyboard equivalent** on tablets with a keyboard attached,
   and the in-app pad hides when one is detected.
8. **Charts** carry the one-sentence summary and the "View as table" alternative per §8.6. The
   distribution dot strip announces "36 athletes, median 40.1 centimetres, range 33.2 to 48.9".
9. **Dynamic type** to 200%. The web grid reflows to the mobile single-athlete layout above
   150%, because a nine-column grid at 200% is not readable at any width.
10. **Reduced motion** removes the PB flash animation and the athlete-advance transition. The
    PB badge still appears, statically.
11. **Colour** is never the sole carrier of best-attempt marking. The best attempt carries a ★
    glyph and is announced as "best attempt".
12. **The print sheet** is a genuine accessibility feature as well as a robustness one, and its
    athlete order matches the app exactly.

---

## As built: bests, extra attempts, and saving

This section records behaviour that ships and was not in the original spec above. It is
written per `CLAUDE.md` §5 (a code change that alters documented behaviour carries the
doc edit with it), and per §8 (where code and doc disagree on a *fact about what exists*,
the code is the fact).

### Season's best and all-time best, with a trend percentage

The per-athlete testing report (`/testing/[testDefId]/[athleteId]`) shows three tiles
above the trend chart: **season's best**, **all-time best**, and **season trend**.

**On a `per_side` test the three tiles are repeated once per side, each row labelled
"Left" / "Right".** A per-side test (grip strength, single-leg hop, isometric hamstring)
measures two independent things: pooling them yields a best belonging to a limb nobody is
told about, and a trend that can compare this season's left against last season's right.
Worked case, grip strength, higher is better — prior season right 50 kg and left 38 kg,
this season only the left tested at 42 kg: pooled that reads "50 kg all-time" and a
**−16.0%** regression; split it reads "Left: 42 kg, +10.5%" and "Right: 50 kg, not tested
this season", which is what actually happened. `computeTestBestsBySide()` does the
partitioning and delegates each side to `computeTestBests()`, so there is still one
definition of "best". The split matches `TestTrendChart` directly underneath (two
labelled series, keyed on `r.side ?? 'bilateral'`) and `fetchTestByTest`, which keys its
bests by `${athlete_id}:${side ?? ''}`. A `bilateral` test renders exactly one unlabelled
row, as before. The CSV caption and the PDF tile rows are split and labelled the same way.

All three come from `computeTestBests()` in `src/lib/queries/testing.ts`, computed from
the history rows the page already fetched. There is no second query and no second
definition of "best": every best in the app — this report, the squad grid
(`fetchTestingByAthlete`), the by-test distribution (`fetchTestByTest`) and the athlete's
own PB pill (`fetchMyTestSummary`) — routes through the single `beatsBest()` comparison.
That matters because `is_best` marks the best attempt **within one session**, so the
winner *across* sessions must be picked by the test's own `higher_is_better` direction,
never by date recency. Picking by recency was a real shipped bug (an athlete with a 41.6
all-time best displayed 31.0, because 31.0 was their latest session), and it was fixed in
one of the four places while surviving in the other three — hence one shared function.

**The trend percentage is defined as: the current season's best measured against the
athlete's best from strictly before the season began** (`test_date < season.starts_on`).
It answers "has this athlete got better this season than they had ever been before it?"

It is signed so that **positive always means improvement**, in both directions:

| Test direction | Formula |
|---|---|
| `higher_is_better` (a jump) | `(season − prior) / abs(prior) × 100` |
| lower is better (a sprint) | `(prior − season) / abs(prior) × 100` |

So shaving 4.10s to 3.95s reads **+3.7%**, not −3.7%.

Why this pairing rather than the more obvious "season's best vs all-time best": the
all-time window *contains* the season, so season-vs-all-time can never be positive. It
would be a gauge pinned at or below zero, reading as a permanent regression, which is
useless as a trend. Measured against the pre-season best the number is genuinely
two-sided.

**The "New PB" badge is a separate computation, not a reading of the trend.** An earlier
version of this section claimed "the trend is positive if and only if the season's best is
also the all-time best"; that is not true, and the badge must not be derived from it. The
two use different baselines — the trend's is *before* the season only, the badge's is
everything *outside* the season in either direction — and the trend is blank for an
athlete's first season even though a first result is a lifetime best. The badge is
`TestBests.seasonIsNewAllTimeBest`, true only when the season's best **strictly** beats
every result from outside the season window, compared through `beatsBest()` so the
direction inverts for a lower-is-better test. Equalling an older mark is deliberately
*not* a new PB: matching a two-year-old jump reads 0.0% on the trend, and announcing "New
PB" beside a 0.0% is two contradictory statements, one of them false. (It was: the badge
previously inferred the case from `seasonValue === allTimeValue && seasonDate ===
allTimeDate`, which assumed `allTimeDate` held the *earliest* date the mark was reached
when it in fact held the most recent, because `fetchHistory` sorts descending and ties
kept the first row seen.)

The dates printed under each best are now the date the mark was **first set**, not the
last date it was matched, and no longer depend on the order `fetchHistory` returns rows
in.

The trend renders as blank (not 0%) whenever the comparison is undefined: no current
season configured, no result inside the season, no result before it (a first season has
nothing to trend against, and 0% would assert "no change" about a measurement never
taken), or a prior best of exactly 0, which has no percentage base. The tile prints the
trend's meaning in words underneath it, and the CSV and PDF exports both carry the same
definition, so a printout is still interpretable months later.

The season window is the org's `is_current` season from `seasons` (`starts_on`/`ends_on`,
inclusive of both endpoints), resolved by `fetchCurrentSeason()` in
`src/lib/queries/schedule.ts`.

> Note: this interacts with **O-387** below and does not resolve it. With no smallest
> worthwhile change configured per test, the trend renders every difference as a
> difference, measurement noise included.

### Extra attempts

The logging grid has a **+ Attempt** button on each athlete's own row, adding one attempt
beyond the test's `default_attempts`.

It is per athlete and per day, not per grid: on a real testing day it is one athlete who
fluffs a rep and goes again, and widening the whole squad's grid would put empty boxes
under everyone else's name.

Pressing it writes nothing to the database, which is correct rather than a shortcut —
`test_results.value` is `NOT NULL` (migration 0024), so "an empty attempt 4" is not a row
that can exist. The button reveals the next slot; the existing per-cell autosave writes
the real row with the next `attempt_number` as soon as a value is entered. No new trigger
work was needed: `mark_best_attempt` (0024, rewritten in 0025) recomputes the best across
every non-deleted attempt in the `(athlete, test, date, side)` group, so attempt 4
competes for best on insert exactly as attempts 1–3 did, and `attempt_number` carries no
upper bound.

The grid draws `max(default_attempts, highest attempt already saved, coach's request)`
boxes. Including *highest already saved* fixes a separate pre-existing bug: an extra
attempt logged today became invisible on the next page load, because the grid only ever
drew `default_attempts` boxes while the row sat in the table unrendered — and, being
unrendered, uneditable. Lowering a test's `default_attempts` after a session had been
logged hid results the same way.

### Saving: autosave, no session save button

The coach asked whether inputs autosave "or should there be a button to save and upload a
testing session, you decide." **Decision: keep per-cell autosave, add no session-level
save button.**

Reasoning, recorded because it was a judgement call:

- A save button reintroduces exactly the failure the grid was rebuilt to kill — a hall
  full of typed values lost to a closed laptop or a dead phone. That was a real audit
  finding, not a hypothetical.
- It gives two competing answers to "is this saved?" next to per-cell state that is
  already truthful.
- There is no upload step for it to gate. `logAttempt()` writes straight to
  `test_results`; there is no draft or session-staging table behind it, so "upload" would
  be a button that saved already-saved rows.

The honest fix for the underlying worry — *did that land?* — is per-cell saved/saving/
failed state plus a browser leave-page warning when anything is uncommitted. Both already
exist, and every exit path from a cell (Enter, Tab, click away) funnels through the same
commit function so that a session's data never depends on which key the coach pressed.

### Print and download

Both testing screens carry print and export controls at the top right:

| Screen | Controls |
|---|---|
| `/reports/testing` (squad) | Period selector (added), Print (added), Export CSV, Export PDF (both already existed) |
| `/testing/[testDefId]/[athleteId]` (individual) | Print, Export CSV, Export PDF (all added) |

Print is `window.print()` through the existing `@media print` block in `base.css`, so
there is no separate print view to keep in sync. One honest caveat on the squad report:
it is paginated by `ReportPager`, so a print captures the tab currently open ("By
athlete" *or* "By test"), not both. The PDF export is the one that contains everything.

**The squad report is now period-scoped** (`?period=`, offering `month | season | year |
all` and defaulting to `season`; `day` and `week` are disabled with their reason because
testing is episodic and a week is usually one session, which the single-test grid already
shows). Its CSV and PDF read the same param through the same colocated
`reports/testing/period.ts`, so a download covers the window the coach was looking at and
states it in the caption or the header. Before this it had **no** window at all: its three
queries took no dates, so the longitudinal series plotted every result the club had ever
recorded and, past PostgREST's 1000-row ceiling, was silently truncated. Consequently the
"By athlete" grid's heading no longer says "current personal best" — it is best *in the
window*, and it names it. See `reports.md`, "The period control, as built".

The per-athlete CSV exports **every** attempt, not only the best ones, because a CSV is
the shape someone re-analyses elsewhere and dropping non-best attempts would throw away
the within-session spread that makes that worth doing. A `best` column marks which row
the trigger, or a coach via manual override, picked.

Both per-athlete routes gate on `requireStaff`, deliberately *not* `requireReportAccess`:
a download must gate exactly as the page it downloads, so an export is never reachable by
someone who cannot already read the same numbers on screen, and never denied to someone
who can. The squad report under `/reports` uses `requireReportAccess` because its own page
does. Both record an audit row via `recordReportView(..., 'testing-athlete', ..., 'export')`.

---

## Open questions

- **O-383**: Staff writes are queued offline on this screen, which contradicts
  `06-design-system.md` §11.4. The justification is that testing happens without signal and a
  lost afternoon is unacceptable. Confirm the exception, because it means building a staff-side
  sync queue that no other staff screen uses.
- **O-384**: `test_results` are edited in place rather than revised, which is an exception to
  `CLAUDE.md` rule 6. The rule is written for athlete-submitted entries. Confirm that staff
  test entry is out of its scope, or say so and I will specify revision rows plus the entry
  cost that implies.
- **O-385**: How many attempts should each standard test default to? I have used 3 for jumps
  and sprints, 2 for isometric tests, 1 for 1RM and endurance. This is a sports science
  judgement and it sets the shape of the entry grid.
- **O-386**: Should a new PB notify the athlete immediately, or wait until the session is
  marked complete? I have specified waiting, on the `08-notifications.md` §1 grounds. Some
  clubs will want the immediate hit of recognition.
- **O-387**: Should `test_definitions` carry a smallest worthwhile change value, and if so
  what values for the standard set? Without it, every change is rendered as a change, including
  measurement noise. With it, the product makes a claim about measurement error that needs to
  be defensible per test and per club's equipment.
- **O-388**: Is a 10% asymmetry warning threshold right, and should it differ by test? The
  literature ranges from 10% to 15% depending on the measure. It is per-test configurable as
  specified, but the defaults need setting.
- **O-389**: Should Fydr estimate 1RM from a submaximal set, for example Epley or Brzycki from
  a 5RM? Clubs below the elite tier rarely test true 1RM, so `percent_1rm` prescriptions may be
  resolving from a number nobody actually measured. Adding an estimated-1RM test definition
  with the formula recorded on the result is straightforward and materially changes how usable
  the `percent_1rm` load basis is.
- **O-390**: Should testing sessions support a station rotation, where athletes move between
  tests in groups rather than the squad completing one test at a time? It changes the entry
  order model from "one test, all athletes" to "one station, a subset". Decide it on its own
  merits: O-5 is resolved and "corner group allocation" means team allocation
  (`team-allocation.md`), so it has no bearing here.
