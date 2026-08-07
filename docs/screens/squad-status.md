# Screen: Squad status

> **Layout status**: provisional. Awaiting client design photographs.

Screen 9 in the inventory (`02-information-architecture.md` §5). Route
`/staff/squad-status`. Reached from the Dashboard tab. Drawn on the original navigation map as
`Dashboard → Squad → Compliance / Availability`, with `Day or week view` attached to the domain
cluster below it.

---

## Purpose

Compliance and availability for the whole squad, in one place, with a day view and a week view.

This is the screen a coach opens when the dashboard's exception list is not enough: when they
want to see who has and has not submitted, who is available, and where the gaps are. It is the
exhaustive counterpart to the dashboard's exception list, and it exists precisely so that the
dashboard does not have to be exhaustive.

The distinction matters and should be held to in build:

| Screen | Question it answers |
|---|---|
| Dashboard | "Who do I need to speak to this morning?" |
| Squad status | "What is the state of the whole squad, by athlete?" |

A coach uses squad status once or twice a day, deliberately. They use the dashboard every time
they open the app. Optimising this screen for glanceability at the cost of completeness would
duplicate the dashboard and leave the completeness question unanswered anywhere.

Three jobs:

1. Show every athlete in the filtered population with their compliance state and availability.
2. Let a coach switch between one day in detail and a week in grid form.
3. Drill into any athlete with the date and domain context carried through.

---

## Roles and access

| Role | Access | Notes |
|---|---|---|
| Coach / S&C | Full | Availability level only. No diagnosis, no mechanism, no clinical notes. |
| Medical | Full, plus an availability edit affordance per row | Medical is the only role that can set availability (`01-roles-and-permissions.md` §4). |
| Athlete | No access | Not present in the athlete navigator. |
| Admin | No access by default | An admin sees aggregate compliance in Settings and usage statistics, not per-athlete rows. Direct navigation renders `noPermission`. |

**Group filter**: mandatory. This is the archetypal multi-athlete screen and the original
drawing's "all pages group separations" instruction was written next to exactly this kind of
view.

**Clinical boundary**: the availability column reads `availability.status`,
`availability.restrictions`, `availability.reason_category`, `availability.note`, and
`injuries.body_area`. It does not read `injury_clinical` and does not join it. A restriction
string such as "no contact" is coach-visible by design and is not clinical data. A diagnosis is,
and it is not on this screen for any role, including medical, because a physio reading a
diagnosis does it on `injury-record.md` where the read is audited.

---

## Entry points

| From | Trigger | Context carried |
|---|---|---|
| Dashboard, squad strip | Tap | Date, group filter |
| Dashboard, a compliance ring | Tap | Date, group filter, **domain preselected** |
| Staff sidebar, web | Click "Squad status" under Dashboard | Group filter only |
| Squad list (screen 19) | "View compliance" | Group filter |
| Deep link `/staff/compliance?window=last_week` | Weekly compliance digest push (`08-notifications.md` §7) | Week view, previous week |
| Back from athlete profile | System back | Scroll position, view mode, date, domain tab all restored |

Per `02-information-architecture.md` §7 rule 3, back from an athlete profile opened here returns
here, not to the squad list.

---

## Layout

**Assumption, pending client design photographs.** The day view as a list and the week view as a
grid is my recommendation. The original drawing says only "day or week view" and does not
specify a form for either. The reasoning is below and it is the part worth challenging, not the
pixel treatment.

### Why list for day and grid for week

A day view has one cell per athlete per domain: three domains and forty athletes is 120 cells,
which fits a list of forty rows with three indicators each and stays readable on a phone. A week
view has one cell per athlete per day: seven days by forty athletes is 280 cells, which is a
grid and nothing else. Forcing both into the same form makes one of them bad. They are different
shapes of the same question.

### Mobile day view, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  Squad status    [All squad ▾]  [Today ▾]   │ 56 sticky
├────────────────────────────────────────────────┤
│  [ Day ]  Week            Tue 5 Aug · MD-4     │ 44 toggle row
│  ┌──────────────────────────────────────────┐  │
│  │ All  Wellness  RPE  Gym                  │  │ 44 domain tabs
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ 24/31 complete · 4 missing · 3 waived    │  │ 40 summary bar
│  └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│  MISSING (4)                                   │ sticky section
│  ┌──────────────────────────────────────────┐  │
│  │ ● T. Fitzgerald  #3      W ⊘ R ○ G ✓     │  │ 64 pt row
│  │ ● L. Haruna      #22     W ⊘ R ⊘ G,     │  │
│  │ ◑ K. Reilly      #9      W ⊘ R ○ G ✓     │  │
│  │ ● D. Owusu       #31     W ⊘ R ⊘ G ✓     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  DUE (3)                                       │
│  ┌──────────────────────────────────────────┐  │
│  │ ● S. Okafor      #7      W ✓ R ◌ G ◌     │  │
│  │ ● A. Nkemelu     #18     W ✓ R ◌ G ◌     │  │
│  │ ● C. Whelan      #12     W ✓ R ◌ G ◌     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  COMPLETE (21)                            ⌄    │ collapsed
│                                                │
│  WAIVED (3)                               ⌄    │ collapsed
│                                                │
│  Legend: ✓ complete  ○ partial  ⊘ missing      │
│          ◌ due, waived                       │
└────────────────────────────────────────────────┘
```

Rows are grouped by compliance state, worst first, and the two good states are collapsed by
default. This is the exceptions-over-exhaustiveness principle applied inside an exhaustive
screen: everything is present, but the eye lands on the problems. A coach who wants a flat
alphabetical list gets it from the sort control.

### Mobile week view, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  Squad status    [All squad ▾]  [Wk 32 ▾]   │
├────────────────────────────────────────────────┤
│  Day  [ Week ]        Mon 4 to Sun 10 Aug      │
│  ┌──────────────────────────────────────────┐  │
│  │ All  Wellness  RPE  Gym                  │  │
│  └──────────────────────────────────────────┘  │
├──────────────┬─────────────────────────────────┤
│ Athlete      │ M  T  W  T  F  S  S      %      │ sticky header
│ (frozen col) │ -5 -4 -3 -2 -1 MD +1            │ MD-n row
├──────────────┼─────────────────────────────────┤
│ ● Adeyemi J  │ ✓  ⊘  ✓  ✓  ◌  ·  ·     75     │ 44 pt rows
│ ◑ Byrne A    │ ✓  ✓  ✓, ◌  ·  ·     100    │
│ ● Fitzgerald │ ⊘  ⊘  ⊘  ✓  ◌  ·  ·     25     │
│ ● Haruna L   │ ✓  ⊘  ○  ✓  ◌  ·  ·     63     │
│ ○ Nowak M    │, -, -, ·  ·     n/a    │
│ ● Okafor S   │ ✓  ✓  ✓  ✓  ◌  ·  ·     100    │
│  ...                                           │
├──────────────┴─────────────────────────────────┤
│ Squad        │ 87 79 91 94  ◌  ·  ·     88     │ sticky footer
└────────────────────────────────────────────────┘
```

The athlete column is frozen. The day columns scroll horizontally on a phone at seven columns
wide, which fits at `md` with 34 pt cells but not at `xs`; at `xs` the grid scrolls. The MD-n
row under the day letters is not decoration: the schedule is the spine, and a missing entry on
MD-1 means something different from a missing entry on MD+2.

### Web, `xl` 1280 px

The full week grid fits without horizontal scroll. Day view renders as a table with one row per
athlete and one column per domain, plus availability, plus a 7-day sparkline of readiness in the
trailing slot.

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │ [All squad ▾] [This week ▾]           Tue 5 Aug · MD-4           ⚙︎ │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │  Squad status                              Day [ Week ]   ↓ Export   │
│ ▣ Dash │  All | Wellness | RPE | Gym                    Sort: State ▾         │
│  · Sqd │ ┌──────────────────────────────────────────────────────────────────┐ │
│  · Flg │ │ Athlete        Avail   Mon Tue Wed Thu Fri Sat Sun   %   Trend   │ │
│  · Tmt │ │                        -5  -4  -3  -2  -1  MD  +1               │ │
│  · Inj │ ├──────────────────────────────────────────────────────────────────┤ │
│ ▤ Sched│ │ ● Adeyemi J    ○ Unav  ✓   ⊘   ✓   ✓   ◌   ·   ·    75  ╱╲__    │ │
│ ▧ Squad│ │ ◑ Byrne A      ◑ Mod   ✓   ✓   ✓, ◌   ·   ·   100  ‾‾╲_    │ │
│ ▨ Prog │ │ ● Fitzgerald T ● Avail ⊘   ⊘   ⊘   ✓   ◌   ·   ·    25  ╲___    │ │
│ ⋯ More │ │ ...                                                              │ │
│        │ ├──────────────────────────────────────────────────────────────────┤ │
│        │ │ Squad (31)             87  79  91  94  ◌   ·   ·    88          │ │
│        │ └──────────────────────────────────────────────────────────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

Row density is `compact` at `lg` and above, `dense` when the coach opts in through the density
control, which drops the row to 36 px visual with 44 px targets preserved by padding
(`06-design-system.md` §10.1).

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Global filter, header |
| `PeriodSelector` | §6.8 | Day view uses a single date; week view uses an ISO week. `allowed={['today','thisWeek','custom']}` |
| `DayWeekToggle` | §6.9 | The "day or week view" control from the drawing. Choice persists per screen, not globally. |
| `CalendarStrip` | §6.15 | Mobile day view date navigation, with `markers` showing missing-entry dots and `mdOffsets` |
| `AthleteCard` | §6.1 | Day view rows on mobile. `trailing` carries the three domain glyphs. |
| `ComplianceRing` | §6.6 | Summary bar, per-athlete percentage on web, squad footer |
| `AvailabilityPill` | §6.5 | Availability column. `variant="glyphOnly"` in the week grid, permitted by §4.2 given the labelled column header. |
| `TrendSparkline` | §6.3 | Web trailing column, readiness over the visible window |
| `EmptyState` | §6.16 | Every state, with the correct `kind` per §11.2 |
| `ComplianceCell` | **New**, this screen | One athlete, one day or one domain, one of five states. See below. |
| `SectionHeader` | Standard | Collapsible group headers in the day view |

### `ComplianceCell`, new component

```ts
export type ComplianceCellProps = {
  state: 'complete' | 'partial' | 'missing' | 'waived' | 'pending' | 'notExpected';
  /** Rendered in the partial state, e.g. 3 of 5. */
  completed?: number;
  expected?: number;
  /** Required for waived. Shown on press. An unexplained waiver rots the data. */
  waivedReason?: string | null;
  /** Present on a day cell in week view. Drives the tooltip and the drill-down. */
  date?: string;
  domain?: ComplianceDomain;
  mdOffset?: number | null;
  onPress?: () => void;
  size?: 'grid' | 'row';        // 34 pt grid cell, 24 pt inline row glyph
};
```

`notExpected` is a sixth state beyond the five in `06-design-system.md` §4.3 and it is the one
that stops the whole screen lying. A rest day where nothing was expected renders `·` in
`text.tertiary`, not a missing glyph and not a complete glyph. Per `03-flows.md` §8: compliance
is measured against what was expected that day, never against a flat "every athlete every day",
and get this wrong and every compliance figure in the product is meaningless.

The five documented states plus `notExpected` are all distinguishable without colour, by glyph
alone: filled ring with tick, partial arc, hollow ring with slash, hollow ring with minus,
dashed ring, and a centred dot.

---

## Data requirements

### Field map

| Field | Source | Transformation |
|---|---|---|
| `athlete_id`, `display_name`, `squad_number` | `athletes` | Surname-first sort key: `last_name \|\| ' ' \|\| first_name` |
| `availability_status` | `availability.status`, latest open row | Null defaults to `available` |
| `restrictions` | `availability.restrictions` | First two, then "+n" |
| `reason_category` | `availability.reason_category` | Fixed labels |
| `body_area` | `injuries.body_area` via `availability.injury_id` | Enum label |
| `expected` | `compliance_expectations` count where `is_required` and `waived_reason is null` | Per athlete, per date, per domain |
| `waived` | `compliance_expectations` count where `waived_reason is not null` | Excluded from the denominator |
| `completed` | Count of matched entries | See matching rules below |
| `state` | Derived | See the derivation table |
| `window_open` | Derived from `sessions.starts_at` and the domain's cutoff rule | Drives `pending` versus `missing` |
| `md_offset` | `sessions.md_offset`, or `week_templates.structure` for a day with no session | Displayed under the day letter |
| `readiness_series` | `mv_daily_athlete_summary.readiness` | Sparkline points, nulls preserved as gaps |
| `squad_rate` | `mv_compliance_rates` | Footer row |

**Entry matching per domain.** An expectation is met by:

| Domain | Matched by |
|---|---|
| `wellness` | A `wellness_entries` row with the same `athlete_id` and `entry_date`, `superseded_by is null` |
| `training_rpe` | A `training_entries` row for the date, matched on `session_id` when the expectation names one |
| `gym` | A `gym_session_logs` row for the date with `status = 'complete'`, matched on `programme_session_id` when the expectation names one |

Revisions never double count. The match is against the live revision only, which is the row with
`superseded_by is null`.

**State derivation**, applied per athlete per domain per date:

| Condition | State |
|---|---|
| `expected = 0` and `waived = 0` | `notExpected` |
| `waived > 0` and `expected = 0` | `waived` |
| `completed >= expected` and `expected > 0` | `complete` |
| `completed > 0` and `completed < expected` | `partial` |
| `completed = 0` and `expected > 0` and window open | `pending` |
| `completed = 0` and `expected > 0` and window closed | `missing` |

**Nutrition is not a compliance domain.** Athletes do not log nutrition, so there is nothing to
match an expectation against. `'nutrition'` is retained in the `compliance_domain` enum but is
never generated (`04-data-model.md` §11), never queried here, and never shown as a domain tab.
See `nutrition-guidance.md` §9.

The window closes at 23:59 in the organisation's timezone for wellness, and 6
hours after `sessions.starts_at + duration_min` for RPE and gym. RPE is prompted at least 30
minutes after a session ends (`04-data-model.md` §5) so a shorter window would mark athletes
missing before they were asked.

### Day view query

```sql
create or replace function public.squad_compliance_day(
  p_date      date,
  p_group_ids uuid[] default '{}'::uuid[],
  p_domains   compliance_domain[] default null
)
returns table (
  athlete_id      uuid,
  display_name    text,
  squad_number    int,
  availability_status availability_status,
  restrictions    text[],
  reason_category availability_reason,
  body_area       body_area,
  expected_return date,
  domain          compliance_domain,
  expected        int,
  completed       int,
  waived          int,
  window_open     boolean,
  state           text
)
language sql
security invoker
stable
as $$
with scoped as (
  select a.id, a.first_name, a.last_name, a.squad_number
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and (cardinality(p_group_ids) = 0 or exists (
          select 1 from group_memberships gm
          where gm.athlete_id = a.id
            and gm.group_id = any (p_group_ids)
            and gm.removed_at is null
            -- membership as at the viewed date, not as at now
            and gm.added_at::date <= p_date
            and (gm.removed_at is null or gm.removed_at::date > p_date)))
),
exp as (
  select ce.athlete_id, ce.domain, ce.session_id,
         count(*) filter (where ce.is_required and ce.waived_reason is null)::int as expected,
         count(*) filter (where ce.waived_reason is not null)::int                as waived,
         max(s.starts_at + make_interval(mins => coalesce(s.duration_min, 0)))    as session_ends_at
  from compliance_expectations ce
  left join sessions s on s.id = ce.session_id
  where ce.org_id = auth_org_id()
    and ce.expectation_date = p_date
    and (p_domains is null or ce.domain = any (p_domains))
    and ce.athlete_id in (select id from scoped)
  group by ce.athlete_id, ce.domain, ce.session_id
),
done as (
  select e.athlete_id, e.domain, e.session_id,
         case e.domain
           when 'wellness' then (
             select count(*)::int from wellness_entries w
             where w.athlete_id = e.athlete_id and w.entry_date = p_date
               and w.superseded_by is null)
           -- no 'nutrition' branch: nothing is logged, so no expectation is ever
           -- generated for it. See 04-data-model.md §11.
           when 'training_rpe' then (
             select count(*)::int from training_entries t
             where t.athlete_id = e.athlete_id and t.entry_date = p_date
               and t.superseded_by is null
               and (e.session_id is null or t.session_id = e.session_id))
           when 'gym' then (
             select count(*)::int from gym_session_logs g
             where g.athlete_id = e.athlete_id and g.entry_date = p_date
               and g.status = 'complete')
         end as completed
  from exp e
),
avail as (
  select distinct on (av.athlete_id)
         av.athlete_id, av.status, av.restrictions, av.reason_category, av.injury_id
  from availability av
  where av.org_id = auth_org_id()
    and av.effective_from <= (p_date + 1)::timestamptz
    and (av.effective_to is null or av.effective_to > p_date::timestamptz)
    and av.athlete_id in (select id from scoped)
  order by av.athlete_id, av.effective_from desc
)
select
  s.id,
  s.last_name || ', ' || left(s.first_name,1) || '.',
  s.squad_number,
  coalesce(av.status, 'available')::availability_status,
  av.restrictions,
  av.reason_category,
  i.body_area,
  i.expected_return,
  e.domain,
  e.expected,
  coalesce(d.completed, 0),
  e.waived,
  wo.window_open,
  case
    when e.expected = 0 and e.waived = 0                       then 'notExpected'
    when e.expected = 0 and e.waived > 0                       then 'waived'
    when coalesce(d.completed,0) >= e.expected                 then 'complete'
    when coalesce(d.completed,0) > 0                           then 'partial'
    when wo.window_open                                        then 'pending'
    else 'missing'
  end
from scoped s
left join avail av on av.athlete_id = s.id
left join injuries i on i.id = av.injury_id
left join exp e     on e.athlete_id = s.id
left join done d    on d.athlete_id = e.athlete_id
                   and d.domain = e.domain
                   and d.session_id is not distinct from e.session_id
cross join lateral (
  select case
    when e.domain = 'wellness'
      then p_date >= (now() at time zone org_timezone())::date
    else coalesce(e.session_ends_at, p_date::timestamptz) + interval '6 hours' > now()
  end as window_open
) wo
order by s.last_name, s.first_name, e.domain;
```

`org_timezone()` is a `stable security definer` helper returning
`organisations.timezone` for the caller's org. It belongs alongside the other helpers in
`04-data-model.md` §14 and is added by this screen's migration.

`injury_clinical` appears nowhere in this query, and no view used here reaches it.

### Week view query

The week grid is a pivot of the same derivation across seven dates. It reads
`mv_compliance_rates` where possible and falls back to the day function only for the current
date, which the nightly view refresh has not yet covered.

```sql
create or replace function public.squad_compliance_week(
  p_week_start date,
  p_group_ids  uuid[] default '{}'::uuid[],
  p_domain     compliance_domain default null   -- null = all domains combined
)
returns table (
  athlete_id   uuid,
  display_name text,
  availability_status availability_status,
  day_offset   int,          -- 0 to 6
  the_date     date,
  md_offset    int,
  expected     int,
  completed    int,
  waived       int,
  state        text,
  week_pct     numeric
)
language sql security invoker stable
as $$
  -- Reads mv_compliance_rates for p_week_start .. p_week_start + 6,
  -- unioned with squad_compliance_day(current_date...) for today,
  -- pivoted by generate_series(0,6) and left joined so that an athlete
  -- with no expectations on a day yields state 'notExpected' rather
  -- than no row. Full body in the migration.
$$;
```

The left join against `generate_series` is the important detail. An athlete with no row for
Wednesday must render `notExpected`, not vanish from the grid and not shift the other columns.

### Query keys

```ts
squadStatus: {
  all: (orgId: string) => [...qk.org(orgId), 'squad-status'] as const,
  day: (orgId: string, date: string, groupIds: string[], domains: string[]) =>
    [...qk.squadStatus.all(orgId), 'day', date,
     { groupIds: [...groupIds].sort(), domains: [...domains].sort() }] as const,
  week: (orgId: string, weekStart: string, groupIds: string[], domain: string | null) =>
    [...qk.squadStatus.all(orgId), 'week', weekStart,
     { groupIds: [...groupIds].sort(), domain }] as const,
},
```

`staleTime` 60 s, polled at 60 s while focused, per the squad status row in
`05-architecture.md` §9. Realtime is **not** subscribed here: an entry arriving mid-read does
not change a coach's decision within the next minute, and forty athletes' worth of change
events would thrash the grid.

---

## States

### Default

Day view, today, all domains, group filter from global state, sorted by compliance state with
the worst first.

### Loading

- **Day view**: eight skeleton rows at 64 pt. Section headers render immediately with a skeleton
  count.
- **Week view**: the frozen athlete column renders skeleton name bars and the grid renders a
  uniform `surface.skeleton` block of exactly the final dimensions. No cell-by-cell shimmer,
  which at 280 cells looks like a fault.
- Switching between day and week reuses the cached opposite view if it is fresh, so the toggle
  feels instant on the second use.
- Stale-while-revalidate throughout: cached data renders with a small refreshing indicator and
  is never replaced by a skeleton.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| No athletes in the organisation | `notStarted` | "No athletes yet." Action "Add athletes" for coach and admin. |
| Group filter excludes everyone | `noResults` | "No athletes in Forwards." Action "Clear filter". Always names the active filter, per §11.2. |
| Nothing expected on the selected day | `noData` | "Nothing expected on Sun 10 Aug. MD+2, rest day." No action. |
| Domain tab has no expectations all week | `noData` | "Gym was not required this week." |
| Every athlete complete | Not empty | The list renders normally with all sections collapsed except a single summary line "31 of 31 complete." This is not an `allClear` empty state, because the data exists and the coach asked to see it. |

### Error

| Failure | Behaviour |
|---|---|
| Compliance query fails | Full-block error with retry: "Could not load squad status. Check your connection and try again." |
| Availability query fails | Rows render with the availability column showing "Status unavailable" in `text.tertiary`, never a guess. The compliance data is still useful. |
| Sparkline series fails (web) | Sparkline cells render the error variant. The table is unaffected. Caption: "Readiness trend unavailable." |
| Partial week | If three of seven days return, the grid renders those three and captions "Thu to Sun could not be loaded." Never renders a percentage over a partial week without saying so. |

### Offline

Cached day and week render with "Last updated 07:48" and a persistent offline chip. The
day/week toggle works across cached data. The date control is limited to dates present in the
cache, and dates outside it render `EmptyState kind="offline"`. Medical's availability editor is
disabled with "You are offline. This will be available when you reconnect."

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | As specified. Availability column is read-only. |
| Medical | Each availability cell gains an edit affordance opening the availability editor sheet. The domain tabs gain a fourth tab, "Rehab", showing rehab session compliance from `rehab_assignments` and `gym_session_logs` where the programme is of type `rehab`. |
| Dual role | Union. |

### Filtered

Active group filter renders "Showing Forwards only" beneath the header and the trigger in
`accent` tint. The squad footer row percentage is the filtered population's percentage, and its
label states the population size: "Squad (14)". A percentage over an unnamed denominator is how
a coach ends up quoting the wrong number in a staff meeting.

---

## Interactions

| Action | Result |
|---|---|
| Toggle Day / Week | Switches view. The selected date maps to its containing week and back to the same date. Choice persists per screen. |
| Tap a domain tab | Filters both views to that domain. Persisted per screen. |
| Tap an athlete row (day view) | Navigate to `athlete-profile.md`, tab selected by the active domain tab, date carried. |
| Tap a cell (week view) | Navigate to `athlete-profile.md`, that domain's tab, that date. Per `02-information-architecture.md` §7 rule 2, the drill-down preserves both. |
| Long-press a cell (mobile) | Tooltip sheet: state, expected, completed, waiver reason if any, MD-n, and the session name when the expectation names one. |
| Hover a cell (web) | Same content as a tooltip, 300 ms delay. |
| Tap the availability glyph | Coach: opens the athlete profile injury tab. Medical: opens the availability editor. |
| Tap a section header | Collapse or expand. State persists for the session. |
| Change sort | Options: Compliance state (default), Name, Squad number, Availability, Percentage. Persisted per screen. |
| Swipe left or right (mobile, week view) | Previous or next week. Snaps. |
| Swipe on the `CalendarStrip` (day view) | Moves by week, selects a day. |
| Tap "Export" (web) | Generates a CSV of the current view exactly as filtered, and writes an `export.run` audit event (`09-security-and-compliance.md` §8.5). |
| Tap a waived cell | Always shows the waiver reason. A waiver with no reason is a data quality fault and renders "Reason not recorded" plus a warning glyph. |
| Change group filter | All queries refetch. Scroll and expansion state preserved. |
| Pull to refresh | Invalidates `qk.squadStatus.all(orgId)`. |

**Not available on this screen**: submitting an entry on an athlete's behalf. Staff-entered data
is a deliberate act with provenance `staff_entered` and it belongs on the athlete profile, where
the coach can see what they are overwriting. A one-tap "mark complete" on a compliance grid
would destroy the meaning of the compliance figure within a week.

---

## Validation rules

| Rule | Behaviour |
|---|---|
| Compliance is never computed against a flat daily assumption | If `compliance_expectations` has no row, the cell is `notExpected`. The screen never infers an expectation from a schedule at read time. |
| A percentage is never rendered without its denominator | "88%" always carries "27 of 31". `ComplianceRing` enforces this through `completed` and `expected` being required props. |
| Waived is excluded from the denominator, never counted as complete | `ComplianceRing` takes `waived` separately and renders it as a lighter arc. |
| A waiver must have a reason | Enforced at write time on `compliance_expectations.waived_reason`. At read time, a null reason on a waived row renders "Reason not recorded" and is logged at `warn`. |
| Group membership is resolved as at the viewed date | `group_memberships` is history-preserving deliberately (`04-data-model.md` §3). "Show me the forwards in March" must use March's membership. The day query does this; a naive `removed_at is null` filter is a bug. |
| Revisions do not double count | Matching is against `superseded_by is null` only. |
| An athlete with zero expectations all week shows `n/a`, not 0% | Division by zero renders the not-applicable glyph (`06-design-system.md` §6.6). |
| The window-open rule uses organisation time | Never device time, never UTC for a day boundary. |
| A future date shows `pending` or `notExpected`, never `missing` | Marking tomorrow as missing is a bug that erodes trust in the whole screen. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Athlete joined mid-week.** | Expectations exist only from `athletes.joined_at`. Days before render `notExpected` with a tooltip "Not in the squad on this date". Their week percentage uses only the days they were present. |
| **Athlete left mid-week.** | Symmetric. Rows for `left_club` athletes are excluded from the default population and available under a "Include former athletes" toggle for historical weeks. |
| **Athlete moved from Forwards to Backs on Wednesday.** | With Forwards selected, Monday to Tuesday cells render and Wednesday onwards render `notExpected` with "Not in Forwards on this date". This falls directly out of resolving membership as at the date and it is why that rule exists. |
| **Athlete is unavailable and wellness is waived.** | Cells render `waived` with the reason "Unavailable, wellness not required". They are not counted as missing. Punishing absence as non-compliance is the failure mode that makes compliance figures useless. |
| **Athlete is unavailable and wellness is still required.** | Some clubs want daily wellness from injured athletes because it drives rehab decisions. The expectation exists, the cell behaves normally. This is a per-organisation setting, not a hard rule. See O-379. |
| **Two sessions in one day both requiring RPE.** | Two expectations with distinct `session_id`. The day view shows `partial` at 1 of 2 and the tooltip names both sessions. |
| **A session was cancelled after expectations were generated.** | The nightly job waives expectations for cancelled sessions with the reason "Session cancelled". Cells render `waived`, not `missing`. If a session is cancelled after the nightly run, the cancel mutation waives them immediately in the same transaction. |
| **Fixture postponed, MD-n labels recompute.** | The grid shows the new MD-n labels. Sessions already logged keep their original label, shown on hover as "Logged as MD-2". Per `04-data-model.md` §4. |
| **Two fixtures in one week.** | The MD-n row shows both labels stacked, for example "+1 / -3". The column is 34 pt wide, so the labels use `micro` type and the full pair is in the tooltip. |
| **Squad of 120 in week view.** | 840 cells. Virtualised list with a windowed renderer and a frozen first column. See Performance notes. |
| **An athlete has no user account yet** (`athletes.user_id is null`). | They appear in the grid with all cells `notExpected` and a chip "Not invited". A coach seeing a row of missing entries for someone who has never had the app is the most common false alarm in this category of product. |
| **Timezone change**, club touring abroad. | `organisations.timezone` is the boundary. Changing it mid-season shifts day boundaries for future dates only. Historical `entry_date` values are dates, not timestamps, and do not move. |
| **DST transition.** | Day boundaries come from `date` columns, so the 23-hour and 25-hour days do not affect the grid. The RPE window rule uses interval arithmetic on `timestamptz`, which handles it correctly. |
| **Nightly expectation generation failed.** | Every cell for today is `notExpected` and the whole squad reads as compliant, which is silently wrong. Guard: if `compliance_expectations` has zero rows for a date on which sessions exist, the screen renders a banner "Expectations have not been generated for this date" and the percentages are suppressed. This is a real failure mode with a quiet symptom and it needs the banner. |

---

## Performance notes

Budget from `05-architecture.md` §11: **squad status query, 150 ms p95 server time,
materialised-view backed.**

| Concern | Approach |
|---|---|
| The day query is not view-backed | It reads today, which no nightly view covers. It is bounded to one date times the filtered population times three domains, so 120 rows at 40 athletes. The correlated subqueries in `done` run once per expectation group, and each is an index-only lookup on `(athlete_id, entry_date desc)`, which all three entry tables already index (`04-data-model.md` §15). |
| Historical days must not use the day query | Any date before today reads `mv_compliance_rates` and `mv_daily_athlete_summary`. The client picks the path by date. A coach browsing back through March must not trigger 90 days of live aggregation. |
| Required new index | `create index on compliance_expectations (org_id, expectation_date, domain)`. The table currently has only its unique constraint on `(athlete_id, expectation_date, domain, session_id)`, which does not serve a whole-squad-by-date scan. This migration belongs with this screen. |
| Week grid rendering | Virtualised rows with `estimatedItemSize` fixed, frozen first column implemented as a separate synchronised scroll view on native and `position: sticky` on web. Cells are pure components keyed by `athlete_id + date + domain` and memoised. Re-rendering 840 cells on a filter change is the one thing that will make this screen feel slow. |
| Payload | Day view, 40 athletes, 4 domains: about 45 KB uncompressed. Week view, 40 athletes, 7 days: about 60 KB. Both well inside budget. Column names are shortened in the RPC return for the week grid. |
| Polling | 60 s while focused, suspended when the screen is backgrounded or the app loses focus. No realtime subscription. |
| Sorting and collapsing | Client-side on the already-fetched set. Changing sort never refetches. |
| Domain tab switch | Refetches only when the domain filter changes the server-side predicate. "All" is fetched once and the tabs filter client-side, which makes tab switching instant at the cost of one larger payload. This is the right trade at 40 athletes and would not be at 400. |
| Export | Runs server-side as a `report_runs` job, not by serialising the client's state. The client sends the filter definition, not the rows. |
| Measurement | Spans `squadStatus.day.query` and `squadStatus.week.render`. The render span matters more than the query span here, which is unusual and worth watching. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Grid semantics | Week view is a real `table` on web with `<th scope="row">` on athlete names and `<th scope="col">` on day headers. On native it uses `accessibilityRole="table"` with row and column index properties on every cell. A `View` soup with visual columns is not navigable and is not acceptable here. |
| Cell label | `{athlete}, {domain}, {date}: {state}. {detail}.` Example: "Fitzgerald T, wellness, Tuesday 5 August: missing. Expected, window closed." |
| Waived cell label | Always includes the reason: "waived, unavailable, wellness not required". |
| `notExpected` label | "not expected" and never "no data", because those mean different things and the distinction is the whole point of the state. |
| Column header | Day headers announce as "Tuesday 5 August, MD minus 4". |
| Glyph-only availability | Permitted in the grid by `06-design-system.md` §4.2 because the column header supplies the meaning and every cell carries a screen reader label and a long-press tooltip. This is the case O-37 asks the client to confirm. |
| Frozen column | Announced once as a row header, not repeated per cell. |
| Reading order | Day view: summary, then sections worst first. This means a screen reader user hears the missing athletes before the complete ones, which is the same benefit the visual grouping gives. |
| Touch targets | Grid cells are 34 pt visually with 44 pt targets via `hitSlop`. Adjacent targets keep 8 pt separation, so at `xs` the grid scrolls rather than shrinking cells below the floor. |
| Dynamic type | At 150% the week grid drops to five visible columns with horizontal scroll. At 200% the week view offers a "switch to list" affordance, because a 7-column grid at 200% is not readable at any density. The list alternative is the accessible path, matching the chart table alternative in §8.6. |
| Colour independence | All six cell states are distinguishable by glyph. Verified by a snapshot test rendering the legend in greyscale. |
| Focus, web | Arrow keys move between grid cells, `Home` and `End` move to the row edges, `Enter` drills in. Focus ring is 2 pt at 2 pt offset and is visible on a cell as well as on a row. |
| Sort announcement | Changing sort announces "Sorted by name, ascending. 31 athletes." |
| Print | The week grid prints on one landscape A4 for up to 45 athletes. Glyphs survive greyscale by fill proportion. |

---

## Open questions

- **O-378**: Day view as a grouped list and week view as a grid is my recommendation, not a
  transcription of your drawing. The drawing says "day or week view" and nothing more. Confirm
  after the design photographs arrive, because a week view drawn as seven stacked day lists is
  a different screen.
- **O-379**: Is wellness expected from an unavailable athlete? Some clubs want daily wellness
  from injured athletes because it informs rehab; others waive it so the compliance figure is
  not distorted by a long-term absentee. I have made it an organisation setting defaulting to
  **waived**, which is the safer default for the compliance number. Confirm the default.
- **O-380**: **Closed by O-11, 5 August 2026, and it stays closed.** Nutrition compliance has
  no definition to argue about, because meals and macros are not logged. The domain tab, the
  matching rule and the query branch have all been removed from this screen. **O-890 was
  resolved the same day and does not reopen it**: the weekly one-tap check-in
  (`nutrition-checkin.md`) is deliberately **not** a compliance domain, generates no
  `compliance_expectations` rows, and never appears on this screen at any grain. A missed
  check-in is a gap in a coverage figure, not non-compliance. The argument is in
  `nutrition-checkin.md` §"Compliance".
- **O-381**: Sort default. I have defaulted to compliance state, worst first, on the exceptions
  principle. Alphabetical is what a coach reading out a list expects, and squad number is what
  a team sheet uses. All three are available; only the default is in question.
- **O-382**: Should this screen allow a coach to waive an expectation inline? It is the fastest
  path for "Tom is away on Thursday" and it is also a one-tap route to making the compliance
  figure say whatever the coach wants. I have excluded it and put waivers on the athlete
  profile behind a required reason. Confirm, because coaches will ask for it.

---

## Related documents

- Exception view of the same data → `dashboard.md`
- Per-athlete detail → `athlete-profile.md`
- Availability in full → `injury-dashboard.md`
- What "expected" means → `03-flows.md` §8, `04-data-model.md` §11
- Cell states and glyphs → `06-design-system.md` §4.3
