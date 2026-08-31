# Screen: Staff dashboard

> **Layout status**: provisional. Awaiting client design photographs.

Screen 8 in the inventory (`02-information-architecture.md` §5). Route `/staff/dashboard`.
Tab 1 of the staff shell. The default landing screen for coach, S&C, and medical roles.

---

## Purpose

This screen exists to satisfy one success criterion, stated in `00-product-overview.md` §
"Success criteria for v1", item 4:

> A coach can go from opening the app to identifying the three athletes needing attention in
> under 15 seconds, without applying a filter manually.

Everything on this screen is subordinate to that sentence. The product thesis
(`00-product-overview.md` §"Core product thesis", claim 2) is that staff need exceptions, not
dashboards. A coach does not want to read 30 athletes' numbers. They want to be told which
three need attention this morning, and why.

Therefore the dashboard is **not** a grid of squad metrics. It is a ranked exception list with
supporting context beneath it. If a coach has to scan, compare, or filter to answer "who do I
speak to first", the screen has failed regardless of how much data it displays.

Four jobs, in strict priority order:

1. Name the athletes who need attention today, and state why in one line each.
2. Confirm the shape of the squad: how many available, how many compliant.
3. Show what is happening today and when.
4. Show who is unavailable and when they are expected back.

Job 1 is the screen. Jobs 2 to 4 are the packaging.

---

## Roles and access

| Role | Access | Notes |
|---|---|---|
| Coach / S&C | Full | Sees availability level only. Never diagnosis, mechanism, or clinical notes. |
| Medical / Physio | Full, plus medical additions | Attention list additionally ranks athletes with an open injury awaiting a clinical update, and the injury card links to `injury-record.md`. |
| Athlete | No access | The route does not exist in the athlete navigator (`08-notifications.md` §7, resolution rule 4). |
| Admin / Club owner | No access by default | An admin who also holds the coach role gets the coach view. Per `01-roles-and-permissions.md` §1, admin alone does not read individual athlete data. |

**Clinical boundary.** No query on this screen reads `injury_clinical`. The injury card shows
`body_area`, `availability.status`, `availability.restrictions`, and `injuries.expected_return`
only. A coach reading this screen must be able to tell that an athlete is unavailable with a
hamstring issue and must not be able to tell what the diagnosis is. See
`decisions/adr-007-clinical-data-separation.md`.

**Group filter.** This is a multi-athlete screen, so it respects the persistent global group
filter (`CLAUDE.md` §3). The filter selection is read from global context at mount and is never
owned by this screen.

---

## Entry points

| From | Trigger | Context carried |
|---|---|---|
| App launch, staff shell | Default tab | Group filter and period restored from persisted global state |
| Staff tab bar | Tap Dashboard | None |
| Web sidebar | Click Dashboard | None |
| Push `staff.flag.digest` | Tap, when the digest names more than three flags | Routes to `/staff/flags`, not here. The dashboard is not a notification target. |
| Back from any dashboard child | System back | Scroll position and expansion state restored |
| Deep link `https://app.fydr.co/staff/dashboard` | Universal link | Optional `?group=<id>` sets the global filter and shows a "filter applied from link" chip |

The dashboard is deliberately **not** a deep link target for notifications. Every staff
notification routes to the specific flag, athlete, or import it concerns
(`08-notifications.md` §7). A notification that lands on the dashboard makes the recipient find
the thing themselves, which is the work the notification was meant to save.

---

## Layout

**Assumption, pending client design photographs.** The ordering below is a product argument, not
a visual one. The client's designs may change spacing, card treatment, and typography. They must
not change the ordering without re-opening the 15-second criterion, and O-215 asks them to
confirm it.

### The above-the-fold contract

"Above the fold" is defined as: the first 640 pt of the mobile scroll view at the `md`
breakpoint (390 by 844 pt, minus a 56 pt header and a 49 pt tab bar), and the first viewport of
the web dashboard at `xl` (1280 by 800 px, minus a 56 px header).

Above the fold, in this order:

| Rank | Block | Why it is here |
|---|---|---|
| 1 | **Needs attention**, three athlete rows, each with a name and a one-line reason | This is the answer to the coach's actual question. Placing anything above it costs seconds against a 15-second budget. Names first, because a coach thinks in people, not metrics. |
| 2 | **Squad strip**: available / modified / unavailable counts plus a compliance ring | Two seconds of context that tells the coach whether the attention list is the whole story. It is one row, not a grid, because it is orientation and not analysis. |
| 3 | **Next session card** | The schedule is the spine (`00-product-overview.md` design principle 4). A coach reading flags at 08:00 is deciding what to change about the 10:00 session. The two facts belong adjacent. |

Below the fold, in this order: the rest of today's timetable, the injury and availability
summary, and a compliance breakdown by domain.

**The compliance breakdown carries three tiles, not four.** Wellness, RPE and gym. There is no
nutrition tile, because athletes do not log nutrition and no nutrition expectation is ever
generated (`04-data-model.md` §11, `nutrition-guidance.md`). The tile previously specified here
showed a figure that nothing could produce, which would have read as a squad-wide failure rather
than an absence. Nothing replaces it: three real domains laid out across the same width is a
better tile than four with one of them fictional.

**Ordering justification, stated explicitly because it is the one design decision on this screen
that is load-bearing.**

- The alternative ordering, squad summary first and exceptions second, is what every competitor
  dashboard does. It fails the criterion: reading four summary tiles and then finding the
  exception list costs six to eight seconds before the coach has read a single name.
- Putting the timetable first fails because the coach usually already knows what today is. They
  do not know who is a problem.
- Putting flags first as a *count* ("7 open flags") rather than as *named athletes* fails
  because a count is not actionable. It forces a tap, and the tap is the thing being budgeted.
- Three rows, not five and not all, because the criterion says three, and because a list long
  enough to need scanning is a list that needs filtering, which the criterion forbids.

### Mobile, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ Fydr      [All squad ▾]   [Today ▾]        ⚙︎ │ 56 sticky
├────────────────────────────────────────────────┤
│                                                │
│  NEEDS ATTENTION                          3    │ section label
│  ┌──────────────────────────────────────────┐  │
│  │ ◕! S. Okafor              #7      ▮▮▮ 2  │  │ 88 pt row
│  │    Readiness 41. Down 29 on his 28-day   │  │
│  │    norm, third day running.              │  │
│  ├──────────────────────────────────────────┤  │
│  │ ◑  A. Byrne               #14     ▮▮▯ 1  │  │
│  │    Now modified, hamstring. Back Fri 8   │  │
│  │    Aug. No sprinting.                    │  │
│  ├──────────────────────────────────────────┤  │
│  │ ●  T. Fitzgerald          #3      ▮▯▯ 1  │  │
│  │    Wellness missing 3 days. ACWR 1.62.   │  │
│  └──────────────────────────────────────────┘  │
│   [ Show 4 more ]                              │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  28 avail · 3 modified · 2 unavailable   │  │ 64 pt strip
│  │  ◍ 24/31 wellness today                  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  NEXT                                          │
│  ┌──────────────────────────────────────────┐  │
│  │ 10:00  Conditioning        MD-4  🏃      │  │
│  │        Main pitch · 31 expected          │  │
│  └──────────────────────────────────────────┘  │
│ ───────────────────── fold ──────────────────  │
│  TODAY                                         │
│  ┌──────────────────────────────────────────┐  │
│  │ 08:30  Gym: Upper A        MD-4  🏋      │  │
│  │ 10:00  Conditioning        MD-4  🏃      │  │
│  │ 14:00  Video review        MD-4  📋      │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  AVAILABILITY                             5    │
│  ┌──────────────────────────────────────────┐  │
│  │ ◑ A. Byrne     Hamstring   Back Fri 8    │  │
│  │ ○ M. Nowak     Ankle       Back 22 Aug   │  │
│  │ ○ J. Adeyemi   Shoulder    No date       │  │
│  │ ◑ K. Reilly    Load mgmt   Review Thu    │  │
│  │ ◑ P. Sowande   Illness     Back Wed 6    │  │
│  └──────────────────────────────────────────┘  │
│   [ Open injury dashboard ]                    │
│                                                │
│  COMPLIANCE THIS WEEK                          │
│  ┌────────┬────────┬────────┐                  │
│  │Wellness│  RPE   │  Gym   │                  │
│  │  ◍ 87% │ ◍ 79%  │ ◍ 92%  │                  │
│  └────────┴────────┴────────┘                  │
│                                                │
├────────────────────────────────────────────────┤
│  ▣ Dash   ▤ Sched   ▧ Squad   ▨ Prog   ⋯ More │ 49 + inset
└────────────────────────────────────────────────┘
```

### Web, `xl` 1280 px

Per `06-design-system.md` §9.2, the standard staff dashboard composition is flags 7 columns,
availability and compliance 5 columns, timetable full width below. That composition predates
this specification and is adjusted here: the attention list takes the 7-column position, and the
timetable moves up beside it, because at `xl` the fold is horizontal as well as vertical.

```
┌────────┬──────────────────────────────────────────────────────────────────┐
│        │  [All squad ▾]  [Today ▾]              Tue 5 Aug · MD-4      ⚙︎ │ 56
│ Fydr   ├──────────────────────────────────────────────────────────────────┤
│        │                                                                  │
│ ▣ Dash │  ┌── 7 cols ───────────────────────┐ ┌── 5 cols ──────────────┐ │
│ ▤ Sched│  │ NEEDS ATTENTION            3    │ │ SQUAD                  │ │
│ ▧ Squad│  │ ┌─────────────────────────────┐ │ │  28 avail  3 mod  2 un │ │
│ ▨ Prog │  │ │◕! S. Okafor  #7    ▮▮▮ 2   │ │ │  ◍ 24/31 wellness      │ │
│ ⋯ More │  │ │  Readiness 41. Down 29 on   │ │ ├────────────────────────┤ │
│        │  │ │  his 28-day norm, 3rd day.  │ │ │ NEXT                   │ │
│        │  │ │           [Open] [Ack all]  │ │ │ 10:00 Conditioning MD-4│ │
│        │  │ ├─────────────────────────────┤ │ │ Main pitch · 31 exp.   │ │
│        │  │ │◑  A. Byrne   #14   ▮▮▯ 1   │ │ ├────────────────────────┤ │
│        │  │ │  Now modified, hamstring.   │ │ │ TODAY                  │ │
│        │  │ │  Back Fri 8 Aug. No sprint. │ │ │ 08:30 Gym: Upper A     │ │
│        │  │ ├─────────────────────────────┤ │ │ 10:00 Conditioning     │ │
│        │  │ │●  T. Fitzgerald #3 ▮▯▯ 1   │ │ │ 14:00 Video review     │ │
│        │  │ │  Wellness missing 3 days.   │ │ └────────────────────────┘ │
│        │  │ │  ACWR 1.62.                 │ │                            │
│        │  │ └─────────────────────────────┘ │ ┌── 5 cols ──────────────┐ │
│        │  │  [ Show 4 more ]                │ │ AVAILABILITY        5  │ │
│        │  └─────────────────────────────────┘ │ ◑ A. Byrne  Fri 8 Aug  │ │
│        │                                      │ ○ M. Nowak  22 Aug     │ │
│        │  ┌── 7 cols ───────────────────────┐ │ ○ J. Adeyemi  no date  │ │
│        │  │ COMPLIANCE THIS WEEK            │ │ ◑ K. Reilly  review Thu│ │
│        │  │ Wellness ◍87  RPE ◍79           │ │ ◑ P. Sowande  Wed 6    │ │
│        │  │ Gym ◍92                         │ │      [ Injury board ]  │ │
│        │  └─────────────────────────────────┘ └────────────────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────┘
```

At `lg` (1024) the two columns become 8 and 4. Below `lg` the layout collapses to the mobile
single column in the same order.

### Density

`comfortable` on mobile, `compact` on web at `lg` and above. The attention rows stay
`comfortable` on every platform: they are the one block that must be readable at a glance from
arm's length, which is how a coach reads a phone propped on a desk while doing something else.

---

## Period and `?day=`

**AS BUILT.** The dashboard already had a `?day=` strip (the Monday–Saturday week list, one row per
day, selecting which day's timeline is shown). `?period=` does not compete with it — the two are
halves of one control:

| `?period=` | The day-detail column shows | `?day=` |
|---|---|---|
| `day` (default) | One day's timeline, with the per-session flag and outstanding-entry detail. Unchanged behaviour. | Picks which day, bounded to the visible week. |
| `week` | Every session Monday–Saturday, grouped by day, each linking to its session. | Not read. |

The week list renders in **both** modes — it is the day picker, and hiding it in week mode would
leave no route back to a day. Its rows write `period=day` alongside `day=`, so clicking a day in
week mode means "drop into this day", which is the only thing it could sensibly mean.

Week mode deliberately omits the per-athlete "affected" rows. Those come from `fetchTimeline`'s
per-date flag and `gps_records` reads; running six of them to fill a scan-level block would be six
times the queries for detail nobody reads at week altitude. A caption says so, because an absent
flag list must never look like an absence of flags.

**What the control does NOT touch, and why that is right rather than a gap.** The headline stats,
Ready for Saturday, Squad state and Outstanding entries are not day-or-week-scoped by
configuration — they are scoped by *definition*: "Wellness, today", "RPE, yesterday", availability
as it stands right now, days to Saturday. Several are already week-scoped ("week load so far",
sessions left this week). Re-pointing any of them at a period would not widen a window, it would
change what the number means. The footer states this rather than leaving it implicit.

No query on this screen needed pagination: week mode reads six days of one org's sessions, tens of
rows, nowhere near PostgREST's 1000-row ceiling. The rule is "page any query whose window can grow
past the ceiling", not "page everything".

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Global group filter in the header. `variant="trigger"` on mobile, `inline` on web. |
| `PeriodSelector` | §6.8 | Header. `allowed={['day','week']}` only (the `today`/`thisWeek` of this table in `RangeKey` vocabulary). The dashboard is a today screen; longer windows belong in Analytics. `month`, `season`, `year` and `all` render **disabled with that reason**, not hidden. Fallback is `day`, stated explicitly because `DEFAULT_RANGE` is `month` and is not legal here. See "Period and `?day=`" below. |
| `AttentionRow` | **New**, this screen | One athlete plus a generated one-line reason. Composed from `AthleteCard` with a `reason` line and no `trailing` slot. See below. |
| `AthleteCard` | §6.1 | Base of `AttentionRow`, and used directly in the availability list. |
| `FlagBadge` | §6.4 | Severity meter plus count on each attention row. |
| `AvailabilityPill` | §6.5 | Availability list rows, `size="sm"`, `variant="tint"`. |
| `ComplianceRing` | §6.6 | Squad strip (`size={32}`, `centre="fraction"`) and the compliance breakdown (`size={48}`, `centre="percent"`). |
| `MetricTile` | §6.2 | Squad strip counts. `size="m"`, `status` set per availability token. |
| `SessionCard` | §6.14 | Next session and today's timetable. `compact` in the timetable list, full in the Next slot. |
| `EmptyState` | §6.16 | Every block. `kind="allClear"` for an empty attention list, which is the important case. |
| `SyncStatusIndicator` | §6.17 | `variant="banner"`, pinned under the header when offline. |
| `Skeleton` blocks | §11.1 | Per-block loading. The blocks load independently. |

### `AttentionRow`, new component

Not in the existing inventory, and it is the only new component this screen introduces. It is
specified here rather than added to `06-design-system.md` in this commit because the design
system document is owned separately and the addition needs its own change.

```ts
export type AttentionReason = {
  /** Machine key, drives the icon and the analytics event. */
  kind: 'flag' | 'availability_change' | 'compliance_gap' | 'load_ratio'
      | 'unacknowledged' | 'clinical_review_due';
  /** Rendered sentence. Generated server-side so mobile and web read identically. */
  text: string;
  domain?: FlagDomain;
};

export type AttentionRowProps = {
  athlete: { id: string; displayName: string; squadNumber?: number | null; photoUrl?: string | null };
  availability: AvailabilityStatus | null;
  topSeverity: FlagSeverity | null;
  flagCount: number;
  /** Ranked, at most two rendered. The row never grows past three lines. */
  reasons: AttentionReason[];
  score: number;                 // debug and sorting only, never rendered
  onPress: (athleteId: string) => void;
  /** Web only. Acknowledges every open flag on this athlete. */
  onAcknowledgeAll?: (athleteId: string) => void;
};
```

Rules:

- The reason sentence is generated on the server, in the RPC, not in the client. Two clients
  generating the same sentence differently is how a coach ends up quoting a number back to a
  physio that the physio's screen does not show.
- At most two reasons render. A third exists in the payload and appears on the athlete profile.
- The row is a single press target of at least 88 pt. The whole row navigates. Nothing inside it
  is separately pressable on mobile.
- The row **never** renders a diagnosis. Reason text for an availability change is built from
  `body_area` and `availability.reason_category` only, and the sentence template is fixed in the
  RPC so a clinical string cannot reach it.

---

## Data requirements

One RPC serves the attention list. Four smaller queries serve the supporting blocks, and they
are independent so that a failure in one does not blank the screen (`06-design-system.md`
§11.3, scope rule).

### Field map

| Field | Source | Transformation |
|---|---|---|
| `athlete_id`, `display_name`, `squad_number` | `athletes.id`, `first_name`, `last_name`, `squad_number` | `left(first_name,1) \|\| '. ' \|\| last_name` for the compact row label |
| `availability_status` | `availability.status`, latest row with `effective_to is null` | Null becomes `available` by default, rendered as "Not set" only when no row has ever existed |
| `restrictions` | `availability.restrictions` | First two rendered, remainder as "+n" |
| `reason_category` | `availability.reason_category` | Mapped to a fixed label set. Never free text. |
| `body_area` | `injuries.body_area` via `availability.injury_id` | Enum label only |
| `expected_return` | `injuries.expected_return` | Formatted "Fri 8 Aug", per `06-design-system.md` §12.2 |
| `top_severity`, `flag_count` | `flags.severity`, `count(*)` where `status in ('raised','notified','acknowledged')` | Max severity, count of open |
| `observed_value`, `expected_value` | `flags.observed_value`, `flags.expected_value` | Rendered at the metric's precision, §5.3 |
| `readiness_score` | `mv_daily_athlete_summary.readiness` (from `wellness_entries.readiness_score`) | Rounded to integer |
| `readiness_baseline` | `mv_wellness_baselines.mean` for metric `readiness_score` | Rounded to integer |
| `acwr` | `mv_acute_chronic_load.acwr` | 2 decimal places |
| `missing_days` | Derived from `compliance_expectations` left join entry tables | Count of consecutive required-and-missing days ending yesterday |
| `avail_counts` | `availability.status` grouped | Counts by status across the filtered population |
| `compliance_today` | `mv_compliance_rates` | Completed over expected for `entry_date = current_date` |
| `sessions_today` | `sessions` where `starts_at::date = current_date` | Ordered by `starts_at` |
| `expected_headcount` | `session_participants` expanded through `group_memberships` | Distinct athlete count per session |

**Fields explicitly not read on this screen:** `injury_clinical.diagnosis`,
`injury_clinical.mechanism`, `injury_clinical.severity`, `injury_clinical.tissue_type`,
`injury_clinical.imaging`, `injury_clinical.referral`, `injury_clinical.clinical_notes`,
`injury_clinical.treatment_plan`. The table is not joined, not selected from, and not reachable
through any view this screen uses.

### The attention query

```sql
create or replace function public.staff_dashboard_attention(
  p_date       date   default current_date,
  p_group_ids  uuid[] default '{}'::uuid[],
  p_limit      int    default 3
)
returns table (
  athlete_id          uuid,
  display_name        text,
  squad_number        int,
  availability_status availability_status,
  top_severity        flag_severity,
  flag_count          int,
  score               numeric,
  reasons             jsonb
)
language sql
security invoker            -- RLS applies. This grants nothing.
stable
as $$
with scoped as (
  select a.id, a.first_name, a.last_name, a.squad_number
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and (
      cardinality(p_group_ids) = 0
      or exists (
        select 1
        from group_memberships gm
        where gm.athlete_id = a.id
          and gm.group_id = any (p_group_ids)
          and gm.removed_at is null
      )
    )
),

-- Current availability: the most recent open row per athlete.
avail as (
  select distinct on (av.athlete_id)
         av.athlete_id, av.status, av.restrictions, av.reason_category,
         av.injury_id, av.effective_from
  from availability av
  join scoped s on s.id = av.athlete_id
  where av.org_id = auth_org_id()
    and av.effective_to is null
  order by av.athlete_id, av.effective_from desc
),

-- Non-clinical injury context only. injury_clinical is not referenced.
inj as (
  select i.id, i.athlete_id, i.body_area, i.side, i.expected_return
  from injuries i
  join scoped s on s.id = i.athlete_id
  where i.org_id = auth_org_id()
    and i.status <> 'closed'
),

open_flags as (
  select f.athlete_id,
         count(*)::int                          as flag_count,
         max(f.severity)                        as top_severity,
         bool_or(f.status in ('raised','notified')
                 and f.raised_at < now() - interval '24 hours') as has_escalated,
         (array_agg(
            jsonb_build_object(
              'flag_id',  f.id,
              'domain',   f.domain,
              'metric',   f.metric,
              'severity', f.severity,
              'observed', f.observed_value,
              'expected', f.expected_value)
            order by f.severity desc, f.raised_at asc))[1] as top_flag
  from flags f
  join scoped s on s.id = f.athlete_id
  where f.org_id = auth_org_id()
    and f.status in ('raised','notified','acknowledged')
    and f.flag_date >= p_date - 7
  group by f.athlete_id
),

summary as (
  select d.athlete_id, d.readiness, d.acwr, d.readiness_baseline,
         d.consecutive_missing_days
  from mv_daily_athlete_summary d
  join scoped s on s.id = d.athlete_id
  where d.org_id = auth_org_id()
    and d.summary_date = p_date
),

scored as (
  select
    s.id as athlete_id,
    left(s.first_name, 1) || '. ' || s.last_name as display_name,
    s.squad_number,
    coalesce(av.status, 'available')::availability_status as availability_status,
    coalesce(of.top_severity, null) as top_severity,
    coalesce(of.flag_count, 0)      as flag_count,

    -- Composite attention score. Weights are configurable per organisation
    -- via organisations.settings -> 'attention_weights'. Defaults below.
      coalesce(case of.top_severity
                 when 'high'   then 100
                 when 'medium' then 60
                 when 'low'    then 30
               end, 0)
    + least(greatest(coalesce(of.flag_count,0) - 1, 0) * 15, 30)
    + case when of.has_escalated then 30 else 0 end
    + case
        when av.status = 'unavailable'
             and av.effective_from > now() - interval '36 hours' then 40
        when av.status = 'modified'
             and av.effective_from > now() - interval '36 hours' then 25
        else 0
      end
    + case
        when coalesce(sm.consecutive_missing_days,0) >= 2 then 35
        when coalesce(sm.consecutive_missing_days,0) = 1  then 20
        else 0
      end
    + case
        when sm.acwr is not null and (sm.acwr > 1.5 or sm.acwr < 0.8) then 25
        else 0
      end                                                    as score,

    jsonb_strip_nulls(jsonb_build_array(
      case when of.top_flag is not null then jsonb_build_object(
        'kind','flag',
        'domain', of.top_flag ->> 'domain',
        'text', format('%s %s. Threshold %s.',
                  initcap(replace(of.top_flag ->> 'metric','_',' ')),
                  round((of.top_flag ->> 'observed')::numeric, 1),
                  round((of.top_flag ->> 'expected')::numeric, 1))
      ) end,
      case when av.status <> 'available'
                and av.effective_from > now() - interval '36 hours'
      then jsonb_build_object(
        'kind','availability_change',
        'text', format('Now %s%s.%s',
                  av.status,
                  case when inj.body_area is not null
                       then ', ' || replace(inj.body_area::text,'_',' ') else '' end,
                  case when inj.expected_return is not null
                       then ' Back ' || to_char(inj.expected_return,'Dy DD Mon') || '.'
                       else '' end)
      ) end,
      case when coalesce(sm.consecutive_missing_days,0) >= 1 then jsonb_build_object(
        'kind','compliance_gap',
        'text', format('Wellness missing %s day%s.',
                  sm.consecutive_missing_days,
                  case when sm.consecutive_missing_days = 1 then '' else 's' end)
      ) end,
      case when sm.acwr is not null and (sm.acwr > 1.5 or sm.acwr < 0.8)
      then jsonb_build_object('kind','load_ratio',
        'text', format('ACWR %s.', round(sm.acwr, 2)))
      end
    )) as reasons

  from scoped s
  left join avail      av on av.athlete_id = s.id
  left join inj            on inj.id       = av.injury_id
  left join open_flags of  on of.athlete_id = s.id
  left join summary    sm  on sm.athlete_id = s.id
)
select athlete_id, display_name, squad_number, availability_status,
       top_severity, flag_count, score, reasons
from scored
where score > 0
order by score desc,
         top_severity desc nulls last,
         display_name asc
limit greatest(p_limit, 1);
$$;
```

Called with `p_limit => 3` on first paint and `p_limit => 10` when the coach taps "Show more".
The two calls are separate query keys so the expanded list does not evict the fast one.

`max(f.severity)` relies on `flag_severity` being declared in ascending order
(`low`, `medium`, `high`) so that the enum's natural ordering matches its meaning. This is
already true in `04-data-model.md` §10 and a migration must never reorder it.

### Supporting queries

```sql
-- 1. Squad availability counts and today's compliance, one row.
select
  count(*) filter (where av.status = 'available')   as available,
  count(*) filter (where av.status = 'modified')    as modified,
  count(*) filter (where av.status = 'unavailable') as unavailable,
  count(*)                                          as squad_size
from athletes a
left join lateral (
  select av.status from availability av
  where av.athlete_id = a.id and av.effective_to is null
  order by av.effective_from desc limit 1
) av on true
where a.org_id = auth_org_id()
  and a.deleted_at is null
  and a.status <> 'left_club'
  and (cardinality($1::uuid[]) = 0 or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id and gm.group_id = any($1)
          and gm.removed_at is null));

-- 2. Compliance today and this week, from the materialised view.
select domain,
       sum(completed)::int as completed,
       sum(expected)::int  as expected,
       sum(waived)::int    as waived
from mv_compliance_rates
where org_id = auth_org_id()
  and period_start <= $2 and period_end >= $2
  and ($1::uuid[] = '{}' or group_id = any($1) or group_id is null)
group by domain;

-- 3. Today's sessions with expected headcount.
select s.id, s.title, s.session_type, s.starts_at, s.duration_min,
       s.location, s.md_offset, s.status,
       (select count(distinct x.athlete_id)
          from (
            select sp.athlete_id from session_participants sp
             where sp.session_id = s.id and sp.athlete_id is not null
            union
            select gm.athlete_id from session_participants sp
             join group_memberships gm on gm.group_id = sp.group_id
                                      and gm.removed_at is null
             where sp.session_id = s.id and sp.group_id is not null
          ) x) as expected_headcount
from sessions s
where s.org_id = auth_org_id()
  and s.deleted_at is null
  and s.starts_at >= date_trunc('day', $2::timestamptz)
  and s.starts_at <  date_trunc('day', $2::timestamptz) + interval '1 day'
order by s.starts_at;

-- 4. Availability list. Non-clinical columns only.
select a.id as athlete_id,
       left(a.first_name,1) || '. ' || a.last_name as display_name,
       av.status, av.restrictions, av.reason_category, av.note,
       i.body_area, i.side, i.expected_return
from athletes a
join lateral (
  select av.* from availability av
  where av.athlete_id = a.id and av.effective_to is null
  order by av.effective_from desc limit 1
) av on true
left join injuries i on i.id = av.injury_id
where a.org_id = auth_org_id()
  and a.deleted_at is null
  and av.status <> 'available'
  and (cardinality($1::uuid[]) = 0 or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id and gm.group_id = any($1)
          and gm.removed_at is null))
order by av.status desc, i.expected_return nulls last;
```

### Query keys and freshness

Extends the factory in `05-architecture.md` §9.

```ts
dashboard: {
  all: (orgId: string) => [...qk.org(orgId), 'dashboard'] as const,
  attention: (orgId: string, date: string, groupIds: string[], limit: number) =>
    [...qk.dashboard.all(orgId), 'attention', date,
     { groupIds: [...groupIds].sort(), limit }] as const,
  squad: (orgId: string, date: string, groupIds: string[]) =>
    [...qk.dashboard.all(orgId), 'squad', date, { groupIds: [...groupIds].sort() }] as const,
  compliance: (orgId: string, date: string, groupIds: string[]) =>
    [...qk.dashboard.all(orgId), 'compliance', date, { groupIds: [...groupIds].sort() }] as const,
  availability: (orgId: string, groupIds: string[]) =>
    [...qk.dashboard.all(orgId), 'availability', { groupIds: [...groupIds].sort() }] as const,
},
```

| Query | `staleTime` | Refetch on focus | Realtime |
|---|---|---|---|
| attention | 0 | Yes | Yes, on `flags` and `availability` insert |
| squad | 60 s | Yes | On `availability` insert |
| compliance | 5 min | Yes | No |
| sessions today | 5 min | Yes | On `sessions` update |
| availability list | 60 s | Yes | On `availability` insert |

---

## States

### Default

All five blocks populated. The attention list has one to three rows and a "Show n more" control
when more than three athletes score above zero.

### Loading

Per-block skeletons, not a screen spinner (`06-design-system.md` §11.1). The attention block
renders three skeleton rows at exactly 88 pt so there is no layout shift when data arrives. The
150 ms delay and 400 ms minimum both apply. On a warm cache the previous data renders
immediately with a subtle refreshing indicator and is never replaced by a skeleton.

### Empty

Three distinct empty cases, and conflating them would be a product error.

| Block | Condition | `kind` | Copy |
|---|---|---|---|
| Attention | No athlete scores above zero | `allClear` | Title: "Nothing needs attention." Body: "No open flags, no availability changes, and compliance is complete." |
| Attention | Group filter excludes everyone | `noResults` | "No athletes in {group name}." Action: "Clear filter" |
| Attention | Organisation has no athletes yet | `notStarted` | "No athletes yet." Action: "Add athletes" (coach and admin only) |
| Timetable | No sessions today | `noData` | "No sessions today." Action: "Open schedule" |
| Availability | Everyone available | `allClear` | "Full squad available." |
| Compliance | No expectations today | `noData` | "Nothing expected today." Body names the MD-n label, for example "MD+2, rest day." |

`allClear` renders in `status.available` colours with a tick. This is the single most important
empty state in the product: an empty attention list is good news and must read as good news, not
as a failure to load. A coach who cannot distinguish "nothing is wrong" from "nothing loaded"
will stop trusting the screen within a fortnight.

### Error

Errors render at block scope. A failed compliance query leaves the attention list intact.

| Block failed | Behaviour |
|---|---|
| Attention | Block renders "Could not load the attention list. Check your connection and try again." with a retry. The rest of the screen renders normally. This is the one block whose failure is worth a Sentry warning at `error` level, because the screen has lost its purpose. |
| Squad strip | Counts render as the missing glyph with a caption "Squad summary unavailable" |
| Timetable | "Could not load today's sessions." plus retry |
| Availability | "Availability could not be loaded." plus retry. Never renders a partial list without saying so. |
| Compliance | Rings render the error state, `-` in the centre |

No error message contains a status code. A correlation ID sits behind "Details".

### Offline

Per `06-design-system.md` §11.4, staff lists render the last cached data with a "Last updated
HH:MM" caption and a persistent offline chip pinned under the header. Specific to this screen:

- The attention list renders from cache with the caption "Last updated 07:48. You are offline."
- The reason sentences are cached with the rows, so they do not need regeneration.
- Acknowledge, dismiss, and action controls are disabled with the explanation "You are offline.
  This will be available when you reconnect." Staff writes are not queued in v1
  (`06-design-system.md` §11.4, and O-34).
- With no cache at all the whole screen renders `EmptyState kind="offline"`.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | The specification above, unmodified. |
| Medical | The attention scorer adds two terms: `clinical_review_due` (+35) when an open injury has no `injury_clinical` update in 7 days, and `rehab_compliance` (+25) when a rehab assignment has missed sessions. The availability block gains an "Edit" affordance per row, opening the availability editor. The injury block header links to `injury-record.md` rather than the availability board. |
| Coach **and** medical (dual role) | The union, per `01-roles-and-permissions.md` §1 design note. Both medical terms apply. Do not build a third variant. |
| Admin without coach role | Route is not present in the admin shell. Direct navigation renders `EmptyState kind="noPermission"`: "Squad data is visible to coaching and medical staff." |

### Filtered

When the global group filter is active, the header renders the group name in `accent` tint and
the screen shows the fixed copy "Showing {group name} only" beneath the header
(`06-design-system.md` §12.2). Every count, ring, and list on the screen is scoped to that
filter, including the timetable headcounts. There is never a mixed state where the attention
list is filtered and the squad strip is not.

---

## Interactions

| Action | Result |
|---|---|
| Tap an attention row | Navigate to `athlete-profile.md` for that athlete, opening the tab implied by the top reason: `flag.domain` maps to the wellness, gym, or GPS tab; `availability_change` opens the injury tab; `compliance_gap` opens the tab of the missing domain. Per `02-information-architecture.md` §7 rule 2. |
| Long-press an attention row (mobile) | Bottom sheet: "Acknowledge all flags", "Open athlete", "View flags". |
| Tap "Acknowledge all" (web) | Optimistic mutation acknowledging every open flag on that athlete, per `05-architecture.md` §9. The row moves to acknowledged styling and remains for the rest of the session so the coach can see what they just did. It disappears on the next refetch. |
| Tap "Show n more" | Refetch with `p_limit => 10` and expand. The control is replaced by "Show fewer". Expansion state persists for the session, not across restarts. |
| Tap the squad strip | Navigate to `squad-status.md` with the same date and group filter. |
| Tap the compliance ring for a domain | Navigate to `squad-status.md` filtered to that domain. |
| Tap a session card | Navigate to `session-detail.md` (screen 16). |
| Tap "Open injury dashboard" | Navigate to `injury-dashboard.md`. |
| Tap an availability row | Navigate to `athlete-profile.md`, injury tab. |
| Change group filter | Global context updates. Every query on the screen refetches. Scroll position is preserved. Nothing navigates. |
| Change period (Today / This week) | Attention scoring window and compliance window both move. The "Next session" block is hidden when the period is `thisWeek`, because "next" has no meaning across a week. |
| Pull to refresh (mobile) | Invalidates `qk.dashboard.all(orgId)`. Retained under reduced motion, shortened. |
| Realtime flag insert | The attention list refetches. A new row animates in with a 100 ms fade, or appears instantly under reduced motion. **No sound, no toast, no badge count-up.** |

**Nothing on this screen is a destructive action.** Dismissing a flag requires a reason and lives
on `flags.md`, behind a `ConfirmSheet`. It is deliberately not available from the dashboard,
because a one-tap dismiss on a home screen is how alert fatigue starts.

---

## Validation rules

The dashboard is read-only apart from flag acknowledgement, so validation is mostly about
refusing to display a number that is not trustworthy.

| Rule | Behaviour on failure |
|---|---|
| An aggregate is never rendered without its sample size | `MetricTile` without a `footnote` fails a unit test (`06-design-system.md` §6.2). Compliance rings carry "24 of 31 athletes". |
| Compliance is measured against expectations, never against a flat daily assumption | If `compliance_expectations` has no rows for the date, the block renders `noData` with the MD-n label, never 0%. Per `03-flows.md` §8. |
| ACWR is not rendered below 21 days of load history | Reason text omits the ACWR clause and the score term is zero. A ratio computed on a fortnight is noise. |
| A personal-rolling flag is not rendered before the baseline window has 14 observations | The flag engine already suppresses these; the dashboard asserts it and logs a warning if one arrives. |
| `expected_return` in the past is not rendered as a future date | Renders "Overdue, expected 1 Aug" in `compliance.pending` grey, not red. An overdue return is a conversation, not an alarm. |
| Squad counts must sum to the squad size | If they do not, an athlete has two open availability rows, which is a data integrity fault. Render the counts, log at `error`, and show a caption "Availability data needs review". Never silently drop the athlete. |
| `p_limit` is clamped server-side | `greatest(p_limit, 1)` and a hard ceiling of 50 in the RPC signature. A client cannot request the whole squad through the attention endpoint. |
| Reason text is generated server-side only | A lint rule bans constructing reason sentences in `apps/*`. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Squad of 3.** | The attention list still shows at most three. With three athletes and three problems the "Show more" control never appears. Nothing special. |
| **Squad of 120.** Above the target market, but a club will do it. | The RPC is limited and the score ordering is stable. The supporting queries are materialised-view backed. See Performance notes. |
| **Everything is a problem.** 20 athletes score above zero after a heavy weekend. | Three still show. The "Show 17 more" control states the number plainly. The screen does not editorialise about the squad being in trouble. |
| **Two athletes tie exactly on score.** | Deterministic tie-break: severity descending, then display name ascending. The order must not shuffle between refetches, because a coach re-reading the list must see the same order. |
| **An athlete is in two selected groups.** | Deduplicated by the `exists` predicate. They appear once. |
| **Group membership changed today.** | `group_memberships` is history-preserving. The dashboard uses `removed_at is null`, so it reflects membership now, not membership on the date being viewed. This is correct for a today screen and wrong for a historical one, which is why `squad-status.md` resolves membership as at its selected date instead. |
| **An athlete has left the club mid-season.** | Excluded by `status <> 'left_club'`. Their historical data survives; they are not a person to speak to this morning. |
| **The organisation has no fixtures, so no MD-n labels.** | Days are labelled by training week position (`03-flows.md` §8). The session cards omit the MD chip rather than showing a wrong one. |
| **Two fixtures this week.** | Session cards show both MD+n and MD-n labels, per `03-flows.md` §8. |
| **Rest day.** No expectations exist. | Compliance block renders "Nothing expected today. MD+2, rest day." Compliance is not 0%, and no athlete is scored for a compliance gap. |
| **A flag was raised on an athlete who is now unavailable.** | Both reasons render, availability first, because availability changes the coach's action more than a wellness number does. Ordering within `reasons` is by `kind` priority: `availability_change`, `flag`, `compliance_gap`, `load_ratio`. |
| **Medical sets availability at 07:55, coach opens at 08:00.** | Realtime subscription on `availability` invalidates the attention query. The change is visible without a manual refresh. This is the flow in `03-flows.md` §1 and it must work. |
| **A coach acknowledges a flag on the dashboard and immediately opens flags.** | The flags list reads the same invalidated cache and shows it acknowledged. No stale state between the two screens. |
| **Clock crosses midnight while the screen is open.** | The date is resolved from the organisation's timezone (`organisations.timezone`), not the device. A `useOrgDate()` hook re-evaluates on app foreground and on a 60 s interval, and the screen refetches when the date changes. A coach in a different timezone from the club sees the club's day. |
| **Dual-role user whose medical role was granted five minutes ago.** | JWT claims are stale until refresh (`05-architecture.md` §"Claim staleness"). The medical additions appear after the next token refresh. The screen does not attempt to detect this. |
| **Flag arrives for an athlete outside the active group filter.** | Not shown, and not counted. The header already states a filter is active, which is the mitigation. This is the documented behaviour of the group filter rule and it is why the header treatment is non-negotiable. |
| **`mv_daily_athlete_summary` is mid-refresh.** | Materialised views are refreshed with `concurrently`, so reads are never blocked and never see a partial state. If the nightly job failed, the view carries a `refreshed_at` and the screen shows "Summary data from 04:00 yesterday" as a caption. Silently serving day-old readiness as today's is not acceptable. |

---

## Performance notes

Budget, from `05-architecture.md` §11: **staff dashboard first meaningful paint, 40 athletes,
1.5 s p95 on desktop broadband.** The attention RPC has its own sub-budget of **250 ms p95 server
time**, tighter than the general 400 ms ceiling, because it is the critical path for the
15-second criterion and it is the only query that cannot be deferred.

| Concern | Approach |
|---|---|
| Query shape | The attention RPC touches `athletes`, `availability`, `injuries`, `flags`, and one materialised view. At 40 athletes this is a few hundred rows. The `distinct on` for current availability is served by `create index on availability (athlete_id, effective_from desc) where effective_to is null`, which already exists (`04-data-model.md` §15). |
| Flags index | Served by `create index on flags (org_id, status, flag_date desc) where status in ('raised','notified')`. The RPC also reads `acknowledged`, which is outside that partial index. **Add** `create index on flags (org_id, athlete_id, flag_date desc) where status in ('raised','notified','acknowledged')`. This is a new index required by this screen and it belongs in the same migration. |
| Never scan raw entry tables | Any dashboard query that scans `wellness_entries` for more than one athlete is a bug (`05-architecture.md` §9). Readiness, ACWR, and consecutive-missing-days all come from materialised views. |
| Waterfalls | The five queries are issued in parallel on mount. The attention query is not gated on the group list loading: an empty `groupIds` array is the correct default and means all squad. |
| Payload | The attention response at `p_limit => 3` is under 2 KB. The expanded response at 10 is under 6 KB. |
| Render cost | The attention block renders three rows. It is not virtualised and does not need to be. The expanded list caps at 10. Only the web availability list, which can reach 15 rows, uses a plain map; nothing on this screen justifies a virtualised list. |
| Realtime | One channel subscription filtered to `org_id`, covering `flags` and `availability` inserts, per `05-architecture.md` §8. The handler invalidates query keys, it does not patch the cache, because the score has to be recomputed server-side. |
| Cold start | The dashboard is behind the staff shell, which is code-split from the athlete shell. The attention block is the first thing rendered and the first thing fetched. |
| Prefetch | On successful attention fetch, prefetch `qk.squad.athlete` for the three named athletes. A coach taps one of them within seconds roughly 70% of the time, on the assumption that the screen works. Cheap, and it makes the drill-down feel instant. |
| Measurement | A custom span `dashboard.attention.ttfb` and a product metric `dashboard.time_to_first_name`, measured from route mount to the first attention row being painted. That second metric is the direct instrumentation of success criterion 4 and should be reported alongside the 45-second wellness figure. |

---

## Accessibility

Target WCAG 2.2 AA on web and platform equivalent on mobile, per `06-design-system.md` §10.

| Requirement | Implementation |
|---|---|
| Heading structure | `h1` "Dashboard", `h2` per block: "Needs attention", "Squad", "Today", "Availability", "Compliance this week". `accessibilityRole="header"` on native. |
| Reading order | Matches visual order, which matches priority order. A screen reader user reaches the athlete names first, which is the same benefit a sighted user gets. |
| Attention row label | `{display name}, {squad number}. {availability}. {flag count} {severity} flags. {reason 1}. {reason 2}.` Example: "S. Okafor, 7. Available. 2 high severity flags. Readiness 41, threshold 70. Wellness missing 1 day." |
| Attention row hint | "Opens Sam Okafor's profile on the wellness tab." |
| Live region | The attention block is `aria-live="polite"`. A flag arriving in realtime announces "Attention list updated. 4 athletes need attention." It announces the count, not the whole list, because re-reading three rows on every realtime event is hostile. |
| Colour is never the only channel | Availability uses the glyph trio (`06-design-system.md` §4.2). Severity uses the three-bar meter. The compliance ring uses fill fraction plus its centre numeral. Removing colour from this screen loses nothing. |
| Touch targets | Attention rows are 88 pt tall, well above the 48 pt floor. "Show more" is 48 pt. Header controls are 44 by 44 pt minimum with `hitSlop`. |
| Dynamic type | Verified at 100%, 150%, and 200%. At 200% the attention row grows to three lines of reason text plus the name line and the badge moves below the name. No container has a fixed height. The fold contract is stated in points, so at 200% only two attention rows fit above the fold. That is correct: the rows are what matter. |
| Reduced motion | The realtime insert fade becomes instant. Skeleton shimmer is a static block. Pull-to-refresh is retained and shortened. No number ever counts up, anywhere, at any setting. |
| Focus | Web tab order: skip-to-content, group filter, period, attention rows, "Show more", squad strip, session cards, availability rows, compliance. 2 pt focus ring at 2 pt offset, never removed. |
| Keyboard, web | `j` and `k` move between attention rows, `Enter` opens, `a` acknowledges all flags on the focused row. Shortcuts are discoverable through a `?` overlay and are never the only route to an action. |
| Screen reader empty state | `allClear` announces "Nothing needs attention. No open flags, no availability changes, and compliance is complete." The word "nothing" comes first so the meaning arrives before the detail. |
| Print | The web dashboard prints to one page: attention list, squad counts, availability. Clubs print the availability board and pin it in the physio room (`06-design-system.md` §4.2), so the glyphs must survive greyscale. They do, by fill proportion. |

---

## Open questions

- **O-215**: The attention ordering above the fold (exceptions, then squad shape, then next
  session) is the whole argument of this screen and it is my recommendation, not your decision
  yet. Confirm it survives your design photographs. If the drawings put a squad grid at the top,
  the 15-second criterion is not achievable and one of the two has to give.
- **O-216**: Attention score weights. The values in the RPC (high flag 100, new unavailable 40,
  two missed wellness days 35, ACWR outside 0.8 to 1.5 worth 25) are my sports science
  assumption, not yours. They are stored in `organisations.settings -> 'attention_weights'` so
  they are tunable per club without a deploy, but the defaults need your judgement. Getting
  these wrong makes the screen confidently misleading rather than merely unhelpful.
- **O-217**: Should the attention list show exactly three, or three plus any athlete above a
  hard severity floor? A squad with five high-severity flags currently shows three and hides
  two behind a control. The argument for three is the criterion. The argument for a floor is
  that hiding a high-severity flag on the home screen is uncomfortable. I have assumed strictly
  three, with the count of hidden athletes stated plainly.
- **O-218**: Medical role additions. I have assumed medical staff want the same exception list
  with two extra scoring terms rather than a separate medical dashboard. If physios want a
  clinical-first home screen, that is a different screen and it needs its own specification.
- **O-219**: "Acknowledge all flags for this athlete" from the dashboard. It saves real time and
  it also makes bulk dismissal easy, which is exactly the alert-fatigue behaviour `flags.md`
  is designed to detect. I have included it on web only, where the deliberation cost is higher
  than a phone tap, and excluded dismissal entirely. Confirm.
- **O-220**: Period options. I have restricted the dashboard to `Today` and `This week`, on the
  basis that a 28-day window on a home screen is analytics wearing a dashboard's clothes. The
  global period selector normally offers six options (`02-information-architecture.md` §6).
  Confirm that restricting it here is acceptable, or the screen needs a defined behaviour for
  `Season`, which I do not think is meaningful.

---

## Related documents

- Ranked list drill-down → `flags.md`, `athlete-profile.md`
- Squad shape in full → `squad-status.md`
- Availability in full → `injury-dashboard.md`
- Components used → `06-design-system.md` §6
- Why clinical fields are absent → `decisions/adr-007-clinical-data-separation.md`
- Caching and realtime → `05-architecture.md` §8, §9
