> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Schedule

> **Layout status**: provisional. Awaiting client design photographs.

Screen 15 in the inventory (`02-information-architecture.md` §5). File: `docs/screens/schedule.md`.

---

## Purpose

The Schedule is the calendar of everything the squad is asked to do: training sessions, gym
sessions, fixtures, testing, recovery, meetings, and rehab. It is the surface on which a coach
plans a week and the surface every other part of Fydr hangs off.

Product principle 4 states the schedule is the spine. Concretely, this screen is responsible for
four things that nothing else does:

1. **Showing the MD-n position of every day**, so a coach never has to count backwards from a
   fixture in their head.
2. **Creating, editing, and moving sessions**, which is what generates `sessions` rows and
   therefore what generates `compliance_expectations`.
3. **Applying a week template** to a week, turning an MD-n plan into concrete sessions.
4. **Making the shape of the week visible**: planned load per day, so a coach can see whether
   they have built a sensible microcycle before athletes turn up to it.

It is not an analysis screen. Actual load against planned load lives on `session-detail.md` and
`analytics.md`. The Schedule shows the plan.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full read and write. Create, edit, move, cancel, delete sessions. Apply templates. |
| Medical / Physio | Full read. Write limited to sessions of `session_type = 'rehab'` and to reading availability overlays. See the note below. |
| Admin / Club owner | No access. Not in the staff schedule navigation for an admin-only user. |
| Athlete | No access to this screen. Athletes see their own schedule on Today (`today.md`) and in the session detail sheet reached from it. |

`01-roles-and-permissions.md` §2 grants both coach and medical `Create/edit schedule and
sessions`. Taken literally that lets a physio move Tuesday's conditioning session, which is not
what any club wants. **Assumption**, pending confirmation: medical staff get full read plus
write on `rehab` sessions and on the participant list of any session (to remove a restricted
athlete), and no other write. Raised as O-349.

Rules that apply regardless of role:

- Every read is scoped by RLS to `org_id = auth_org_id()`. No cross-organisation read exists.
- The screen shows availability status on athlete chips, never a diagnosis
  (`CLAUDE.md` §2 rule 3).
- Schedule editing is **online only** (`05-architecture.md` §6, scope boundary). Offline, the
  screen renders the cached week read-only.

---

## Entry points

| From | Route | Context carried |
|---|---|---|
| Staff tab bar, Schedule tab (mobile) | `(staff)/schedule` | Last viewed date and view mode, restored from persisted UI state |
| Web sidebar, Schedule | `/schedule` | As above |
| Staff dashboard, "Today's timetable" card, "Open schedule" | `/schedule?date={today}&view=day` | Today, day view |
| Fixture detail, "View this week" | `/schedule?date={kickoff_date}&view=week` | The fixture's week, fixture highlighted |
| MD-n planner, after applying a template | `/schedule?date={week_start}&view=week&applied={template_id}` | The affected week, with a confirmation toast and an undo affordance |
| Session detail, back navigation | Returns to the originating view, per `02-information-architecture.md` §7 rule 3 | |
| Push notification `session.changed` (staff) | `fydr://schedule/session/{session_id}` | Opens session detail over the week view |
| Deep link from a weekly compliance digest email | `https://app.fydr.io/schedule?date=...&view=week` | |
| Squad list, athlete row, "Schedule" action | `/schedule?athlete={athlete_id}` | Applies a single-athlete overlay filter, distinct from the group filter |

Route parameters are the contract:

| Parameter | Values | Default |
|---|---|---|
| `date` | ISO date | Today in the organisation's timezone |
| `view` | `day` \| `week` \| `month` | `week` on web, `day` on mobile |
| `athlete` | uuid | none |
| `types` | comma-separated `session_type` values | all |

The group filter is **not** a route parameter. It is global state per `CLAUDE.md` §3 and
survives navigation and restart.

---

## Layout

### Mobile, week view (primary working view on a phone is still the week)

Portrait 390 pt. The week view on a phone is a vertical list of day sections, not a
seven-column grid. A seven-column grid at 390 pt gives each day 50 pt of width, which cannot
hold a session title. This is a deliberate divergence from the web layout and is an
**assumption** pending the client's designs (O-350).

```
+------------------------------------------------------+
| <  Schedule                          [Today] [ ... ]  |  header, 56 pt
| [All squad v]              [Day][Week][Month]         |  GroupFilter + view toggle
+------------------------------------------------------+
| <   Mon 3 Aug  to  Sun 9 Aug 2026                >    |  week pager, swipeable
+------------------------------------------------------+
| Week load    ####   ########   ##   #######  |        |  load strip, 7 bars
|              M  T   W   T   F   S   S                 |
+------------------------------------------------------+
| MON 3 AUG                              MD-5   [+]    |  day header, sticky
|  +------------------------------------------------+  |
|  | 09:30  Recovery                       45 min   |  |  SessionCard
|  | [recovery] Pool                    RPE 3 / 135 |  |
|  | 24 athletes   W  R                             |  |  required entries chips
|  +------------------------------------------------+  |
|  Planned load 135                                    |
+------------------------------------------------------+
| TUE 4 AUG                              MD-4   [+]    |
|  +------------------------------------------------+  |
|  | 08:00  Lower body                     60 min   |  |
|  | [gym] Gym                          RPE 8 / 480 |  |
|  | Forwards (12)   W  R  N                        |  |
|  +------------------------------------------------+  |
|  +------------------------------------------------+  |
|  | 18:00  Conditioning                   90 min   |  |
|  | [training] Main pitch              RPE 8 / 720 |  |
|  | 24 athletes   W  R  N                          |  |
|  +------------------------------------------------+  |
|  Planned load 1200                        (!) high   |
+------------------------------------------------------+
| WED 5 AUG                              MD-3   [+]    |
|  ...                                                  |
+------------------------------------------------------+
| SAT 8 AUG                                 MD   [+]   |
|  +==============================================+    |  fixture banner, 2 pt border
|  | 15:00  v Ashford RFC              HOME       |    |
|  | League   Key fixture   Scheduled             |    |
|  | Squad 23 named  2 unavailable                |    |
|  +==============================================+    |
+------------------------------------------------------+
| SUN 9 AUG                        MD+1 / MD-6   [+]   |  dual label
|  Rest day. Nothing scheduled.                        |
+------------------------------------------------------+
|                                          ( + )        |  FAB, new session
+------------------------------------------------------+
```

### Mobile, day view

```
+------------------------------------------------------+
| <  Schedule                          [Today] [ ... ]  |
| [Forwards v]               [Day][Week][Month]         |
+------------------------------------------------------+
| M   T   W   T   F   S   S                            |  CalendarStrip
| 3   4   5   6   7   8   9                            |
| .   ..  .   .   -   #   .                            |  markers
| -5  -4  -3  -2  -1  MD  +1                           |  MD-n row
+------------------------------------------------------+
| Tuesday 4 August 2026                    MD-4        |
| Planned load 1200   Required: wellness, RPE, nutrition|
+------------------------------------------------------+
| 07:00 |                                              |  time gutter, hourly
| 08:00 | +------------------------------------------+ |
|       | | Lower body            gym       60 min   | |
| 09:00 | | Gym            Forwards (12)  RPE 8/480  | |
|       | +------------------------------------------+ |
| 10:00 |                                              |
|  ...  |                                              |
| 18:00 | +------------------------------------------+ |
|       | | Conditioning     training       90 min   | |
| 19:00 | | Main pitch     All squad (24) RPE 8/720  | |
|       | +------------------------------------------+ |
| 20:00 |                                              |
+------------------------------------------------------+
|                                          ( + )        |
+------------------------------------------------------+
```

### Mobile, month view

```
+------------------------------------------------------+
| <  Schedule                          [Today] [ ... ]  |
| [All squad v]              [Day][Week][Month]         |
+------------------------------------------------------+
| <          August 2026                        >      |
+------------------------------------------------------+
|  Mon   Tue   Wed   Thu   Fri   Sat   Sun             |
| +-----+-----+-----+-----+-----+-----+-----+          |
| |  27 |  28 |  29 |  30 |  31 |  1  |  2  |          |
| | -5  | -4  | -3  | -2  | -1  | MD  | +1  |          |
| | ..  | ..  | .   | .   | .   |[#]  |     |          |
| +-----+-----+-----+-----+-----+-----+-----+          |
| |  3  |  4  |  5  |  6  |  7  |  8  |  9  |          |
| | -5  | -4  | -3  | -2  | -1  | MD  |+1/-6|          |
| | .   | ..  | ..  | .   | .   |[#]  |     |          |
| +-----+-----+-----+-----+-----+-----+-----+          |
| ...                                                   |
+------------------------------------------------------+
| Legend  . session   [#] fixture   ! flagged day       |
+------------------------------------------------------+
```

Month cells carry the day number, the MD-n label at `micro`, and up to three markers. They do
not carry session titles. A month cell at 52 pt wide cannot hold a title, and pretending
otherwise produces truncation that is worse than a marker.

### Web, week view (the primary working view)

1280 px design target. Persistent sidebar 248 px, header 56 px, per `06-design-system.md` §9.2.

```
+---------+----------------------------------------------------------------------------------+
| Fydr    | [All squad v]  [Season 2026/27 v]                     [Today] [<] [>]  [Day|Week|Month] |
|         +----------------------------------------------------------------------------------+
| Dash    |  Mon 3 Aug 2026  to  Sun 9 Aug 2026            Week 5 of 42   [Apply template ...] |
| SCHED   +--------+--------+--------+--------+--------+--------+--------+--------------------+
| Squad   |  MON 3 |  TUE 4 |  WED 5 |  THU 6 |  FRI 7 |  SAT 8 |  SUN 9 |                    |
| Progs   |  MD-5  |  MD-4  |  MD-3  |  MD-2  |  MD-1  |   MD   | MD+1   |                    |
| More    |        |        |        |        |        |        | MD-6   |                    |
|         +--------+--------+--------+--------+--------+--------+--------+                    |
|         | all-day|        |        |        |        |[FIXTURE|        |  all-day lane      |
|         |        |        |        |        |        | v Ash- |        |                    |
|         |        |        |        |        |        | ford   |        |                    |
|         |        |        |        |        |        | 15:00 H|        |                    |
|         +--------+--------+--------+--------+--------+--------+--------+                    |
|  07:00  |        |        |        |        |        |        |        |                    |
|  08:00  |        |+------+|        |+------+|        |        |        |                    |
|  09:00  |+------+|| Lower||        || Speed||        |        |        |                    |
|  10:00  || Recov|||  gym ||        || trng ||        |        |        |                    |
|  11:00  |+------+|+------+|        |+------+|        |        |        |                    |
|  ...    |        |        |        |        |        |        |        |                    |
|  15:00  |        |        |        |        |        |[MATCH ]|        |                    |
|  16:00  |        |        |        |        |        |[      ]|        |                    |
|  17:00  |        |        |+------+|        |+------+|        |        |                    |
|  18:00  |        |+------+|| Team ||        || Capt ||        |        |                    |
|  19:00  |        || Cond ||| trng ||        || run  ||        |        |                    |
|  20:00  |        |+------+|+------+|        |+------+|        |        |                    |
|         +--------+--------+--------+--------+--------+--------+--------+                    |
|         | Load   |        |        |        |        |        |        |                    |
|         |  135   |  1200  |   840  |   450  |   180  |   600  |    0   |  planned load row  |
|         | ####   |########|######  |###     |#       |#####   |        |                    |
|         +--------+--------+--------+--------+--------+--------+--------+                    |
|         | Req    | W R    | W R N  | W R N  | W R    | W R N  | W R    | W  |               |
|         +--------+--------+--------+--------+--------+--------+--------+                    |
|         | Week planned load 3405   |  Prev week 3120  |  +9%   |  [Open in MD-n planner]    |
+---------+----------------------------------------------------------------------------------+
```

**Anatomy of a day column, top to bottom:**

| Band | Height | Contents |
|---|---|---|
| Date header | 40 px, sticky | Weekday, date. Today carries an `accent` ring. |
| MD-n chip | 22 px, sticky | Primary label. Secondary MD+n label on a second line where applicable. |
| All-day lane | auto, min 0 | Fixtures, and sessions with no `starts_at` time component of significance (meetings marked all-day). Expands to fit. |
| Time grid | 07:00 to 21:00 by default, 44 px per hour | Positioned session blocks. Scrolls vertically as one body across all seven columns. |
| Planned load row | 52 px, sticky bottom | Numeric total plus a mini bar, scaled to the week's maximum. |
| Required entries row | 24 px, sticky bottom | `W` wellness, `R` RPE, `N` nutrition, derived from the union of the day's sessions. |

The time grid start and end adapt: it always covers 07:00 to 21:00, and extends to include any
session outside that range in the visible week.

---

## Components

**As shipped, this table describes a screen that was never built.** The real Schedule
week view is a full client-side rebuild against a separate, real spec file referenced
directly in the component headers, `SCHEDULE-SPEC.md` (not tracked in `/docs` — check
`src/components/ScheduleGrid/*.tsx`'s own header comments for the section numbers cited
below). There is no day view, no month view, and no offline mode: per CLAUDE.md §8, the
code is the fact here and the table below was corrected to match it rather than silently
kept. The original per-component breakdown (`SessionBlock`, `FixtureBanner`, `MdChip`,
`LoadBar`, `RequiredEntriesRow`, `BottomSheet`/`ConfirmSheet`/`SyncStatusIndicator`,
`SessionEditorSheet`, `TemplatePickerSheet`) was never built as those separate pieces —
their responsibilities live inside the components below instead.

| Component | Where | Purpose |
|---|---|---|
| `ScheduleWorkspace` | `components/ScheduleGrid/ScheduleWorkspace.tsx` | The whole screen's client-side orchestrator (`SCHEDULE-SPEC.md`, full rebuild). Squad-group filter chips, Read/Edit toggle, week navigation, publish status banner. Every edit (`edits`/`added`/`removed`) is held as client-only state until Publish — see the component's own header comment for why that stands in for the draft/publish column `sessions` does not have. |
| `TimeGrid` | `components/ScheduleGrid/TimeGrid.tsx` | The time grid itself (`SCHEDULE-SPEC.md` §5) — this screen's version of the `SessionBlock` idea above, absolutely positioned `.sg-block` elements placed and clash-detected by `lib/scheduleGeometry.ts`, not a separate component. |
| `SelectedSessionPanel` | `components/ScheduleGrid/SelectedSessionPanel.tsx` | The detail/edit panel for whichever block is selected (`SCHEDULE-SPEC.md` §6) — an inline panel in the page layout, not a bottom sheet or drawer. Read mode shows the session's facts, including the restriction-conflict banner from the integration audit's restriction-to-session-card linkage; Edit mode is a real form. |
| `WeekStatsPanel` | `components/ScheduleGrid/WeekStatsPanel.tsx` | "This week against a normal week" — not in the original spec at all. Sessions and contact minutes per type, this week vs. the mean of the last 4–5 weeks with a fixture, plus contact time per group. |
| `SessionCard` | `components/SessionCard/SessionCard.tsx` | **Not used on this screen.** Renders a session row on the Timetable page and the Fixture detail page's "Sessions anchored to this fixture" list — the mobile-list/month-day-sheet framing this table used to give it doesn't apply here. |
| Group filter chips | inline in `ScheduleWorkspace` | Same role as `GroupFilter` (`06-design-system.md` §6.7, still required by `CLAUDE.md` §3) but built inline, not as a shared component. |
| `ThemeToggle` | `components/ThemeToggle/ThemeToggle.tsx` | Light/dark toggle, top right. Real; not in the original spec. |

The MD-n chip itself is inline JSX in `TimeGrid`/`SelectedSessionPanel` calling `mdLabel()`
(`lib/format.ts`), not its own `MdChip` component — see the labelling rules below, also
corrected. `06-design-system.md` §6's own component inventory has not been re-synced to
this list; that is a further, still-open doc gap, noted here rather than fixed in this pass.

---

## Data requirements

### Fields

| Field | Source | Transformation |
|---|---|---|
| Organisation timezone | `organisations.timezone` | Every date boundary in this screen is computed in this timezone, never in UTC and never in the device timezone. |
| Week bounds | derived | `week_start` is the organisation's week start day (default Monday, `organisations.settings->>'week_starts_on'`). Range is `[week_start, week_start + 7)` in org time, converted to `timestamptz` for the query. |
| Session id | `sessions.id` | |
| Session title | `sessions.title` | |
| Session type | `sessions.session_type` | Drives glyph and block colour. |
| Start time | `sessions.starts_at` | `at time zone org.timezone` for display. Rendered `HH:MM`, 24-hour (`06-design-system.md` §12.2). |
| Duration | `sessions.duration_min` | Block height = `duration_min / 60 * hourRowHeight`. Null duration renders a 30-minute block with a dashed lower edge. |
| End time | derived | `starts_at + duration_min`. Not stored. |
| Location | `sessions.location` | Truncated to one line in a block, full in the popover. |
| Stored MD-n | `sessions.md_offset` | The raw column. Only trusted for display when its own calendar week has no matchday to anchor against — corrected from what this row used to say ("never recomputed"); see the labelling rules below. |
| Computed day MD-n | derived, `anchorMdOffsetsToWeek` (`lib/format.ts`) | Every day in a week that has a matchday is labelled by its distance from the *nearest* one, not by `day - next_fixture_date` against `fixtures` directly. See the labelling rules below. |
| Planned RPE | `sessions.planned_rpe` | 1 decimal, per `metricFormats.rpe`. |
| Planned load | `sessions.planned_load` | Stored. Equals `planned_rpe * duration_min`. Recomputed on write, never on read, so a hand-edited value survives. |
| Required entries | `sessions.requires_wellness`, `requires_rpe`, `requires_nutrition` (dead, always false, see `04-data-model.md` §4) | Per day, the union across that day's sessions. A day is "wellness required" if any session requires it. |
| Status | `sessions.status` | `cancelled` renders strikethrough and 50% opacity, per §6.14. |
| Participant summary | `session_participants` | Count of distinct athletes after group expansion, as at the session date. Label is the group name when exactly one group row and no athlete rows, otherwise "N athletes". |
| Fixture id | `fixtures.id` | |
| Opponent | `fixtures.opponent` | Prefixed "v " in the UI. |
| Kickoff | `fixtures.kickoff_at` | |
| Home or away | `fixtures.home_away` | Rendered as a letter chip: H, A, N. |
| Competition | `fixtures.competition` | |
| Importance | `fixtures.importance` | `key` and `cup_final` render a filled marker on the fixture banner. |
| Fixture status | `fixtures.status` | `postponed` and `cancelled` render struck through and are excluded from MD-n computation. |
| Flag markers | `flags.flag_date`, `flags.status` | Count of flags in `('raised','notified')` per day, for the month view marker only. |
| Availability overlay | `availability` current rows | Count of `unavailable` and `modified` athletes per day, shown on the fixture banner and in the participant popover. |

### MD-n labelling rules

**As shipped, this differs from what this section originally specified** — there is no
`packages/core/md-offset.ts`, no nightly `recompute_md_offsets` job, no 9-day horizon, no
`D1`–`D7` training-week fallback, and no simultaneous primary/secondary MD-n/MD+n label.
None of that was built. The real rule is implemented once, as `anchorMdOffsetsToWeek`
(`lib/format.ts`), and called via `fetchWeekMdLabels`/`mondayOf` (`lib/queries/schedule.ts`)
everywhere an MD-n label renders — the week grid, the Timetable page, the athlete's Today
strip, every single-session detail page, and the Fixture detail page's anchored-sessions
list. A live cross-tenant audit (finding "B2") once found 25 of 39 real sessions in one
org's data disagreeing with their own week view because a render site used the raw stored
offset instead of this rule; every such site has since been fixed to go through it.

For the 7-day window being labelled (a calendar week, Monday to Sunday in the
organisation's timezone):

1. Find every day in the window that holds a match session (`session_type = 'match'`) or a
   session whose own stored `md_offset` is `0`. These are that week's matchday(s).
2. **If the window has no matchday of its own**, every day falls back to its **stored**
   `md_offset` — the one case where the raw column is trusted for display, only because
   there is nothing in that window to anchor to instead.
3. **If the window has one or more matchdays**, every day in the window (matchdays
   included) is re-labelled as its distance in days from the *nearest* matchday — never
   from the stored offset, which may have been computed against a fixture in a different
   week entirely. That drift is exactly what finding B2 caught: a stored offset points at
   whichever fixture existed when the session was created, which for a historical week can
   be a fixture the following week.
4. On a tie (equidistant from two matchdays), the upcoming one wins — a negative offset
   ("building toward Saturday") reads better than one counting away from a match just
   played.
5. There is no secondary label. A day gets an MD-n label from rule 3, or (only in the
   no-matchday-in-window case) whatever rule 2 stored, or nothing.

This is a real simplification against the original spec's two-fixtures-in-a-week rule
(dropped along with the rest of the primary/secondary label mechanism above — the case
itself is `03-flows.md` §8's "Weekly planning around MD-n") — raised as O-351 and still
unresolved by this rebuild: a week with two matchdays gets one MD-n label per day from the
nearer of the two (rule 4's tie-break only fires exactly on the midpoint), not the visible
dual label the original spec called for.

### The primary query, week view

**This SQL block is the original spec's reference query and was not built as written** —
in particular, its `day_labels` CTE below is the same never-shipped `md_forward`/`md_back`
next-fixture/prev-fixture rule the "MD-n labelling rules" section above already flags as
replaced by `anchorMdOffsetsToWeek`. The real week view is not a single SQL round trip
either: it's a small set of `.from(...)` calls in `lib/queries/schedule.ts`
(`fetchWeekSessionsDetailed` for the grid's sessions, `fetchWeekMdLabels` for the MD-n map,
`fetchWeekFixtures` for the all-day fixture lane), composed in JS rather than one CTE
chain, then re-anchored client-side. Left as-is below rather than rewritten line by line —
that's a larger doc-sync pass than this correction pass, not a small one.

```sql
-- Week view. One round trip.
-- :week_start   date, first day of the week in org time
-- :group_ids    uuid[], empty array means All squad
-- :types        session_type[], empty array means all types
--
-- RLS restricts every table below to auth_org_id(). The explicit org_id predicates are
-- redundant for security and present for the query planner.

with org as (
  select id, timezone,
         coalesce((settings->>'week_starts_on')::int, 1) as week_starts_on
  from organisations
  where id = auth_org_id()
),
bounds as (
  select
    o.timezone,
    (:week_start)::date                                             as from_date,
    ((:week_start)::date + 7)                                       as to_date,
    ((:week_start)::date)::timestamp     at time zone o.timezone    as from_ts,
    ((:week_start)::date + 7)::timestamp at time zone o.timezone    as to_ts
  from org o
),
days as (
  select d::date as day, b.timezone
  from bounds b,
       generate_series(b.from_date, b.to_date - 1, interval '1 day') d
),
day_labels as (
  select
    d.day,
    nf.id           as next_fixture_id,
    nf.local_date   as next_fixture_date,
    pf.id           as prev_fixture_id,
    pf.local_date   as prev_fixture_date,
    (d.day - nf.local_date) as md_forward,     -- <= 0, null when no next fixture
    (d.day - pf.local_date) as md_back         -- >  0, null when no previous fixture
  from days d
  left join lateral (
    select f.id, (f.kickoff_at at time zone d.timezone)::date as local_date
    from fixtures f
    where f.org_id = auth_org_id()
      and f.deleted_at is null
      and f.status in ('scheduled','played')
      and (f.kickoff_at at time zone d.timezone)::date >= d.day
    order by f.kickoff_at asc
    limit 1
  ) nf on true
  left join lateral (
    select f.id, (f.kickoff_at at time zone d.timezone)::date as local_date
    from fixtures f
    where f.org_id = auth_org_id()
      and f.deleted_at is null
      and f.status in ('scheduled','played')
      and (f.kickoff_at at time zone d.timezone)::date < d.day
    order by f.kickoff_at desc
    limit 1
  ) pf on true
),
scoped_sessions as (
  select
    s.id, s.session_type, s.title, s.starts_at, s.duration_min, s.location,
    s.md_offset, s.planned_rpe, s.planned_load, s.status, s.fixture_id,
    s.requires_wellness, s.requires_rpe, s.requires_nutrition,
    (s.starts_at at time zone b.timezone)::date as day
  from sessions s
  cross join bounds b
  where s.org_id     = auth_org_id()
    and s.deleted_at is null
    and s.starts_at >= b.from_ts
    and s.starts_at <  b.to_ts
    and (cardinality(:types::session_type[]) = 0 or s.session_type = any(:types))
    and (
      cardinality(:group_ids::uuid[]) = 0
      -- A session with no participant rows is a whole-squad session and always shows.
      or not exists (select 1 from session_participants sp where sp.session_id = s.id)
      or exists (
        select 1
        from session_participants sp
        where sp.session_id = s.id
          and (
            sp.group_id = any(:group_ids)
            or (
              sp.athlete_id is not null
              and exists (
                select 1 from group_memberships gm
                where gm.athlete_id = sp.athlete_id
                  and gm.group_id   = any(:group_ids)
                  -- membership as at the session date, because the table is historical
                  and gm.added_at  <= s.starts_at
                  and (gm.removed_at is null or gm.removed_at > s.starts_at)
              )
            )
          )
      )
    )
),
participant_counts as (
  select
    ss.id as session_id,
    count(distinct a.id)                                     as athlete_count,
    min(g.name) filter (where g.id is not null)              as sole_group_name,
    count(distinct g.id)                                     as group_count,
    count(*) filter (where sp.athlete_id is not null)        as individual_count
  from scoped_sessions ss
  left join session_participants sp on sp.session_id = ss.id
  left join groups g on g.id = sp.group_id and g.deleted_at is null
  left join group_memberships gm
    on gm.group_id  = sp.group_id
   and gm.added_at <= ss.starts_at
   and (gm.removed_at is null or gm.removed_at > ss.starts_at)
  left join athletes a
    on a.id = coalesce(sp.athlete_id, gm.athlete_id)
   and a.deleted_at is null
   and a.status <> 'left_club'
  group by ss.id
),
week_fixtures as (
  select
    f.id, f.opponent, f.kickoff_at, f.venue, f.home_away, f.competition,
    f.importance, f.status, f.result,
    (f.kickoff_at at time zone b.timezone)::date as day
  from fixtures f
  cross join bounds b
  where f.org_id = auth_org_id()
    and f.deleted_at is null
    and f.kickoff_at >= b.from_ts
    and f.kickoff_at <  b.to_ts
),
day_load as (
  select day,
         sum(planned_load) filter (where status <> 'cancelled') as planned_load_total,
         bool_or(requires_wellness)  as any_wellness,
         bool_or(requires_rpe)       as any_rpe,
         bool_or(requires_nutrition) as any_nutrition
  from scoped_sessions
  group by day
)
select
  dl.day,
  dl.md_forward,
  dl.md_back,
  dl.next_fixture_id,
  coalesce(dload.planned_load_total, 0) as planned_load_total,
  coalesce(dload.any_wellness,  false)  as any_wellness,
  coalesce(dload.any_rpe,       false)  as any_rpe,
  coalesce(dload.any_nutrition, false)  as any_nutrition,
  coalesce(
    (select jsonb_agg(to_jsonb(ss) || jsonb_build_object(
              'athlete_count',   pc.athlete_count,
              'sole_group_name', case when pc.group_count = 1 and pc.individual_count = 0
                                      then pc.sole_group_name end)
            order by ss.starts_at)
     from scoped_sessions ss
     join participant_counts pc on pc.session_id = ss.id
     where ss.day = dl.day), '[]'::jsonb)                as sessions,
  coalesce(
    (select jsonb_agg(to_jsonb(wf) order by wf.kickoff_at)
     from week_fixtures wf where wf.day = dl.day), '[]'::jsonb) as fixtures
from day_labels dl
left join day_load dload on dload.day = dl.day
order by dl.day;
```

### Supporting queries

**Month view.** The same shape with a 6-week range, but sessions are aggregated rather than
returned in full. Returning 200 session rows to draw 30 dots is waste.

```sql
select
  (s.starts_at at time zone o.timezone)::date as day,
  count(*)                                             as session_count,
  count(*) filter (where s.session_type = 'match')     as fixture_session_count,
  sum(s.planned_load)                                  as planned_load_total
from sessions s cross join (select timezone from organisations where id = auth_org_id()) o
where s.org_id = auth_org_id()
  and s.deleted_at is null
  and s.starts_at >= :from_ts and s.starts_at < :to_ts
group by 1;
```

Flag markers for the month view come from `mv_daily_athlete_summary`, never from a scan of
`flags` joined to entries:

```sql
select flag_date as day, count(*) as open_flag_count
from flags
where org_id = auth_org_id()
  and status in ('raised','notified')
  and flag_date >= :from_date and flag_date < :to_date
group by 1;
```

**Query keys** (`05-architecture.md` §9): `qk.schedule.week(orgId, isoWeek)` exists already.
Add `qk.schedule.month(orgId, isoMonth)` and `qk.schedule.day(orgId, isoDate)` to the factory.
The group filter is part of the key, sorted, per the key factory rules.

### Writes

| Action | Statement | Notes |
|---|---|---|
| Create session | `insert into sessions (...)` | `md_offset` is computed server-side by a `before insert` trigger from the fixture set, never sent by the client. `planned_load` computed from `planned_rpe * duration_min` in the same trigger. |
| Add participants | `insert into session_participants` | One row per group or per athlete. The check constraint enforces exactly one of the two. |
| Edit session | `update sessions set ... where id = :id` | Sessions are staff-owned and mutable. This is not an entry table: `CLAUDE.md` §2 rule 6 applies to athlete entries, not to the plan. |
| Move session | `update sessions set starts_at = :new` | Trigger recomputes `md_offset` **only when `starts_at` is in the future**. See Edge cases. |
| Cancel session | `update sessions set status = 'cancelled'` | Expectations for that session are waived, not deleted (`04-data-model.md` §11). |
| Delete session | `update sessions set deleted_at = now()` | Soft delete. Permitted only when the session is in the future and has no `session_attendance` and no `training_entries`. Otherwise cancel is the only option. |
| Apply template | Edge Function `apply-week-template` | Transactional. See `md-planner.md`. |

---

## States

| State | Trigger | Rendering |
|---|---|---|
| **Default** | Week loaded with at least one session or fixture | As drawn above |
| **Loading, cold** | No cached week | Skeleton: seven day headers with skeleton MD chips, three skeleton blocks in plausible positions, skeleton load row. Appears after 150 ms, minimum 400 ms (`06-design-system.md` §11.1) |
| **Loading, warm** | Cached week present, refetching | Cached content renders immediately with a 2 px indeterminate bar under the header. Never replaced by a skeleton |
| **Empty, no sessions and no fixtures** | Week returns zero rows, no group filter active | `EmptyState` kind `notStarted`. Title "Nothing scheduled this week." Body "Add a session, or apply a week template." Actions: "Add session", "Apply template" |
| **Empty, filtered out** | Zero rows with a group filter or type filter active | `EmptyState` kind `noResults`. Title names the filter: "No sessions for Forwards this week." Action "Clear filter" |
| **Empty, single day** | A day column with no sessions | Not an empty state. The column renders its MD-n chip, a zero load bar, and a `+` target. A rest day is a plan, not an absence |
| **Error** | Query failed | Header, filters, and view toggle remain usable. Grid area shows "Could not load the schedule. Check your connection and try again." with Retry. Correlation ID behind "Details" |
| **Partial error** | Sessions loaded, flag markers failed | Grid renders. Caption under the header: "Flag markers unavailable." Never a blank grid |
| **Offline, cache present** | No connectivity | Full read-only render from the TanStack Query persisted cache. Persistent offline banner. Caption "Last updated 14:02". Every write affordance disabled with "You are offline. This will be available when you reconnect." (`06-design-system.md` §11.4) |
| **Offline, no cache** | No connectivity, no cached week | `EmptyState` kind `offline` |
| **No current season** | `seasons.is_current` is false for every row | `EmptyState` kind `notStarted`: "No season set up. Sessions need a season." Action "Create season" for coach, `noPermission` copy for medical |
| **Role: medical** | Medical without coach role | Read-only for non-rehab sessions. `+` creates a rehab session only, and the type field is fixed. Non-rehab blocks have no drag handle and show a lock glyph on hover with the tooltip "Training sessions are edited by coaching staff" |
| **Role: coach** | | Full write |
| **Past week** | Week end is before today | Fully readable. Editing a past session is permitted but shows an inline warning: "This session has already happened. Changes will not alter its MD-n label or its recorded compliance." |
| **Applying a template** | Mutation in flight | Affected day columns render at 60% opacity with a progress bar. The rest of the screen stays interactive. On success, a toast with "Undo" for 10 seconds |

---

## Interactions

### Navigation

| Action | Mobile | Web |
|---|---|---|
| Next / previous period | Horizontal swipe on the grid, snapping | `>` and `<` buttons, and `J` / `K` |
| Jump to today | "Today" in the header | "Today" button, and `T` |
| Change view | `DayWeekToggle` | Toggle, and `1` day, `2` week, `3` month |
| Pick a date | Tap the week range label to open a month picker sheet | Click the range label, month picker popover |
| Open a session | Tap the block | Click the block |
| Open a fixture | Tap the fixture banner | Click the fixture banner |
| Day drill-down from month | Tap a day cell, bottom sheet lists that day | Click a day cell, switches to day view |

### Creating a session

Three routes, all landing in the same `SessionEditorSheet`:

1. **FAB or "Add session"**: opens with `starts_at` defaulted to the selected day at the next
   whole hour, or 09:00 for a future day.
2. **Tap or click an empty slot in the time grid**: opens with `starts_at` set to that slot,
   snapped to 15 minutes, and `duration_min` defaulted to 60.
3. **Drag on an empty region of a day column (web only)**: creates a provisional block sized by
   the drag, then opens the editor with `starts_at` and `duration_min` prefilled.

The editor is specified in full in `session-detail.md`. On this screen the relevant behaviour
is:

- The MD-n label for the chosen day is shown read-only in the editor header, so the coach can
  see what they are planning into.
- Saving inserts the session and closes. The new block animates in at `duration.base` and is
  briefly ringed in `accent`.
- Saving with the group filter active does **not** implicitly scope participants to the filtered
  groups. The participant field defaults to "All squad" and the coach chooses. Implicitly
  scoping would create sessions that silently exclude athletes, which is the worst possible
  failure on a scheduling screen. This is deliberate and worth stating to the client (O-352).

### Editing and moving

| Gesture | Behaviour |
|---|---|
| Drag a block vertically (web) | Changes `starts_at` within the same day, snapped to 15 minutes. Live time label follows the drag. |
| Drag a block horizontally (web) | Changes the day, preserving time of day. The destination column's MD-n chip highlights during the drag, so the coach sees they are moving work from MD-3 to MD-2 before they let go. |
| Resize the bottom edge (web) | Changes `duration_min`, snapped to 5 minutes, minimum 5. `planned_load` recomputes live and the day's load bar updates during the drag. |
| Long press then drag (mobile) | Same as web drag. 350 ms press delay so a scroll is never mistaken for a move. Haptic on pick up and on drop. |
| Tap and hold on a block, release without moving | Opens session detail. |
| Right click / long press menu | Edit, Duplicate, Duplicate to next week, Move to..., Cancel session, Delete. |
| `Cmd/Ctrl` + drag (web) | Duplicates rather than moves. |

**Moving a session across a fixture boundary changes its MD-n meaning.** When the drop
destination has a different computed MD-n from the session's current `md_offset`, and the
session is in the future, the move proceeds and the block's MD chip updates. When the session
is in the past, the move is blocked with the message "Past sessions cannot be moved. Their MD-n
label is a record of what happened." Cancel and recreate is the supported path.

**Undo.** Every move, resize, cancel, and template application pushes an entry onto a
screen-local undo stack, surfaced as a toast with "Undo" for 10 seconds and as `Cmd/Ctrl+Z` on
web for the last 10 actions in the session. Undo issues a compensating update, it does not
restore a snapshot. Once the toast expires and the stack is cleared on navigation, the coach
edits back by hand.

### Applying a week template

1. "Apply template" in the week header, or the day header overflow menu for a single day.
2. `TemplatePickerSheet` lists `week_templates` for the organisation with a one-line summary of
   each: number of sessions, total planned load, and which MD-n positions it covers.
3. Selecting one shows a **preview** of the resulting week side by side with the current week:
   sessions to be added in `accent` tint, existing sessions that would collide in
   `severity.medium` tint.
4. A conflict strategy is chosen explicitly, never defaulted silently:

   | Strategy | Behaviour |
   |---|---|
   | Add alongside | Existing sessions untouched. Template sessions inserted. |
   | Replace planned | Existing sessions with `status = 'planned'` and no attendance and no entries are soft-deleted, then template sessions inserted. |
   | Fill gaps only | Template sessions inserted only on days that currently have no sessions. |

   `Replace planned` never touches a session that has attendance rows, training entries, or gym
   logs against it. Those are reported in the preview as "3 sessions kept, they already have
   data".
5. Confirm through a `ConfirmSheet` stating the counts: "Add 9 sessions, remove 4 planned
   sessions. This applies to Mon 3 Aug to Sun 9 Aug."
6. The mutation runs in one Edge Function call and is transactional. Full behaviour in
   `md-planner.md`.

### Filtering

- **Group filter**: global, multi-select, persists. Applies as specified in the query above. The
  header always states the active filter, per §6.7.
- **Type filter**: local to this screen, not persisted across sessions, exposed as a row of
  toggle chips in the overflow menu: Training, Gym, Match, Testing, Recovery, Meeting, Rehab.
- **Athlete overlay**: when arrived at with `?athlete=`, a dismissible chip reads "Showing
  Ellis Marsh only". This is separate from the group filter and clearing it does not clear the
  group filter.
- Filters never navigate and never discard an open editor.

### Other

| Action | Result |
|---|---|
| Tap the MD-n chip | Popover explaining the label: "MD-4. Four days before Ashford RFC, Sat 8 Aug 15:00." With "Open fixture". |
| Tap the day planned load figure | Popover listing the contributing sessions and their loads. |
| Tap "Open in MD-n planner" | Navigates to `md-planner.md` with this week loaded. |
| Tap the participant count on a block | Popover listing athletes with `AvailabilityPill`, grouped by availability. Unavailable athletes listed first. |
| Pull to refresh (mobile) | Invalidates the week query. |
| Print (web) | `Cmd/Ctrl+P` renders a print stylesheet: week grid, one page landscape, no interactive affordances, MD-n labels retained, greyscale-safe per §4.2. Clubs pin this on a wall. |

---

## Validation rules

Applied client-side for immediate feedback and re-applied server-side. Client-side validation is
UX, never authorisation (`CLAUDE.md` §2 rule 2).

| Rule | Enforcement | Message |
|---|---|---|
| `title` is required, 1 to 120 characters | Zod + `not null` | "Give the session a title." |
| `session_type` is required | Zod + enum | |
| `starts_at` is required | Zod | |
| `starts_at` must fall inside the current season's `starts_on` to `ends_on` | Server check against `seasons` | "That date is outside the 2026/27 season." Offer "Change season". |
| `duration_min` between 5 and 480 | Zod + check constraint | "Duration must be between 5 and 480 minutes." |
| `planned_rpe` between 1.0 and 10.0, one decimal | Zod + check constraint | "Planned RPE is on the 1 to 10 Borg scale." |
| `planned_load` is derived | Trigger | Not user-editable in v1. Editing it independently is O-353. |
| At least one participant, or explicitly "All squad" | Client | "Choose who this session is for." Zero participant rows is a valid state and means all squad, so the editor makes that an explicit choice rather than a default of silence. |
| A session may not be created in the past by more than 14 days | Server | "Sessions cannot be backdated more than 14 days." Matches the entry backdating limit in `05-architecture.md` §6. |
| Overlapping sessions for the same athlete are permitted, with a warning | Client warning only | "3 athletes are already in another session at this time." Gym and pitch sessions genuinely overlap in some clubs, so this warns and does not block. |
| A `match` session must be linked to a fixture | Server | "A match session needs a fixture." The editor offers to create one. |
| A non-match session may not have `session_type = 'match'` while `fixture_id` is null | Check constraint | |
| Cancelling requires no confirmation text, deleting does | Client | Delete uses `ConfirmSheet` with `tone: 'destructive'`. |
| A session with attendance or entries cannot be deleted | Server, 409 | "This session has recorded data. Cancel it instead." |
| Template application requires a week with a resolvable MD-n mapping | Server | See `md-planner.md` for the no-fixture and two-fixture cases. |
| `requires_nutrition` (dead, always false, see `04-data-model.md` §4) defaults from the week template, not from a global default | Server | Silent global defaults produce compliance expectations nobody asked for. |

---

## Edge cases

| Case | Behaviour |
|---|---|
| **Two fixtures in one week** | Every day between them carries both labels: `MD+1` from the first and `MD-2` from the second, primary being the forward-looking one. The week header adds a chip "2 fixtures". The load row is unchanged. `md-planner.md` handles template application for this week. |
| **No fixture scheduled** | Days fall back to training-week labels `D1` to `D7` (labelling rule 6). The week header reads "No fixture this week". Template application requires an explicit anchor choice, see `md-planner.md`. |
| **Fixture postponed** | The fixture stops anchoring immediately. Day labels for **future** days recompute on the next read. `sessions.md_offset` recomputes for future sessions only, by the trigger on `fixtures` plus the nightly `recompute_md_offsets` job. Past sessions keep their original label. Where a past session's stored `md_offset` differs from what the current fixture set would produce, the block shows the stored label with a small history glyph and the tooltip "Planned as MD-3 against a fixture that was postponed." This is the whole reason `md_offset` is a stored column (`04-data-model.md` §4). |
| **Fixture moved by a few hours within the same day** | No MD-n change. Sessions unaffected. Only the fixture banner time updates. |
| **Fixture moved to a different day** | Same recompute path as postponement. The affected weeks are invalidated in the query cache by the realtime `org:{org_id}:schedule` broadcast. |
| **Session already played, then the fixture moves** | The session keeps its stored `md_offset`. The day it sits on gets a new computed label. The block therefore shows a different MD-n from its column header, which is correct, and the divergence glyph explains it. |
| **Daylight saving transition** | All boundaries are computed with `at time zone org.timezone`, so the spring-forward day is 23 hours and the autumn day is 25. The day view time grid renders the missing hour as a hatched band labelled "Clocks go forward" and the repeated hour once, with both offsets in the tooltip. A session scheduled into the non-existent hour is rejected at save with "That time does not exist on this date." |
| **Session crossing midnight** | Permitted (a late fixture plus travel, an overnight camp). The block renders in the starting day's column, clipped at the column foot with a downward chevron, and a ghost block in the next day's column marked "continues from Fri 7 Aug". It counts towards the starting day's planned load only. |
| **Session outside the 07:00 to 21:00 grid** | The grid extends for that week. On mobile the day view scrolls to the earliest session on open. |
| **Very short session (5 to 20 minutes)** | Block renders at a 22 px minimum height with title only, and the time and type move into the tooltip. |
| **Many overlapping sessions in one day** | Blocks share the column width, up to four side by side. Beyond four, the fourth becomes "+3 more" which opens a day list. |
| **Athlete belongs to two selected groups** | Counted once. `count(distinct a.id)`. |
| **Group emptied of all members** | The session still shows, with the participant count `0` rendered as a real zero, not as missing (§5.4), and a `severity.medium` chip "No athletes". |
| **Athlete removed from a group after a session was created** | Historical membership is respected: the count for a past session uses membership as at that date. A future session's count uses current membership. This is exactly what `group_memberships.removed_at` exists for. |
| **Athlete left the club** | Excluded from counts (`athletes.status <> 'left_club'`), retained in the session's attendance history. |
| **Season boundary inside the visible week** | Days outside the current season render at 60% opacity with the caption "Outside 2026/27". Sessions there still render if they exist. |
| **No current season** | See States. |
| **Two coaches editing the same week** | Last write wins, per `03-flows.md` §10 for staff-owned data. A realtime broadcast on `org:{org_id}:schedule` invalidates the week query, so the second coach sees the change within a few seconds. If a save lands on a session updated since load, the API returns 409 and the client shows "This session was changed by someone else. Reload to see the current version." No silent overwrite. |
| **Template applied twice to the same week** | The second application is not idempotent and would duplicate sessions. The preview detects sessions matching the template signature and defaults the strategy to `Fill gaps only`, with the warning "This template appears to have been applied already." |
| **Week with 40 sessions** | The grid renders all of them. Above 60 sessions in a week the client falls back to the day view with a caption explaining why, because a seven-column grid at that density is unreadable. |
| **Offline for longer than the cache** | `gcTime` for the schedule is 24 hours (`05-architecture.md` §9). Beyond that, `EmptyState` kind `offline`. |
| **Athlete-facing consequence of a cancellation** | Cancelling a session broadcasts on `org:{org_id}:schedule`, which the athlete Today tab consumes. This is the case that stops 40 athletes travelling to a cancelled session, so it must not be deferred to a poll. |

---

## Performance notes

Budget: this screen must reach first meaningful paint within the 1.5 s p95 dashboard budget in
`05-architecture.md` §11, and the week query must return within 400 ms p95 server time.

1. **One query per week, not one per day.** The query above returns seven days in one round
   trip. Seven queries would be seven RLS evaluations and seven latency units.
2. **Index coverage.** `sessions (org_id, starts_at)` and `fixtures (org_id, kickoff_at)`
   already exist (`04-data-model.md` §15). The lateral fixture lookups are two index scans per
   day, 14 per week, all covered. Add `create index on session_participants (session_id)` if it
   is not already implied by the foreign key, because the participant count subquery joins on it
   seven to twenty times per week.
3. **The fixture lateral joins are the risk.** Fourteen correlated subqueries per week is fine
   at a season's worth of fixtures (roughly 40 rows) and would not be fine at thousands. If the
   plan degrades, materialise day labels into a `mv_schedule_day_labels` view keyed by
   `(org_id, day)`, refreshed by the same job that recomputes `md_offset`. Do not do this
   speculatively.
4. **Prefetch adjacent weeks.** On idle, prefetch `week - 1` and `week + 1` so paging is
   instant. Cancel on navigation away.
5. **Month view aggregates server-side.** Never fetch full session rows for six weeks to draw
   dots.
6. **Virtualise nothing in week view.** Seven columns and typically under 25 blocks does not
   need virtualisation, and virtualising an absolutely positioned time grid breaks drag.
7. **Drag is local.** Drag updates local state only. One `update` fires on drop, with an
   optimistic cache update and a rollback on failure. Firing an update per pointer move would
   generate hundreds of writes per gesture.
8. **`staleTime` 5 minutes, `gcTime` 24 hours** for schedule queries, per §9 of the architecture
   document. Realtime invalidation covers the gap.
9. **The load bar is computed in the query**, not in the client from the session list, so the
   number does not change when the client filters. Where the group filter is active the load
   figure is the filtered load and the caption says so: "Forwards only".
10. **Print stylesheet renders from the same data**, no second query.

---

## Accessibility

Target WCAG 2.2 AA (`06-design-system.md` §10).

**Structure and semantics**

- The web week grid is a `role="grid"` with `role="columnheader"` day headers and
  `role="gridcell"` slots. Session blocks are `role="button"` inside their cell with an
  `aria-describedby` pointing at the day header, so a screen reader announces the day.
- The mobile week view is a list of `region`s, one per day, each with an `aria-label` of
  "Monday 3 August, MD-5, 1 session, planned load 135".
- Heading order: screen title, week range, day headers. No level is skipped.

**Labels**

| Element | Announced as |
|---|---|
| Session block | "Lower body, gym, 08:00 to 09:00, MD-4, Forwards, 12 athletes, planned RPE 8, planned load 480" |
| Fixture banner | "Fixture. Ashford RFC, home, 15:00, League, key fixture, scheduled. 23 named, 2 unavailable" |
| MD chip, single | "MD minus 4. Four days before the fixture on Saturday 8 August" |
| MD chip, dual | "MD plus 1 and MD minus 6. One day after Saturday's fixture, six days before next Saturday's" |
| MD chip, no fixture | "Training week day 3. No fixture scheduled" |
| Load bar | "Planned load 1200. Highest day this week" |
| Required entries | "Wellness required, RPE required, nutrition not required" |
| Empty day | "Thursday 6 August, MD-2, nothing scheduled" |

**Keyboard, web**

| Key | Action |
|---|---|
| `Tab` | Moves between the header controls, then into the grid as a single stop |
| Arrow keys | Move the grid cursor between days and time slots |
| `Enter` | Open the focused session, or create one in the focused empty slot |
| `Space` | Pick up the focused session for keyboard move; arrows then move it; `Enter` drops; `Esc` cancels |
| `Shift` + arrows | Resize the focused session by 15 minutes |
| `T` | Today. `J` / `K` next and previous period. `1` / `2` / `3` view |
| `/` | Focus the type filter |
| `Esc` | Close any sheet or popover, cancel a drag |

Keyboard move and resize exist because drag and drop with a mouse is not an accessible
interaction and it is the primary editing gesture on this screen. A keyboard path is mandatory,
not optional.

**Other**

- Every drag operation announces its result in an `aria-live="polite"` region: "Moved
  Conditioning to Wednesday 5 August, 18:00. Now MD-3."
- Session type is carried by a glyph and a text label, never by block colour alone (§4.1).
- Cancelled sessions carry the word "Cancelled" as well as strikethrough.
- Touch targets 48 px minimum. A 22 px session block expands its hit area with padding.
- Dynamic type to 200%: day columns keep seven abreast on web and the block content degrades
  to title only; on mobile the day sections simply grow taller.
- Reduced motion: no block draw-in, no shimmer, drag follows the pointer with no spring.
- Colour is never the only channel for fixture importance: `key` and `cup_final` carry a filled
  marker and the word.

---

## Open questions

- **O-349** Medical write scope on the schedule. `01-roles-and-permissions.md` §2 grants
  medical staff `Create/edit schedule and sessions`, which taken literally lets a physio move
  Tuesday's conditioning session. I have assumed medical staff get full read, write on `rehab`
  sessions, and the ability to remove a restricted athlete from any session's participants, and
  nothing else. Confirm, because it changes the RLS policy on `sessions` as well as this screen.
- **O-350** Mobile week view shape. I have specified a vertical list of day sections rather than
  a seven-column grid, because seven columns at 390 pt gives 50 pt per day. If your designs show
  a true seven-column mobile week, say so now: it changes the component and the drag model.
- **O-351** MD-n horizon and the MD+n window. I label MD-n only within 9 days of the next
  fixture, and show a secondary MD+n only within 3 days of the previous one. Both numbers are
  my judgement, not yours. What does a coach in your target market actually use?
- **O-352** Should creating a session while a group filter is active default the participants to
  that group? I have said no, because a filter is a view and silently scoping a write to a view
  creates sessions that exclude athletes without anyone noticing. The counter-argument is that
  it saves a tap on the most common action in the product. I can be persuaded.
- **O-353** Should `planned_load` be independently editable, or always derived from
  `planned_rpe * duration_min`? Derived is cleaner and matches the schema comment. Some coaches
  will want to type a load target directly for a session with no meaningful RPE, such as a
  travel day or a skills session.
- **O-354** Training-week fallback labels. With no fixture I label days `D1` to `D7` from the
  organisation's week start. Alternatives are naming the microcycle position, using nothing at
  all, or letting a club define its own labels. What do your clubs call these days?
- **O-355** Does the schedule need a "publish" step? Currently every edit is immediately visible
  to athletes through the Today tab. A draft mode where a coach plans a week and releases it in
  one go is a real request from clubs that plan a fortnight ahead. It is a `sessions.published_at`
  column and a filter on the athlete side, so it is cheap now and expensive later.
- **O-356** Print output. I have assumed one landscape page per week, greyscale-safe, pinned in
  the changing room. Does the club also need a per-group print, or a fortnight view?

---

## Related documents

- One session in detail → `session-detail.md`
- One fixture in detail, and what moving it does → `fixture-detail.md`
- Building and applying week templates → `md-planner.md`
- Athlete-facing view of the same data → `today.md`
- Staff daily timetable card → `timetable.md`
- Schema → `04-data-model.md` §4
- MD-n rules → `03-flows.md` §8
- Components and tokens → `06-design-system.md`
