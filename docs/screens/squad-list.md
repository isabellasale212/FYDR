# Screen: Squad list

> **Layout status**: provisional. Awaiting client design photographs.

Screen 19 in the inventory (`02-information-architecture.md` §5). File: `docs/screens/squad-list.md`.

---

## Purpose

The roster. Every athlete in the organisation, with the three facts a staff member needs before
deciding whether to look closer:

1. **Availability**: can they train, and with what restrictions.
2. **Compliance**: have they submitted what was expected of them.
3. **Readiness**: a single headline number, with its direction against that athlete's own
   baseline.

It is the directory of the product and the launch point for every athlete-level action. It is
also where bulk work happens: adding fifteen athletes to a group, assigning a programme to a
squad section, chasing eight missing wellness entries.

It is deliberately **not** the exceptions screen. That is the staff dashboard
(`dashboard.md`), which answers "who needs attention this morning" in under 15 seconds. The
squad list answers "show me everyone, sorted how I want". Both exist because they answer
different questions, and conflating them produces a dashboard nobody can scan.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full read of every athlete in the organisation. Bulk actions: group membership, programme assignment, session assignment, reminders, export. |
| Medical / Physio | Same read. Additionally may set availability in bulk, which no other role can (`01-roles-and-permissions.md` §4). May not assign gym programmes. |
| Admin | No access to this screen. An admin sees squad structure through `user-management.md` and `groups.md`, without wellness, nutrition, gym, or readiness data. This is the deliberate friction described in `01-roles-and-permissions.md` §1. |
| Athlete | No access. |

Column-level rules:

- The readiness column, the compliance column, and every domain metric are staff-only. They do
  not render for an admin under any circumstance, and the query does not return them, because
  RLS excludes them rather than the client hiding them.
- Availability shows status, reason category, restrictions, and expected return. It never shows
  diagnosis, mechanism, or clinical notes (`CLAUDE.md` §2 rule 3).
- Group membership is visible to all staff roles.

---

## Entry points

| From | Route | Notes |
|---|---|---|
| Staff tab bar, Squad | `(staff)/squad` | Default landing for the tab. |
| Web sidebar, Squad | `/squad` | |
| Dashboard, squad status card, "View all" | `/squad?sort=readiness&dir=asc` | Worst readiness first. |
| Dashboard, compliance card, "See who is missing" | `/squad?filter=compliance_missing&date={today}` | |
| Groups screen, a group row, "View athletes" | `/squad` with the group filter set to that group | Sets the **global** group filter, so it persists. |
| Injury dashboard, "All athletes" | `/squad?filter=availability_not_available` | |
| Search from anywhere (web `Cmd+K`) | `/squad/athlete/{id}` | Straight to the profile. |
| Session detail, participant list, "Manage squad" | `/squad` | |

Route parameters: `sort`, `dir`, `filter`, `q` (search), `view`. All are shareable. The group
filter is global state and is deliberately not a route parameter.

---

## Layout

### Mobile

```
+------------------------------------------------------+
| Squad                                    [ ... ]      |
| [Forwards v]                          24 athletes     |
+------------------------------------------------------+
| [ Search athletes                            ]        |
| [Sort: Readiness v]  [Filters 2]        [Select]      |
+------------------------------------------------------+
| Showing Forwards only                      [Clear]    |
+------------------------------------------------------+
|  (o) 4  Ellis Marsh                                   |
|      Prop  Available                          72      |
|      W R N  3 of 3           readiness  v -8   ~~^~   |
+------------------------------------------------------+
|  (o) 7  Ryan Doherty                                  |
|      Hooker  Modified: no contact             61      |
|      W R -   2 of 3          readiness  v -14  ~^~~   |
|      (!) 1 high flag                                  |
+------------------------------------------------------+
|  (o) 12 Tom Reeve                                     |
|      Lock  Unavailable  Return 15 Aug          -      |
|      - - -  0 of 3           no entry today           |
+------------------------------------------------------+
|  (o) 9  Sam Okoye                                     |
|      Scrum half  Available                    88      |
|      W R N  3 of 3           readiness  ^ +3   ~~~^   |
+------------------------------------------------------+
|  ...                                                  |
+------------------------------------------------------+
|                                          ( + )        |  add athlete
+------------------------------------------------------+
```

Selection mode:

```
+------------------------------------------------------+
| 6 selected                              [Cancel]      |
+------------------------------------------------------+
| [x] 4  Ellis Marsh        Prop      Available         |
| [x] 7  Ryan Doherty       Hooker    Modified          |
| [ ] 12 Tom Reeve          Lock      Unavailable       |
| ...                                                   |
+------------------------------------------------------+
| [ Add to group ] [ Assign programme ] [ More ... ]    |  pinned action bar
+------------------------------------------------------+
```

### Web

Table at `dense` density, 36 px rows with 44 px hit targets (`06-design-system.md` §1.3).

```
+----------------------------------------------------------------------------------------+
| Squad                    [All squad v]  [Last 7 days v]           [Export]  [+ Athlete] |
+----------------------------------------------------------------------------------------+
| [ Search name or number         ]   [Availability v] [Group v] [Position v] [Flags v]   |
| 24 of 31 athletes    Showing Forwards only                                    [Clear]   |
+----------------------------------------------------------------------------------------+
| [ ] | # | Athlete        | Position | Availability      | Groups      | Compliance | Readiness | 7d  | Flags |
+-----+---+----------------+----------+-------------------+-------------+------------+-----------+-----+-------+
| [ ] | 4 | Ellis Marsh    | Prop     | (o) Available     | Fwd, S&C A  | 3 of 3     |     72 v-8| ~~^~|       |
| [ ] | 7 | Ryan Doherty   | Hooker   | (-) Modified      | Fwd         | 2 of 3     |    61 v-14| ~^~~| (!)1  |
|     |   |                |          | no contact        |             |            |           |     |       |
| [ ] |12 | Tom Reeve      | Lock     | (x) Unavailable   | Fwd, Rehab  | waived     |         - |  -  |       |
|     |   |                |          | Return 15 Aug     |             |            | no entry  |     |       |
| [ ] | 9 | Sam Okoye      | Scrum h  | (o) Available     | Backs       | 3 of 3     |     88 ^+3| ~~~^|       |
| ... |   |                |          |                   |             |            |           |     |       |
+----------------------------------------------------------------------------------------+
| 24 athletes. 19 available, 3 modified, 2 unavailable.                                   |
| Compliance 78%, 3 to 9 August, wellness and RPE. 2 athletes waived.                     |
+----------------------------------------------------------------------------------------+
```

Column set at `xl`, in order: selection checkbox, squad number, athlete (avatar, name), position,
availability, groups, compliance, readiness, 7-day sparkline, flags. Below `lg` the sparkline and
groups columns drop first, then position. Column visibility is user-configurable and persisted
per user, which is O-371.

### Card view

A view toggle offers a card grid on web at `xxl` and on tablet, using `AthleteCard` at
`comfortable` density, three or four across. Useful for clubs that recognise faces faster than
names. Table is the default.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | The global group filter. Mandatory (`CLAUDE.md` §3). |
| `PeriodSelector` | §6.8 | Drives the compliance and readiness window. Default `last7`. |
| `AthleteCard` | §6.1 | Mobile rows and the card view. |
| `SquadTable` | **New** | Dense web table with sticky header, column configuration, and row selection. |
| `AvailabilityPill` | §6.5 | Availability cell. `md` size shows the reason category on a second line. |
| `ComplianceRing` | §6.6 | Compliance cell at size 24, centre `fraction`. |
| `MetricTile` | §6.2 | Not used in rows. Used in the summary footer. |
| `TrendSparkline` | §6.3 | The 7-day readiness column. Nulls are gaps, never zeros. |
| `FlagBadge` | §6.4 | Flags column. Renders nothing at all when the count is zero. |
| `GroupChip` | **New**, shared with `groups.md` | Group membership chips in the group's colour. Two plus a count. |
| `SearchField` | **New** | Debounced search over name and squad number. |
| `FilterBar` | **New** | Availability, group, position, flag, compliance filters. Multi-select each. |
| `BulkActionBar` | **New** | Pinned bar in selection mode. Actions are role-filtered. |
| `EmptyState` | §6.16 | No athletes, no results after filtering, offline. |
| `ConfirmSheet` | §6.18 | Destructive bulk actions. |
| `BottomSheet` | §6.19 | Mobile filter sheet, sort sheet, bulk action sheets. |

---

## Data requirements

### Fields

| Field | Source | Transformation |
|---|---|---|
| Athlete id | `athletes.id` | |
| Name | `athletes.first_name`, `last_name` | Display "First Last". Sort by `last_name, first_name`. |
| Squad number | `athletes.squad_number` | Null renders the not-applicable glyph, never 0. |
| Position | `athletes.position` | Free text in v1. |
| Photo | out of scope until O-36 is answered | Initials fallback. |
| Status | `athletes.status` | `active` \| `injured_long_term` \| `left_club`. `left_club` excluded by default, available behind a filter. |
| Has account | `athletes.user_id is not null` | Chip "No app account" when null. This is expected and normal (`04-data-model.md` §3), not an error. |
| Availability status | `availability.status`, latest row with `effective_to is null` | |
| Availability reason | `availability.reason_category` | Category only. Never a diagnosis. |
| Restrictions | `availability.restrictions` | First restriction plus a count. |
| Expected return | `injuries.expected_return` via `availability.injury_id` | "Return 15 Aug". |
| Groups | `group_memberships` where `removed_at is null` joined to `groups` | Current membership only on this screen. Historical membership is a `groups.md` concern. |
| Compliance completed | `mv_compliance_rates` | Count of expectations met in the selected window. |
| Compliance expected | `compliance_expectations` where `is_required` | Denominator. Waived expectations are excluded from the denominator, not counted as failures (`04-data-model.md` §11). |
| Compliance state | derived | `complete` \| `partial` \| `missing` \| `waived` \| `pending`, per §4.3. |
| Readiness | `wellness_entries.readiness_score`, latest non-superseded entry for today | 0 to 100, 0 decimals. |
| Readiness delta | `mv_wellness_baselines` | Difference from the athlete's own 28-day rolling mean. Rendered with `resolveValence` and `direction: 'higherIsBetter'`. |
| Readiness sparkline | `mv_daily_athlete_summary` | 7 daily points, nulls preserved as gaps. |
| Open flags | `flags` where `status in ('raised','notified')` | Count and highest severity. |
| Last seen | `users.last_seen_at` | Behind a column toggle. Useful for chasing an athlete who has stopped opening the app. |

### The primary query

Reads from materialised views, never from raw entry tables. A squad list that scans
`wellness_entries` for 40 athletes across 7 days will be slow within one season, and
`05-architecture.md` §9 states that any dashboard query scanning raw entry tables for more than
one athlete is a bug.

```sql
-- Squad list.
-- :group_ids   uuid[]  empty = all squad
-- :from_date   date    window start (period selector)
-- :to_date     date    window end, inclusive
-- :today       date    organisation-local today
-- :include_left boolean default false

with base as (
  select a.id, a.first_name, a.last_name, a.squad_number, a.position,
         a.status, a.user_id
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and (:include_left or a.status <> 'left_club')
    and (
      cardinality(:group_ids::uuid[]) = 0
      or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id
          and gm.group_id = any(:group_ids)
          and gm.removed_at is null
      )
    )
),
avail as (
  select distinct on (av.athlete_id)
         av.athlete_id, av.status, av.reason_category, av.restrictions,
         av.injury_id, av.effective_from
  from availability av
  join base b on b.id = av.athlete_id
  where av.org_id = auth_org_id()
    and av.effective_to is null
  order by av.athlete_id, av.effective_from desc
),
groups_agg as (
  select gm.athlete_id,
         jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'colour', g.colour)
                   order by g.sort_order, g.name) as groups
  from group_memberships gm
  join groups g on g.id = gm.group_id and g.deleted_at is null
  join base b   on b.id = gm.athlete_id
  where gm.removed_at is null
  group by gm.athlete_id
),
compliance as (
  select cr.athlete_id,
         sum(cr.completed)                    as completed,
         sum(cr.expected)                     as expected,
         sum(cr.waived)                       as waived
  from mv_compliance_rates cr
  join base b on b.id = cr.athlete_id
  where cr.org_id = auth_org_id()
    and cr.day between :from_date and :to_date
  group by cr.athlete_id
),
readiness_today as (
  select ds.athlete_id, ds.readiness_score, ds.wellness_submitted_at
  from mv_daily_athlete_summary ds
  join base b on b.id = ds.athlete_id
  where ds.org_id = auth_org_id() and ds.day = :today
),
baseline as (
  select wb.athlete_id, wb.mean_value, wb.sd_value
  from mv_wellness_baselines wb
  join base b on b.id = wb.athlete_id
  where wb.org_id = auth_org_id() and wb.metric = 'readiness_score'
),
spark as (
  select ds.athlete_id,
         jsonb_agg(jsonb_build_object('date', ds.day, 'value', ds.readiness_score)
                   order by ds.day) as points
  from mv_daily_athlete_summary ds
  join base b on b.id = ds.athlete_id
  where ds.org_id = auth_org_id()
    and ds.day between :today - 6 and :today
  group by ds.athlete_id
),
flag_agg as (
  select f.athlete_id,
         count(*) as open_count,
         max(case f.severity when 'high' then 3 when 'medium' then 2 else 1 end) as top_severity_rank
  from flags f
  join base b on b.id = f.athlete_id
  where f.org_id = auth_org_id()
    and f.status in ('raised','notified')
  group by f.athlete_id
)
select
  b.id, b.first_name, b.last_name, b.squad_number, b.position, b.status,
  (b.user_id is not null)                       as has_account,
  coalesce(av.status, 'available')               as availability_status,
  av.reason_category,
  av.restrictions,
  i.expected_return,
  coalesce(ga.groups, '[]'::jsonb)               as groups,
  c.completed, c.expected, c.waived,
  rt.readiness_score,
  (rt.readiness_score - bl.mean_value)           as readiness_delta,
  bl.mean_value                                  as readiness_baseline,
  sp.points                                      as readiness_points,
  coalesce(fa.open_count, 0)                     as open_flag_count,
  fa.top_severity_rank
from base b
left join avail       av on av.athlete_id = b.id
left join injuries    i  on i.id = av.injury_id
left join groups_agg  ga on ga.athlete_id = b.id
left join compliance  c  on c.athlete_id = b.id
left join readiness_today rt on rt.athlete_id = b.id
left join baseline    bl on bl.athlete_id = b.id
left join spark       sp on sp.athlete_id = b.id
left join flag_agg    fa on fa.athlete_id = b.id
order by b.last_name, b.first_name;
```

Sorting is applied server-side by rewriting the final `order by` from the `sort` parameter, with
a whitelist. Client-side sorting of a paginated list produces a list sorted within the page only,
which is worse than not sorting.

| `sort` value | `order by` | Nulls |
|---|---|---|
| `name` | `b.last_name, b.first_name` | n/a |
| `number` | `b.squad_number` | last |
| `position` | `b.position, b.last_name` | last |
| `availability` | `case availability_status when 'unavailable' then 0 when 'modified' then 1 else 2 end, b.last_name` | n/a |
| `compliance` | `(c.completed::numeric / nullif(c.expected,0))` | last, because "no expectations" is not "worst compliance" |
| `readiness` | `rt.readiness_score` | last for ascending, so athletes with no entry do not masquerade as the worst readiness in the squad |
| `readiness_delta` | `readiness_delta` | last |
| `flags` | `fa.top_severity_rank desc, fa.open_count desc` | last |
| `last_seen` | `u.last_seen_at` | last |

**Null handling in sorts is a correctness requirement, not a preference.** An athlete who
submitted nothing has no readiness score. Sorting ascending and putting them at the top with an
implied 0 tells the coach the wrong three people to talk to. Missing is not zero
(`06-design-system.md` §1.6).

### Search

Debounced at 250 ms, minimum 2 characters, matched server-side:

```sql
and (
  :q = ''
  or a.first_name   ilike '%' || :q || '%'
  or a.last_name    ilike '%' || :q || '%'
  or (a.first_name || ' ' || a.last_name) ilike '%' || :q || '%'
  or a.squad_number::text = :q
)
```

A trigram index supports it at squad scale and beyond:

```sql
create extension if not exists pg_trgm;
create index on athletes using gin ((first_name || ' ' || last_name) gin_trgm_ops);
```

Search is scoped by the group filter like everything else. Searching for an athlete not in the
active group returns nothing, and the empty state says so explicitly with a "Search all squad"
action. This is the most common cause of "the app has lost a player".

### Writes: bulk actions

| Action | Statement | Role |
|---|---|---|
| Add to group | `insert into group_memberships (org_id, group_id, athlete_id)` per athlete, skipping existing live rows | Coach, medical, admin |
| Remove from group | `update group_memberships set removed_at = now() where removed_at is null` | Coach, medical, admin |
| Assign programme | `insert into programme_assignments` per athlete | Coach (gym, conditioning), medical (rehab) |
| Add to a session | `insert into session_participants` per athlete, with restriction checking per `session-detail.md` | Coach |
| Set availability | `insert into availability` per athlete, and `update` the previous row's `effective_to` | Medical (any reason, including injury-linked); coach (non-injury reason only — illness, personal, academic, representative, other. ADR-008, migration 0041) |
| Send reminder | Enqueue notifications, subject to the budget rules in `08-notifications.md` §1 | Coach, medical |
| Waive expectations | `update compliance_expectations set is_required = false, waived_reason = :reason` | Coach, medical |
| Export selection | `report_runs` via the export pipeline, audited | Coach, medical, admin |
| Mark as left the club | `update athletes set status = 'left_club', left_at = :date` | Admin only, and never a hard delete (`CLAUDE.md` §2 rule 4) |

Every bulk action runs in **one RPC per action, not one request per athlete**, is transactional,
returns per-athlete results, and reports partial success honestly: "Added 14 of 15. Ryan Doherty
was already in Forwards."

---

## States

| State | Rendering |
|---|---|
| **Default** | Table or list as drawn. Summary footer always present. |
| **Loading, cold** | 10 skeleton rows at the final row height. No layout shift. |
| **Loading, warm** | Cached rows render immediately, 2 px refresh bar under the header. |
| **Empty, no athletes at all** | `EmptyState` kind `notStarted`: "No athletes yet." Body "Add your squad, or invite them by email." Actions "Add athlete", "Invite squad" (the second only for admins, otherwise omitted rather than disabled). |
| **Empty, filtered out** | `EmptyState` kind `noResults` naming every active filter: "No athletes in Forwards with unavailable status." Action "Clear filters". Per §11.2, `noResults` always names the filter. |
| **Empty, search** | "No athletes match 'doh' in Forwards." Actions "Search all squad", "Clear search". |
| **Error** | Table area replaced with "Could not load the squad. Check your connection and try again." plus Retry. Filters remain usable. |
| **Partial error** | Rows render with the columns that loaded. A failed compliance view shows the compliance column as "Unavailable" in `text.tertiary`, never as 0. Caption under the header names what failed. |
| **Offline** | Cached rows, offline banner, "Last updated 08:12". Every bulk action disabled with the standard copy. Search and sort still work over the cached set, and the caption says "Searching cached data". |
| **Athlete with no entry today** | Readiness cell renders the missing glyph and "no entry today", never 0 and never blank. |
| **Athlete with no expectations in the window** | Compliance cell renders the not-applicable glyph with the caption "nothing expected". Excluded from the footer's compliance percentage and reported in its exclusions: "2 athletes excluded, nothing expected." |
| **Athlete with waived expectations** | Compliance shows the waived state in grey with the reason on tap. Grey by design: a waiver is not a failure and must not draw the eye (§4.3). |
| **Athlete with no app account** | Chip "No app account". Compliance shows the not-applicable glyph, because nothing can be expected of someone who cannot submit. Their expectations are auto-waived by the generation job with `waived_reason = 'no_account'`. |
| **Athlete left the club** | Hidden by default. Behind the filter they render at 60% opacity with a "Left 12 Jul" chip and no bulk action support except export. |
| **Selection mode** | Header replaced with "6 selected", action bar pinned. Selection survives sorting and scrolling and is cleared by changing the group filter, with a warning toast if more than 5 are selected. |
| **Bulk action in progress** | Action bar shows progress. Rows involved render at 60% opacity. Nothing else blocks. |
| **Bulk action partial failure** | Result sheet listing successes and failures per athlete, with a Retry for the failures only. |
| **Role: admin** | Screen not reachable. If deep linked, `EmptyState` kind `noPermission`: "Squad performance data is visible to coaching and medical staff." |
| **Role: medical** | Availability bulk action present. Gym programme assignment absent. |

---

## Interactions

| Action | Behaviour |
|---|---|
| Tap or click a row | Opens `athlete-profile.md`, carrying the active period and the originating screen for back navigation (§7 rules 2 and 3). |
| Tap the availability cell | Popover with status, reason category, restrictions, expected return, and "Open injury record" for medical. |
| Tap the compliance cell | Popover breaking the fraction down by domain and day: "Wellness 5 of 7, RPE 3 of 4, nutrition not expected." |
| Tap the readiness cell | Popover with today's value, the 28-day personal mean, the delta, and the components. Not a chart: the sparkline is already in the row. |
| Tap the flag badge | Opens `flags.md` filtered to that athlete. |
| Tap a group chip | Sets the global group filter to that group. Announced, and the header updates. |
| Sort | Click a column header on web, sort sheet on mobile. Three states: none, ascending, descending. Persisted per user. |
| Filter | Multi-select per facet: availability, group, position, flag severity, compliance state, has account, status. Facet counts shown beside each option and computed from the current result set minus that facet's own selection. |
| Search | Debounced, clears with `Esc`, focused with `/` on web. |
| Select rows | Checkbox per row, "select all in view", "select all matching filters" as a separate explicit action with its count stated. |
| Column configuration (web) | Toggle columns, reorder by drag, persisted per user. |
| View toggle | Table or cards. |
| Export | Exports the current result set with the active filters and columns, as CSV or XLSX, through the audited export pipeline. The file header records the filters used, because an export whose scope is unknown is a report nobody can trust. |
| Add athlete | Opens the athlete creation form. `athletes.user_id` stays null: a squad member exists before they have an account (`04-data-model.md` §3). |
| Keyboard (web) | `j` / `k` move the row cursor, `Enter` opens, `x` toggles selection, `/` search, `Esc` clears selection then search. |

### Bulk actions in detail

The action bar is role-filtered, so a coach never sees a disabled "Set availability" button. An
action a role cannot perform is absent, not greyed: a greyed control invites a support ticket
asking why it is greyed.

| Action | Flow |
|---|---|
| **Add to group** | Group picker, multi-select. Confirm states counts and skips: "Add 15 athletes to Forwards. 2 are already members." Writes new `group_memberships` rows with `added_at = now()`. |
| **Remove from group** | Group picker limited to groups the selection actually belongs to. `ConfirmSheet`: "Remove 6 athletes from Rehab? Their membership history is kept." Sets `removed_at`, never deletes (`groups.md`). |
| **Assign programme** | Programme picker filtered by type and the actor's role, then a start date. Creates one `programme_assignments` row per athlete. Warns where an athlete already has an active assignment of the same type, offering to supersede or to skip. Rehab assignment is medical only and suspends the athlete's gym programme rather than deleting it (`03-flows.md` §4). |
| **Add to session** | Session picker limited to future sessions in the next 14 days. Runs the restriction check from `session-detail.md` and shows conflicts before writing. Overrides require a reason and are audited. |
| **Set availability** (medical) | Status, reason category, restrictions, effective from, optional note. `ConfirmSheet` states the consequence: "Set 4 athletes to Unavailable. Coaching staff will see the change immediately." Writes one `availability` row per athlete and closes the previous one. Every change is audited (`09-security-and-compliance.md` §8.5). |
| **Send reminder** | Choose the domain and the date. Preview shows exactly who will be messaged and who will not, with reasons: "3 will not be messaged: notifications muted, no account, already submitted." Subject to the daily notification budget; if it would exceed it, the action states so and offers to send to the highest-priority subset. |
| **Waive expectations** | Date range, domain, and a required reason. `ConfirmSheet`: "Waive wellness for 6 athletes, 10 to 14 August. This removes it from their compliance figures." The reason is stored in `compliance_expectations.waived_reason` and surfaced wherever the waiver shows. |
| **Export** | Format picker, column confirmation, then the audited export job. |

Undo: group membership changes and expectation waivers offer a 10 second undo. Availability
changes, programme assignments, and reminders do not, because they have already been communicated
to athletes or to other staff and pretending otherwise would be dishonest.

---

## Validation rules

| Rule | Enforcement | Message |
|---|---|---|
| Search minimum 2 characters | Client | Below 2, the search is not run and no message is shown. |
| Search maximum 60 characters | Client | |
| Bulk selection maximum 200 athletes | Client and server | "Select fewer than 200 athletes for a bulk action." Above squad scale this is a scripting job, not a UI action. |
| Bulk action requires at least one selection | Client | Action bar hidden when nothing is selected. |
| Group must exist and belong to the organisation | Server, RLS | |
| Programme assignment `starts_on` not more than 90 days in the past | Server | "Choose a start date within the last 90 days." |
| Availability `effective_from` not in the future by more than 30 days | Server | "Set availability from a date within the next 30 days." |
| Availability requires `reason_category` when status is not `available` | Client and server | "Choose a reason category." Category only, never a diagnosis in this field. |
| Restriction values from the controlled vocabulary | Client and server | See O-358 in `session-detail.md`. |
| Waiver requires a reason, 1 to 200 characters | Client and server | "Give a reason for the waiver." |
| Reminder cannot be sent twice for the same domain and date within 6 hours | Server | "A reminder for wellness on 5 August was sent 2 hours ago." Prevents a coach nagging a squad into muting notifications. |
| Export requires a period | Client | Defaults to the active period. |
| `left_club` cannot be set by a coach | Server, RLS | Admin only. |

---

## Edge cases

| Case | Behaviour |
|---|---|
| **Athlete with no wellness entry today** | Readiness renders the missing glyph and "no entry today". Sorting by readiness places them last, in both directions, with the count stated in the footer: "3 athletes with no entry today." |
| **Athlete with no baseline yet** | Fewer than 10 prior observations means no z-score and no delta (§8.5). The readiness value shows alone, with the caption "no baseline yet, 6 of 10 entries". |
| **Athlete with no expectations** | Compliance is not applicable, not 0%. Excluded from the footer percentage and named in its exclusions. |
| **Athlete with no app account** | Expectations auto-waived, compliance not applicable, chip shown. They still appear in every list and can be assigned to sessions and groups, which is the whole reason `athletes.user_id` is nullable. |
| **Athlete in no groups** | Groups cell renders the not-applicable glyph. They disappear when any group filter is active, which is correct and is why the empty state names the filter. |
| **Athlete in 6 groups** | Two chips plus "+4", expanding on tap. |
| **Group filter active and an athlete is added to that group mid-session** | The list refreshes on the next refetch. No live insertion animation, because a row appearing under a coach's finger causes mis-taps. |
| **Athlete removed from a group** | Disappears from the filtered list on refetch. Historical data unaffected: `removed_at` is set, the row is kept, and any analysis over a past window still includes them (`04-data-model.md` §3). |
| **Athlete marked left the club** | Hidden by default. Their entries, flags, injuries, and history are all retained. Nothing is deleted. |
| **Athlete rejoins** | Status set back to `active`. Group memberships are not restored automatically: a new membership row with a new `added_at` is created, so the gap is visible in history. |
| **Two athletes with the same name** | Squad number disambiguates in every list. Where the number is also null, the row shows the date of birth year in `text.tertiary`. |
| **Athlete with squad number 0 or null** | Null renders the not-applicable glyph; 0 is a real number and renders as 0. |
| **Squad of 5** | The table renders as a table. No special layout. The footer statistics still show sample sizes, and squad distribution statistics are suppressed below 5 athletes with data (§8.5). |
| **Squad of 120** | Pagination at 50 rows with infinite scroll on mobile and a page control on web. Bulk "select all matching filters" states the true count, not the loaded count. |
| **Compliance window includes days before an athlete joined** | Those days generate no expectations, so they do not count against them. The `joined_at` date bounds expectation generation. |
| **Period selector set to Season with 200 days of data** | Compliance is read from `mv_compliance_rates`, so the window size does not change the query cost materially. The sparkline stays at 7 days regardless of the period, because a 200-point sparkline in a 96 px cell is decoration. |
| **All athletes unavailable** | Renders normally. The footer says "0 available, 24 unavailable", which is a real state during a squad illness outbreak and must not read as an error. |
| **Bulk action partially fails** | Per-athlete results, retry for failures only, nothing silently dropped. |
| **Two staff running the same bulk action simultaneously** | Group membership insert is idempotent against live rows and reports "already a member". Availability writes both land as separate rows; the later `effective_from` wins as current status and the history shows both. |
| **Offline with a stale cache** | Renders with the age caption. Above 24 hours old, a `severity.low` chip reads "Data is more than a day old". |

---

## Performance notes

Budget: 150 ms p95 server time for the squad status query (`05-architecture.md` §11), 1.5 s p95
first meaningful paint for 40 athletes.

1. **Materialised views carry the load.** `mv_daily_athlete_summary`, `mv_compliance_rates`, and
   `mv_wellness_baselines` are refreshed nightly (`04-data-model.md` §12). The squad list never
   scans `wellness_entries` or `training_entries`.
2. **Today's readiness is the exception.** The nightly view is stale for today, so today's row
   comes from a small indexed read of `wellness_entries (athlete_id, entry_date desc)` for the
   filtered athlete set, or from a view refreshed hourly. Recommendation: add `day = today` to a
   lightweight `mv_squad_daily` refresh on the hourly cadence rather than querying raw entries
   per athlete.
3. **One query, one round trip.** All the CTEs above run as a single statement. Not one query per
   column and not one query per athlete.
4. **Server-side sort and filter.** Never sort a paginated set on the client.
5. **Pagination**: 50 rows per page. Keyset pagination on `(last_name, first_name, id)` rather
   than `offset`, so page 3 does not get slower than page 1.
6. **Sparklines are fetched with the page**, as a `jsonb` array of 7 points per athlete, not as a
   separate request per row.
7. **Facet counts** are computed in the same query with `filter` aggregates. A separate count
   query per facet is 6 extra round trips for information that changes with every keystroke.
8. **Search is debounced at 250 ms** and cancels in-flight requests.
9. **`staleTime` 60 seconds, `refetchInterval` 60 seconds while focused**, per the freshness
   policy. No realtime subscription: compliance counts change constantly and nobody needs
   sub-minute accuracy (`05-architecture.md` §8). Availability **is** realtime, so the screen
   subscribes to `org:{org_id}:availability` and invalidates on message.
10. **Row virtualisation** above 60 rows, with a fixed row height so the scrollbar is honest.
11. **Bulk actions are one RPC**, not N requests. A 40-athlete group assignment is one statement.
12. **The trigram index** on the name expression keeps search off a sequential scan.

---

## Accessibility

- The web table is a real `table` with `th` column headers carrying `aria-sort`. Sorting
  announces the new order: "Sorted by readiness, ascending. 24 athletes."
- Row selection checkboxes have labels naming the athlete: "Select Ellis Marsh".
- The bulk action bar is `role="region"` labelled "Bulk actions, 6 athletes selected", and is
  reachable immediately after the table in tab order.
- Every status cell carries text as well as colour and glyph (§4.1). In the dense table the
  availability cell uses the pill with its word; the glyph-only variant is permitted only in the
  availability board grid, not here.
- Sparklines are decorative in the row context and are `aria-hidden`, because the numeric value
  and delta beside them carry the same information in text. This is deliberate: a screen reader
  announcing 7 unlabelled numbers per row makes the table unusable. The full series is available
  on the athlete profile with a table alternative.
- Compliance cells announce "3 of 3 complete, wellness and RPE, 3 to 9 August".
- Readiness cells announce "Readiness 61, 14 below this athlete's 28-day average, worse". The
  valence word is always spoken, per §4.4.
- Missing values announce "no data"; not-applicable announces "not applicable". Neither announces
  "zero".
- Filters are a `group` of `listbox`es with the applied filter count announced on change.
- Keyboard: full row traversal, selection, sorting, and every bulk action reachable without a
  pointer. Drag is not used anywhere on this screen.
- Dynamic type to 200%: the table drops to the card view automatically below a usable column
  width rather than horizontally scrolling a 10-column table.
- Touch targets 44 px minimum in the dense table, achieved with row padding, not row height
  (§1.3).
- Reduced motion: no row insertion animation, no shimmer.

---

## Open questions

- **O-371** Column configuration. I have made columns user-configurable and persisted per user.
  That needs a `user_preferences` store, which does not exist in the schema. Confirm you want it,
  or I will ship a fixed column set with a responsive drop order.
- **O-372** What is the headline readiness indicator, exactly? I am showing today's
  `readiness_score` with its delta against the athlete's own 28-day mean. Alternatives are a
  z-score, a traffic-light band, or a composite that includes load and sleep. The delta against a
  personal baseline is defensible and matches the threshold philosophy in `04-data-model.md` §10,
  but it is your sports science call.
- **O-373** Should the squad list show an athlete's ACWR? It is in `mv_acute_chronic_load` and it
  is the number most coaches ask for. I have left it out because it is suppressed below 21 of 28
  days of data (§8.5) and a mostly-empty column trains people to ignore the column. Add it as an
  optional column?
- **O-374** Default sort. I default to surname. Worst-readiness-first would surface problems
  immediately, but it makes the roster reorder itself every morning, which makes it useless as a
  directory. My assumption is surname by default, with the dashboard carrying the exceptions view.
- **O-375** Can a coach add an athlete, or is that admin only? `01-roles-and-permissions.md`
  gives coaches "Create and manage groups" but is silent on creating athlete records. I have
  assumed coaches can add an athlete record (no account, no invite) and only admins can invite a
  user. Confirm, because it changes the RLS insert policy on `athletes`.
- **O-376** Should "left the club" be a coach action? I have it as admin only, because it hides
  an athlete from every squad view and has retention consequences (`09-security-and-compliance.md`
  §7). Coaches will find that frustrating at the end of a season.
- **O-377** Bulk reminders. I have capped them by the daily notification budget and blocked a
  repeat within 6 hours. Clubs with poor compliance will want to send more, and sending more is
  how a squad ends up with notifications turned off. Confirm the cap, or give me the number you
  want.

---

## Related documents

- One athlete in full → `athlete-profile.md`
- Exceptions rather than the roster → `dashboard.md`, `squad-status.md`
- Group membership and history → `groups.md`
- Accounts, invites, and roles → `user-management.md`
- Availability rules → `01-roles-and-permissions.md` §4
- Compliance definition → `04-data-model.md` §11
- Missing versus zero → `06-design-system.md` §5.4
