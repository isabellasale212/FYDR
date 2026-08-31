# Screen: Athlete profile

> **Layout status**: provisional. Awaiting client design photographs.

Screen 20 in the inventory (`02-information-architecture.md` §5). Route
`/staff/athletes/{athlete_id}`. The single athlete view for staff.

> **The real route is `/squad/[athleteId]`**, and the shipped layout follows `PLAYER-PROFILE-SPEC.md`.
>
> **ADDED 2026-08-30 — "Entries and corrections".** A full-width card below the two-column grid,
> above the admin-only subject-access block. It answers the club's question *"is this a feature in
> the system for each player profile"* with yes, here. It lists the athlete's last **28 days** of
> wellness check-ins and session ratings; each row that is itself a revision carries a neutral
> `Corrected` pill naming who recorded the correction and when, and expands to show the values it
> replaced. Each row also offers **Correct check-in** / **Correct rating**, which opens an inline
> form pre-filled with the current values and submits through `revise_wellness_entry` /
> `revise_training_entry` — never an update. Only genuinely changed fields are sent, so correcting
> one number cannot restate the others. Coach and medical only, enforced in the function by
> migration `0058_coach_only_entry_correction.sql`, not by the button being hidden.
>
> **Saving a correction writes an `entry_revision.created` row to `audit_log`** — actor, athlete,
> entry, the row it superseded, and the previous value of every field that moved. It is written
> inside `revise_wellness_entry` / `revise_training_entry`, in the same transaction, so it cannot be
> skipped by a caller and a committed correction is never unaudited. Expanding a history *also*
> writes one `entry_revision.view` row per entry per page view — ADR-005 O-28's third clause, and
> the same treatment a physio opening clinical notes gets — but the write event is the important
> one. For a short window only the `.view` event existed, which meant reading what an athlete used
> to report was evidence and rewriting it was silent.
>
> The athlete sees the correction too: My Data marks the day or session `Corrected`, names the staff
> member, and shows the previous values (`screens/my-data.md` §"Revision marker"). A coach making a
> correction here is not doing it out of the athlete's sight.
>
> Gym set logs and the weekly nutrition check-in are **not** correctable here; the card says so
> on screen rather than leaving a coach to wonder. See
> `decisions/adr-005-immutable-entries.md` §"Who may correct what".

---

## Purpose

Everything Fydr knows about one athlete, in one place, organised by domain.

This is the destination of almost every drill-down in the staff app. A coach arrives here from a
flag, from the squad status grid, from the attention list, from the timetable, from a
leaderboard. In every case they arrive with a question already formed, and the screen's job is
to answer that specific question first and to make the rest available without hunting.

That is why the entry point determines the opening tab. A coach who taps a wellness flag and
lands on a "Summary" tab has to make one more decision before seeing what they came for. Over a
season that is thousands of unnecessary taps, and it is prohibited by
`02-information-architecture.md` §7 rule 2: every drill-down preserves context, and the athlete
screen opens on the relevant tab, not the default.

Four jobs:

1. Identify the athlete and their current state: availability, restrictions, open flags,
   compliance.
2. Present their data by domain across eight tabs, with trends over a selectable window.
3. Open on the tab and date the entry point implies.
4. Offer the quick actions a coach needs at this point: acknowledge a flag, adjust load, enter
   data on the athlete's behalf, message medical.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | All eight tabs. Injury tab at availability level only. Can enter data on behalf of the athlete, recorded with provenance `staff_entered`. |
| Medical | All eight tabs, in read-only form for the coaching domains (`01-roles-and-permissions.md` §1). Injury tab shows the clinical summary and links to `injury-record.md`. Can set availability. |
| Athlete | Does not use this screen. Their equivalent is `my-data.md` (screen 6), second person, own data only. |
| Admin | No access. `noPermission`: "Athlete data is visible to coaching and medical staff." |

**Group filter**: not applicable. This is a single-athlete screen, so `GroupFilter` renders
`disabled` per `06-design-system.md` §6.7, rather than being absent. A control that disappears
on some screens is a control a coach stops looking for.

**Period selector**: applicable and global. Default `last28`, matching the 7:28 acute-to-chronic
convention.

**Clinical boundary**: the injury tab is the sensitive one and it is specified in full below.

---

## Entry points

Each entry point determines the tab that opens. This table is the specification of
`02-information-architecture.md` §7 rule 2 for this screen. It is normative.

| From | Opens tab | Also carries |
|---|---|---|
| Dashboard, attention row | Tab implied by the top reason: `flag.domain` maps to wellness, gym, or GPS; `availability_change` opens injury; `compliance_gap` opens the missing domain's tab | Date, the flag id highlighted |
| Dashboard, availability row | Injury | Today |
| Flags, athlete name or card | The flag's `domain` tab | `flag_date`, the flagged metric highlighted in the chart |
| Squad status, day view row | The active domain tab, or Wellness when "All" is active | The viewed date |
| Squad status, week grid cell | That cell's domain tab | That cell's date |
| Timetable, participant row | Training | The session's date, the session highlighted |
| Injury dashboard, row (coach) | Injury | Today |
| Injury dashboard, row (medical) | Navigates to `injury-record.md` instead, not here | |
| Rehab groups, athlete card (coach) | Injury | Today |
| Squad list (19) | Overview | Current period |
| Leaderboards | Testing | The ranked test highlighted |
| Analytics, a data point | The metric's domain tab | The point's date |
| Programme builder, an override | Programme | The overridden exercise highlighted |
| Push `staff.availability.changed` | Injury | Today |
| Deep link with `?tab=gps&date=2026-08-01` | As specified | As specified |
| Back from a child screen | The tab and date it was opened from | Scroll position |

**Fallback**: an entry point with no implied tab opens Overview. An explicitly requested tab
always wins over an implied one. An unknown tab name in a deep link opens Overview rather than
erroring, and does not silently rewrite the URL, so a mistyped link is visible.

**Tab memory**: the last tab viewed for a given athlete is **not** remembered across visits.
Context from the entry point beats history every time. Remembering the tab would mean a coach who
looked at nutrition yesterday lands on nutrition today when they clicked a GPS flag, which is
precisely the failure rule 2 exists to prevent.

---

## Layout

**Assumption, pending client design photographs.** A sticky identity header with a horizontally
scrollable tab bar is my recommendation. `06-design-system.md` §9.2 already specifies the web
composition as "identity and availability 4 columns sticky, domain tabs and content 8 columns",
so the web layout is settled; the mobile treatment is the assumption.

Eight tabs is more than a mobile tab bar holds, so on mobile they scroll horizontally with the
active tab scrolled into view. The alternative, a "More" overflow, hides half the domains behind
a menu and makes the eighth tab meaningfully harder to reach than the first, which is a poor
trade when the entry point is choosing the tab anyway.

### The eight tabs

| # | Tab | Content |
|---|---|---|
| 0 | Overview | Cross-domain summary. Only reached when no tab is implied. |
| 1 | Wellness | Daily entries, readiness trend, component breakdown, personal baseline band |
| 2 | Nutrition | The athlete's resolved targets by MD-n and the guidance assigned to them. **Read-only reference, no entries and no adherence**: nutrition is guidance only (`nutrition-guidance.md`). |
| 3 | Gym | Session logs, set-level detail, volume and intensity trends, estimated 1RMs |
| 4 | Training | RPE, session load, weekly load, ACWR, attendance |
| 5 | GPS | Distance, high-speed distance, sprint distance, max speed, player load, accelerations |
| 6 | Testing | Test results over time, personal bests, left and right asymmetry |
| 7 | Injury / availability | Current status, restrictions, injury history, rehab. Role-dependent. |
| 8 | Programme | Assigned gym, nutrition, and rehab programmes, plus overrides |

GPS is a Premium-tier feature (`00-product-overview.md` §"Commercial model"). On Club tier
the GPS tab renders an upgrade explanation rather than being hidden, because a coach who cannot
see the tab will ask why the product has no GPS.

### Mobile, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  A. Byrne                    [Last 28d ▾] ⋯ │ 56 sticky
├────────────────────────────────────────────────┤
│  ┌────┐  Aoife Byrne          #14              │
│  │ AB │  Back row · 24 · joined Aug 2024       │ 96 identity
│  └────┘  ◑ Modified · no sprinting             │ sticky
│          ▮▮▯ 1 flag   ◍ 6/7 this week          │
├────────────────────────────────────────────────┤
│ Overview │Wellness│Nutrition│ Gym │Training│ ▸ │ 44 tabs, scroll
│          └────────┘                            │
├────────────────────────────────────────────────┤
│  Wellness · 9 Jul to 5 Aug 2026    [Day|Week]  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ Readiness                      68  ▽ -9  │  │ 128 chart
│  │ 100 ┤                                    │  │
│  │     │     ╭─╮   ╭╮                       │  │
│  │  75 ┤▁▁▁▁▁│▁│▁▁▁││▁▁▁▁▁▁▁▁ band ±1SD     │  │
│  │     │  ╭──╯ ╰───╯╰──╮                    │  │
│  │  50 ┤──╯             ╰───●               │  │
│  │     └──────────────────────────────────  │  │
│  │      9 Jul                       5 Aug   │  │
│  │  n = 26 of 28 days · self-reported       │  │
│  └──────────────────────────────────────────┘  │
│  ◂ swipe for sleep, soreness, fatigue ▸        │
│                                                │
│  COMPONENTS                                    │
│  ┌────────┬────────┬────────┬────────┐         │
│  │ Sleep  │Soreness│Fatigue │ Stress │         │
│  │ 6.5h ▽ │ 3 ▽    │ 3 ▽    │ 4 ─    │         │
│  │ vs 7.8 │ vs 4.1 │ vs 3.8 │ vs 4.0 │         │
│  └────────┴────────┴────────┴────────┘         │
│                                                │
│  OPEN FLAGS (1)                                │
│  ┌──────────────────────────────────────────┐  │
│  │ ▮▮▯ Sleep 5.5 vs 7.8 expected   07:02    │  │
│  │ [ Acknowledge ]  [ Action ▾ ]  [Dismiss] │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ENTRIES                                       │
│  ┌──────────────────────────────────────────┐  │
│  │ Tue 5 Aug  Readiness 68  ▸               │  │
│  │ Mon 4 Aug  Readiness 71  ▸               │  │
│  │ Sun 3 Aug  Not submitted  ⊘              │  │
│  │ Sat 2 Aug  Readiness 77  ▸  ✎ revised    │  │
│  └──────────────────────────────────────────┘  │
├────────────────────────────────────────────────┤
│  [ Enter on behalf ]        [ Quick actions ⌃] │ 56 pinned
└────────────────────────────────────────────────┘
```

The horizontal swipe between charts inside a tab is the "left/right reports" instruction from the
original drawing, read in `02-information-architecture.md` §1 as horizontal swipe navigation
between report views within a domain.

### Web, `xl` 1280 px

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │ [Last 28 days ▾]                       9 Jul to 5 Aug 2026       ⚙︎ │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │ ┌── 4 cols, sticky ────┐ ┌── 8 cols ─────────────────────────────┐  │
│ ▣ Dash │ │ ┌────┐               │ │ Overview Wellness Nutrition Gym       │  │
│ ▤ Sched│ │ │ AB │ Aoife Byrne   │ │ Training GPS Testing Injury Programme │  │
│ ▧ Squad│ │ └────┘ #14 · Back row│ ├───────────────────────────────────────┤  │
│ ▨ Prog │ │ 24 · joined Aug 2024 │ │ Readiness              68  ▽ -9       │  │
│ ⋯ More │ │                      │ │ 100┤                                  │  │
│        │ │ ◑ Modified           │ │    │    ╭─╮  ╭╮      band ±1SD        │  │
│        │ │ No sprinting         │ │  75┤▁▁▁▁│▁│▁▁││▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁        │  │
│        │ │ Back Fri 8 Aug       │ │    │ ╭──╯ ╰──╯╰──╮                    │  │
│        │ │ Rehab A · Phase 3    │ │  50┤─╯            ╰───●               │  │
│        │ ├──────────────────────┤ │    └──────────────────────────────    │  │
│        │ │ ▮▮▯ 1 open flag      │ │  n = 26 of 28 days · self-reported    │  │
│        │ │ ◍ 6 of 7 this week   │ ├───────────────────────────────────────┤  │
│        │ │ Load 7d   412 AU     │ │ Sleep 6.5▽ Soreness 3▽ Fatigue 3▽     │  │
│        │ │ ACWR      1.18       │ │ Stress 4─  Mood 4─                    │  │
│        │ ├──────────────────────┤ ├───────────────────────────────────────┤  │
│        │ │ GROUPS               │ │ Open flags (1)                        │  │
│        │ │ Backs · Rehab A      │ │ ▮▮▯ Sleep 5.5 vs 7.8   [Ack][Act][Dis]│  │
│        │ ├──────────────────────┤ ├───────────────────────────────────────┤  │
│        │ │ QUICK ACTIONS        │ │ Entries                               │  │
│        │ │ Enter on behalf      │ │ Tue 5 Aug  68  Mon 4 Aug  71          │  │
│        │ │ Adjust load          │ │ Sun 3 Aug  not submitted              │  │
│        │ │ Flag to medical      │ │ Sat 2 Aug  77  revised 3 Aug          │  │
│        │ │ Export athlete data  │ │                                       │  │
│        │ └──────────────────────┘ └───────────────────────────────────────┘  │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

The identity rail is sticky. A coach scrolling a season of gym logs must not lose sight of the
fact that this athlete is currently restricted from sprinting.

### Injury tab, coach view

```
│  Availability                                  │
│  ◑ Modified · injury · since 1 Aug             │
│  Restrictions: no sprinting, no max-effort     │
│                acceleration                    │
│  Note from medical: can complete full gym      │
│  upper.                                        │
│  Expected back: Fri 8 Aug                      │
│  Rehab group: Rehab A · Phase 3                │
│                                                │
│  Current injury                                │
│  Left hamstring · onset 1 Aug · 4 days         │
│  Occurred in: training                         │
│  Session: Conditioning, 1 Aug  →               │
│                                                │
│  🔒 Clinical detail is visible to medical      │
│     staff only.                                │
│                                                │
│  History                                       │
│  Left hamstring   12 Mar, 2 Apr    21 days    │
│  Right ankle      4 Nov, 28 Nov    24 days    │
│  ⚠ Recurrence: left hamstring, 2nd this season │
```

The `noPermission` notice is present rather than the section being absent. A coach who sees
nothing does not know whether clinical detail exists; a coach who sees the notice knows the
boundary is deliberate and stops asking. Body area, onset, and duration are all coach-visible,
so the recurrence marker is legitimate and it is operationally important.

### Injury tab, medical view

The same, plus a diagnosis and severity summary read through the audited RPC, plus "Open full
record" linking to `injury-record.md`. Same collapsed-by-default treatment as
`injury-dashboard.md`, same audit consequence, same lock glyph.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `PeriodSelector` | `06-design-system.md` §6.8 | Header, global, all six options |
| `GroupFilter` | §6.7 | Header, `disabled` |
| `DayWeekToggle` | §6.9 | Within domain tabs |
| `AthleteCard` | §6.1 | Not used. The identity header is a bespoke composition at this size. |
| `AvailabilityPill` | §6.5 | Identity header and injury tab, `size="md"` |
| `FlagBadge` | §6.4 | Identity header and flag lists |
| `ComplianceRing` | §6.6 | Identity header |
| `MetricTile` | §6.2 | Component breakdowns, load figures, test results |
| `TrendSparkline` | §6.3 | Inline trends in tables |
| `SessionCard` | §6.14 | Training tab session list |
| `ProgrammeExerciseRow` | §6.13 | Programme tab |
| `SetLogRow` | §6.12 | Gym tab, read mode |
| `CalendarStrip` | §6.15 | Day mode date navigation |
| `EmptyState` | §6.16 | Per tab, per chart |
| `ConfirmSheet` | §6.18 | Entering data on behalf, correcting an entry |
| `BottomSheet` | §6.19 | Quick actions, entry detail |
| `DomainChart` | **New**, this screen | The main chart per tab, with baseline band, provenance footnote, and sample size |
| `IdentityHeader` | **New**, this screen | Sticky identity, availability, flags, compliance |
| `EntryRow` | **New**, this screen | One entry with its date, value, provenance, and revision marker |

### `DomainChart`

```ts
export type DomainChartProps = {
  metric: MetricKey;
  points: Array<{ date: string; value: number | null; source: DataSource }>;
  /** Personal rolling mean, drawn dashed. */
  baseline?: number | null;
  /** Rolling mean plus and minus one standard deviation. */
  band?: { lower: number; upper: number } | null;
  /** Flag markers on the x axis. */
  flags?: Array<{ date: string; severity: FlagSeverity; flagId: string }>;
  /** Session markers, e.g. fixtures, drawn as vertical rules. */
  fixtures?: Array<{ date: string; opponent: string }>;
  /** Required. Sample size and window. */
  footnote: string;
  /** Provenance summary, e.g. "22 self-reported, 4 device". */
  provenance: string;
  onPointPress?: (date: string) => void;
  minPoints?: number;                       // below this, render insufficientData
};
```

Rules, all inherited from `06-design-system.md` §8:

- Every chart states its sample size and window. A `DomainChart` without a `footnote` fails a
  unit test.
- Nulls are gaps, drawn as a dotted connector, never zeros. Missing is not zero
  (`06-design-system.md` §1.6).
- Provenance is always displayed. A chart mixing self-reported and device sleep without
  distinguishing them produces confident nonsense (`00-product-overview.md` design principle 5).
- Below `minPoints` the chart renders the insufficient-data state stating n and the window, and
  does not draw a trend line.
- A table alternative is available behind a control, per §8.6.

---

## Data requirements

### Shared header query

```sql
create or replace function public.athlete_header(p_athlete_id uuid)
returns table (
  athlete_id uuid, full_name text, squad_number int, position text,
  date_of_birth date, age int, joined_at date, photo_url text,
  athlete_status athlete_status, has_account boolean,
  availability_status availability_status, restrictions text[],
  reason_category availability_reason, availability_note text,
  body_area body_area, side body_side, expected_return date,
  rehab_group_name text, rehab_phase text,
  open_flag_count int, top_severity flag_severity,
  compliance_completed int, compliance_expected int,
  load_7d numeric, acwr numeric,
  groups jsonb
)
language sql security invoker stable
as $$
select
  a.id,
  a.first_name || ' ' || a.last_name,
  a.squad_number, a.position, a.date_of_birth,
  extract(year from age(a.date_of_birth))::int,
  a.joined_at, u.avatar_url, a.status,
  (a.user_id is not null),
  coalesce(av.status, 'available')::availability_status,
  av.restrictions, av.reason_category, av.note,
  i.body_area, i.side, i.expected_return,
  rg.name, ra.phase,
  coalesce(fl.cnt, 0), fl.top_severity,
  coalesce(cr.completed, 0), coalesce(cr.expected, 0),
  acl.load_7d, acl.acwr,
  coalesce(grp.groups, '[]'::jsonb)
from athletes a
left join users u on u.id = a.user_id
left join lateral (
  select av.* from availability av
  where av.athlete_id = a.id and av.effective_to is null
  order by av.effective_from desc limit 1
) av on true
left join injuries i on i.id = av.injury_id
left join lateral (
  select ra.* from rehab_assignments ra
  where ra.athlete_id = a.id
    and (ra.ends_on is null or ra.ends_on >= current_date)
  order by ra.starts_on desc limit 1
) ra on true
left join groups rg on rg.id = ra.rehab_group_id
left join lateral (
  select count(*)::int as cnt, max(f.severity) as top_severity
  from flags f
  where f.athlete_id = a.id
    and f.status in ('raised','notified','acknowledged')
) fl on true
left join lateral (
  select sum(completed)::int as completed, sum(expected)::int as expected
  from mv_compliance_rates cr
  where cr.athlete_id = a.id
    and cr.period_start >= date_trunc('week', current_date)::date
) cr on true
left join lateral (
  select acl.load_7d, acl.acwr from mv_acute_chronic_load acl
  where acl.athlete_id = a.id
  order by acl.summary_date desc limit 1
) acl on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name,
                                      'colour', g.colour, 'type', g.group_type)) as groups
  from group_memberships gm
  join groups g on g.id = gm.group_id
  where gm.athlete_id = a.id and gm.removed_at is null and g.deleted_at is null
) grp on true
where a.id = p_athlete_id
  and a.org_id = auth_org_id()
  and a.deleted_at is null;
$$;
```

`injury_clinical` is not referenced. The header is identical for coach and medical.

### Per-tab queries

Each tab owns its query and is fetched lazily on first activation. Only the opening tab's data
is fetched on mount.

| Tab | Source | Notes |
|---|---|---|
| Overview | `mv_daily_athlete_summary` | One row per day. Cross-domain, cheap. |
| Wellness | `wellness_entries` where `superseded_by is null`, plus `mv_wellness_baselines` for the band | Revisions shown as a marker, not as a separate point |
| Nutrition | `nutrition_targets` resolved by `md_offset` and date range, plus the assigned `nutrition_guidance` rows | **No actuals.** Adherence per day was specified here and is not computable: athletes log nothing. `nutrition_entries` is dormant and is not read. |
| Gym | `gym_session_logs` joined to `gym_set_logs`, joined to `exercises` | Set-level detail on expansion only, never in the list query |
| Training | `training_entries`, `sessions`, `session_attendance`, `mv_acute_chronic_load` | Load is `rpe * duration_min` |
| GPS | `gps_records` | Premium tier only |
| Testing | `test_results` joined to `test_definitions` | Grouped by test, `is_best` marked, `side` split for asymmetry |
| Injury | `injuries`, `availability`, `rehab_assignments`. Medical additionally calls `read_injury_clinical` | See below |
| Programme | `programme_assignments`, resolved through `programme_blocks`, `programme_sessions`, `programme_exercises`, `exercise_overrides` | Resolved server-side, never assembled client-side |

### Wellness tab query, as the pattern

```sql
select
  w.entry_date,
  w.sleep_hours, w.sleep_quality, w.fatigue, w.soreness, w.soreness_areas,
  w.stress, w.mood, w.resting_hr, w.body_mass_kg, w.comment,
  w.readiness_score, w.source, w.submitted_at,
  (w.revision_of is not null) as is_revision,
  b.mean as baseline_mean, b.sd as baseline_sd,
  ce.is_required, ce.waived_reason
from generate_series($2::date, $3::date, interval '1 day') d(day)
left join wellness_entries w
       on w.athlete_id = $1
      and w.entry_date = d.day::date
      and w.superseded_by is null
left join mv_wellness_baselines b
       on b.athlete_id = $1
      and b.metric = 'readiness_score'
      and b.as_of_date = d.day::date
left join compliance_expectations ce
       on ce.athlete_id = $1
      and ce.expectation_date = d.day::date
      and ce.domain = 'wellness'
where $1 in (select id from athletes where org_id = auth_org_id())
order by d.day desc;
```

The `generate_series` left join is the important pattern and it applies to every domain tab. A
day with no entry must produce a row with nulls, so that the chart draws a gap and the entry
list shows "Not submitted". Filtering to existing entries would draw a continuous line across a
missing day, which is the specific chart bug that makes a monitoring product untrustworthy.

### Injury tab, coach

```sql
select i.id, i.body_area, i.side, i.onset_date, i.status,
       i.expected_return, i.actual_return, i.occurred_in, i.session_id,
       (coalesce(i.actual_return, current_date) - i.onset_date)::int as days_out,
       s.title as session_title, s.starts_at as session_starts_at
from injuries i
left join sessions s on s.id = i.session_id
where i.athlete_id = $1
  and i.org_id = auth_org_id()
order by i.onset_date desc;
```

Plus the availability event log for the history section:

```sql
select av.status, av.restrictions, av.reason_category, av.note,
       av.effective_from, av.effective_to, u.full_name as set_by_name
from availability av
left join users u on u.id = av.set_by
where av.athlete_id = $1 and av.org_id = auth_org_id()
order by av.effective_from desc;
```

Recurrence detection is client-side over the injury history: two or more open or closed injuries
with the same `body_area` and `side` in the current season.

### Injury tab, medical

The two queries above, plus `read_injury_clinical(injury_id)` for the current injury only, called
on explicit expansion, writing one audit row. Same rules as `injury-dashboard.md`: never
prefetched, `gcTime: 0`, never persisted.

### Quick actions

```sql
-- Enter data on behalf of an athlete. Provenance is forced.
create or replace function public.staff_enter_wellness(
  p_athlete_id uuid, p_entry_date date, p_values jsonb, p_reason text
) returns uuid language plpgsql security invoker as $$
  -- inserts with source = 'staff_entered', created_by = auth_user_id()
  -- rejects when a live entry already exists for that date: a correction
  -- must be an explicit revision, never a silent overwrite
$$;
```

Staff-entered data always carries `source = 'staff_entered'` and it is always displayed with its
provenance chip. `data_source` cannot be supplied by the client for this path.

### Query keys

```ts
athlete: {
  header: (orgId: string, athleteId: string) =>
    [...qk.squad.athlete(orgId, athleteId), 'header'] as const,
  domain: (orgId: string, athleteId: string, domain: string, range: DateRange) =>
    [...qk.squad.athlete(orgId, athleteId), 'domain', domain, range.from, range.to] as const,
  injuryShared: (orgId: string, athleteId: string) =>
    [...qk.squad.athlete(orgId, athleteId), 'injury-shared'] as const,
  injuryClinical: (orgId: string, injuryId: string) =>
    [...qk.injuryRecord.all(orgId), 'clinical', injuryId] as const,   // shared key, shared rules
  programme: (orgId: string, athleteId: string, on: string) =>
    qk.programme.resolvedForAthlete(orgId, athleteId, on),
},
```

| Key | `staleTime` | Persisted |
|---|---|---|
| header | 60 s | Yes |
| domain | 5 min | Yes |
| injuryShared | 60 s | Yes |
| injuryClinical | 0, `gcTime` 0 | **Never** |
| programme | 15 min | Yes |

---

## States

### Default

Opening tab per the entry point, period `last28`, header populated.

### Loading

Identity header renders skeletons for the name, availability, and badge row while preserving its
96 pt height. The active tab renders a chart skeleton at the chart's exact dimensions plus four
skeleton list rows. Tabs render immediately with their labels: a tab bar that appears after the
content is a layout shift on the most-used control on the screen.

Switching tabs shows the new tab's skeleton, not a screen-level spinner. A previously visited
tab renders from cache immediately.

### Empty

Per tab, and the distinctions matter.

| Tab | Condition | `kind` | Copy |
|---|---|---|---|
| Any | Athlete has no account yet | `notStarted` | "A. Byrne has not been invited yet. No data will arrive until they accept." Action: "Send invite" (admin only). |
| Wellness | No entries in the window | `noData` | "No wellness entries between 9 July and 5 August." Action: "Change period". |
| Wellness | Fewer than 3 entries | `insufficientData` | "Not enough data for a trend. 2 of 3 entries needed." Entries still listed. |
| Nutrition | No targets set | `notStarted` | "No nutrition targets set." Action: "Set targets". The assigned guidance is still shown. |
| Gym | No programme assigned | `notStarted` | "No gym programme assigned." Action: "Assign programme". |
| Training | No sessions in the window | `noData` | "No training sessions between 9 July and 5 August." |
| GPS | Club tier | `noPermission` | "GPS data is included in the Premium tier." No action from this screen; the admin upgrades in Settings. |
| GPS | Premium tier, no imports | `notStarted` | "No GPS data imported." Action: "Import GPS data". |
| Testing | No results | `notStarted` | "No test results recorded." Action: "Log a result". |
| Injury | No injury history | `allClear` | "No recorded injuries." Renders in `status.available` colours. |
| Injury | Coach, clinical section | `noPermission` | "Clinical detail is visible to medical staff only." |
| Programme | Nothing assigned | `notStarted` | "No programmes assigned." Action: "Assign programme". |

### Error

Errors render at the smallest scope that failed.

| Failure | Behaviour |
|---|---|
| Header | Header renders the athlete's name from the route's cached list entry if available, plus "Current status could not be loaded." Tabs still work. |
| A tab's data | That tab shows a block error with retry. Other tabs are unaffected. |
| A chart, list resolved | Chart shows the error state, the entry list renders. Partial failure names what did not load: "Trend unavailable." |
| Clinical RPC | "Clinical detail could not be loaded." No audit row written. |
| Staff-entry mutation | Rolls back, the typed values are preserved, message: "This entry was not saved. Your values are still here." |

### Offline

Header and previously visited tabs render from cache with "Last updated 08:12" and an offline
chip. Unvisited tabs render `EmptyState kind="offline"`. Clinical detail renders "Available
online only". All write actions are disabled.

### Role-specific

| Role | Difference |
|---|---|
| Coach | Injury tab at availability level with the `noPermission` notice for clinical. Full write access to programmes, staff-entered data, and flags. |
| Medical | Injury tab gains the clinical summary and "Open full record". Coaching domains are read-only for context (`01-roles-and-permissions.md` §1): no programme edits, no staff-entered wellness. Gains availability editing and rehab assignment. |
| Dual role | Union. |
| Admin | `noPermission` at screen level. |

### Tier-specific

Club tier hides no tab and disables the GPS tab's content with an explanation. Analytics presets
are limited rather than absent.

---

## Interactions

| Action | Result |
|---|---|
| Tap a tab | Switches. Lazily fetches on first activation. The URL updates so the state is shareable. |
| Swipe horizontally within a tab | Moves between charts in that domain. The "left/right reports" pattern. Does not change tabs: a swipe that sometimes changes chart and sometimes changes tab is unpredictable. |
| Change period | All tabs invalidate. The active tab refetches; others refetch on activation. |
| Toggle Day / Week | Within the tab. Persisted per domain, not globally. |
| Tap a chart point | Opens that day's detail sheet: all values for that domain on that date, provenance, submission time, and the revision chain if any. |
| Tap an entry row | Same sheet. |
| Tap a revision marker | Shows the original and the correction side by side with both timestamps. Nothing is silently overwritten (`00-product-overview.md` design principle 6). |
| Tap a flag marker on a chart | Opens the flag with its actions inline. |
| Acknowledge or action a flag | Same behaviour and same RPCs as `flags.md`. One implementation. |
| Tap "Enter on behalf" | Domain picker, then the entry form pre-filled with the athlete and date. Behind a `ConfirmSheet` that states the provenance consequence: "This will be recorded as entered by you, not by A. Byrne." Rejected when a live entry already exists for that date; the coach is offered "Create a correction" instead. |
| Tap "Adjust load" | Opens the programme override editor for the athlete's current programme (`03-flows.md` §4). Creates an `exercise_overrides` row, never a copied programme. |
| Tap "Flag to medical" | Raises a concern, notifying medical (`03-flows.md` §6). Not a clinical action and it records no clinical content. |
| Tap "Export athlete data" | CSV or PDF. Writes an `export.run` audit event. Medical additionally chooses whether to include clinical detail. |
| Tap availability (medical) | Opens the availability editor. |
| Tap "Open full record" (medical) | Navigate to `injury-record.md`. |
| Tap a group chip | Navigate to `groups.md` filtered to that group. |
| Tap a session in the training tab | Navigate to `session-detail.md`. |
| Back | Returns to the originating screen, not to the squad list (`02-information-architecture.md` §7 rule 3). |
| Tap "Previous" or "Next athlete" (web) | Moves through the list the athlete was opened from, preserving the tab. A coach working through three flagged athletes should not return to the list between each. |

---

## Validation rules

| Rule | Enforcement |
|---|---|
| Staff-entered data carries `source = 'staff_entered'` | Forced in the RPC. The client cannot supply `data_source`. |
| A staff entry cannot silently overwrite an athlete's entry | Rejected with `entry_exists`; the coach must explicitly create a revision. Entries are immutable once submitted (`CLAUDE.md` §2 rule 6). |
| Corrections create revisions | `revision_of` set, original marked `superseded_by`. Both remain. |
| Only medical sets availability linked to an injury | RLS (`availability_medical_insert`/`_update`, migration 0012). A coach may set non-injury availability directly since ADR-008 (migration 0041) — illness, personal, academic, representative, other — and the coach client renders that control, not the injury-linked one. |
| Coaches never receive clinical fields | Two tables, two policies, no join in any coach-facing query. |
| Clinical reads are audited | Through the RPC, in the same statement. |
| Every aggregate carries its sample size | `MetricTile` and `DomainChart` both fail unit tests without a footnote. |
| A correlation below minimum n is not drawn | `03-flows.md` §9, placeholder n = 20 paired observations (O-8). |
| Missing is not zero | Nulls are gaps in every chart. A test asserts a null point produces a gap, not a zero. |
| Scale direction is 5 = best on every 1 to 5 metric | `04-data-model.md` §5. Soreness 5 means no soreness. Chart axes and trend valence both follow the metric registry, never the raw sign. This is the single most likely source of an inverted-chart bug in the product and it deserves a test per metric. |
| Provenance is always displayed | A chart or tile mixing sources without distinguishing them is a review rejection. |
| Age is derived, never stored | From `date_of_birth`. |
| A former athlete's profile is read-only | No new entries, no programme assignment. History remains readable. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Athlete with no user account.** | Every tab renders `notStarted` with the invite explanation. Staff-entered data still works: staff must be able to record for a squad member before they have downloaded the app (`04-data-model.md` §3). |
| **Athlete joined mid-window.** | Charts start at `joined_at`. The footnote states "22 of 28 days, joined 14 July." Never a flat line back to the window start. |
| **Athlete left the club.** | Profile is read-only with a "Left club, 2 May 2026" banner. Reachable from the squad list with "Include former athletes". |
| **Sleep from both HealthKit and self-report on the same night.** | Deduplication rules apply (`03-flows.md` §7): device wins for objective metrics, self-report wins for subjective ones. Both are retained. The chart shows the resolved value with its provenance chip and the sheet shows both with an explanation. A coach must be able to see what they are reading. |
| **An entry was revised three times.** | The chart shows the live revision. The sheet shows the full chain with timestamps. |
| **Deep link to a tab the athlete has no data for.** | Opens that tab showing its empty state. Does not silently fall back to Overview: the coach asked for GPS and needs to learn there is no GPS. |
| **Deep link with an unknown tab name.** | Opens Overview and shows a caption "Unknown section, showing overview." Does not rewrite the URL. |
| **Deep link to another organisation's athlete.** | RLS returns nothing. Renders "This athlete is not available to you." Never reveals whether the id exists (`05-architecture.md` §10, authorisation row). |
| **Coach opens a medical deep link to `injury-record.md`.** | `noPermission`, and the denied attempt is audited. |
| **Athlete has two open injuries.** | The injury tab lists both. The header shows availability once, with the injury that drives it. |
| **Recurrence detection across a season boundary.** | Season boundaries come from `seasons.starts_on`. An injury in April and one in September are different seasons and are not marked as a recurrence, though both appear in the history. |
| **Period set to `season` for an athlete who joined in January.** | Window is clamped to `max(season.starts_on, athletes.joined_at)` and the footnote says so. |
| **Athlete with 400 gym sessions in the window.** | The list is virtualised and paginated at 50. Set-level detail loads on expansion only. |
| **Testing tab with left and right values.** | Rendered as a paired chart with an asymmetry percentage. Below 5 paired observations, the asymmetry figure is suppressed and the raw values shown, per the insufficient-data guard. |
| **Programme tab with an override.** | The override is always visible as a "Modified" chip with its reason on tap (`06-design-system.md` §6.13). Silently applying an override would make an athlete think the programme changed by itself. |
| **A tab's data is from before a unit change.** | Units are canonical and never change (`04-data-model.md` §1). If a display preference changes, conversion happens at the presentation layer and stored values are untouched. |

---

## Performance notes

| Concern | Approach |
|---|---|
| Lazy tabs | Only the opening tab fetches on mount. Fetching eight domains for an athlete a coach will look at for ten seconds is the most obvious way to make this screen slow. |
| Prefetch | On tab hover (web) or on tab bar scroll-into-view (mobile), prefetch the adjacent tab. Cheap, and it makes tab switching feel instant. Clinical data is **never** prefetched. |
| Time series | Every domain query is bounded by the period and indexed on `(athlete_id, entry_date desc)`, which all four entry tables plus `gps_records`, `test_results`, and `device_metrics` already have (`04-data-model.md` §15). |
| `generate_series` join | Adds at most 28 or 90 rows. Immaterial and it is what makes gaps correct. |
| Gym set logs | Never fetched with the session list. One query per expanded session, indexed on `gym_session_log_id`. A season of set logs is the largest data volume attached to any athlete and it must stay lazy. |
| Baselines | From `mv_wellness_baselines`, never computed live. |
| ACWR | From `mv_acute_chronic_load`, never computed live. |
| Header | One RPC with several lateral joins over single rows. Cached 60 s and shared with the squad list's cached entry where possible. |
| Charts | At most 90 points. No animation on redraw. Memoised on the point array identity. |
| Realtime | Not subscribed. A coach reading one athlete's history does not need live updates, and a flag arriving mid-read would move the chart under their eyes. The header refetches on focus. |
| Clinical | `gcTime: 0`, never persisted, never prefetched, refetched on every mount. |
| Budget | Header 150 ms p95. A domain tab 250 ms p95 server time. Screen interactive with the opening tab painted 1.2 s p95. Tab switch to a cached tab under 100 ms. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Heading structure | `h1` athlete name, `h2` active tab name, `h3` per section within the tab. |
| Tabs | `role="tablist"` with `aria-selected` and `aria-controls`. Arrow keys move, `Home` and `End` jump to first and last. On mobile the active tab is scrolled into view and announced. |
| Identity header | One accessible region: "Aoife Byrne, 14, back row, 24 years old. Modified availability, no sprinting, back Friday 8 August. Rehab A, phase 3. 1 medium severity flag. 6 of 7 compliance this week." |
| Chart | Full summary sentence per `06-design-system.md` §8.6: "Readiness over 28 days from 9 July to 5 August. Ranged 41 to 82, currently 68, down 9 on the 28-day mean of 77. 26 of 28 days have data. 1 high severity flag on 5 August." A "View as table" control renders the same data as a real table. |
| Missing values | "no data", never "zero". The distinction is the whole point of the gap treatment. |
| Provenance | Read aloud: "7.5 hours, from device." |
| Revisions | "Revised on 3 August. Original 71, corrected to 77." |
| Clinical boundary, coach | The `noPermission` notice is a real region with text, not a visual grey block, so a screen reader user learns the boundary exists. |
| Clinical expansion, medical | Same as `injury-dashboard.md`: the audit consequence is part of the control's accessible name. |
| Quick actions | Verb labels naming the athlete: "Enter wellness on behalf of Aoife Byrne". |
| Confirmations | State the consequence, never "Are you sure?". The staff-entry confirmation states the provenance change in words. |
| Touch targets | Tabs 44 pt tall and at least 72 pt wide. Chart points have 44 pt hit areas even at a 6 pt visual radius. Entry rows 56 pt. |
| Dynamic type | At 150% the tab bar scrolls further and the chart drops to every second axis tick. At 200% charts default to the table alternative, and the identity header wraps to four lines without clipping. Axis ticks cap at 130%, per §10.2. |
| Reduced motion | No chart draw-in. Tab transitions cross-fade at 100 ms. Sheets fade. No number counts up. |
| Focus | Tab switch moves focus to the tab panel, not to the first control inside it, so a screen reader user hears the panel heading. Sheets trap focus correctly and return it on close. |
| Colour independence | Trend valence uses arrow shape plus fill plus, optionally, a trailing word under the "Never colour trends" setting. Flag severity uses the bar meter. Availability uses the glyph trio. |
| Keyboard, web | `1` to `9` switch tabs, `[` and `]` move between athletes in the originating list, `e` opens enter-on-behalf. Discoverable through `?`. |

---

## Open questions

- **O-209**: Eight tabs with horizontal scroll on mobile is my recommendation over a "More"
  overflow. Confirm after the design photographs arrive. If the client's design shows a
  different information architecture for the single athlete view, the entry-point-determines-tab
  rule still has to survive it, because that rule is what makes every drill-down in the product
  land correctly.
- **O-210**: Is an Overview tab needed at all? It is reached only when no entry point implies a
  tab, which in practice means arriving from the squad list. It duplicates content from every
  other tab. The alternative is defaulting to Wellness, which is the most-read domain. I have
  kept Overview and I suspect it will be little used.
- **O-211**: Should a coach be able to enter data on behalf of an athlete from this screen? It
  is permitted by `01-roles-and-permissions.md` §1 with provenance `staff_entered`, and it is
  also the mechanism by which a compliance figure becomes fiction. I have included it with a
  provenance confirmation and a hard block on overwriting an existing entry. Confirm the
  friction level is right.
- **O-212**: Recurrence detection. I have defined a recurrence as two or more injuries with the
  same body area and side within one season, shown to coaches as a marker. This is
  operationally useful and it is arguably a clinical inference presented to a coach. I think it
  falls on the right side of the line because every input to it is already coach-visible. Worth
  a second opinion.
- **O-213**: Athlete photographs. The identity header assumes a photo with initials as a
  fallback. This is O-36 in the design system and it matters more here than anywhere, because
  the header is 96 pt of prominent space. If photographs are off, the header layout changes.
- **O-214**: "Previous athlete" and "Next athlete" navigation on web, moving through the list
  the profile was opened from. It is a real time-saver when working through flagged athletes and
  it adds state that has to survive navigation. Confirm it is worth building for v1.

---

## Related documents

- Where coaches arrive from → `dashboard.md`, `flags.md`, `squad-status.md`, `timetable.md`
- The athlete's own equivalent → `my-data.md` (screen 6)
- Full clinical record → `injury-record.md`
- Programme override model → `03-flows.md` §4
- Provenance and deduplication → `03-flows.md` §7
- Chart rules, sample size, and provenance → `06-design-system.md` §8
- Context preservation on drill-down → `02-information-architecture.md` §7
