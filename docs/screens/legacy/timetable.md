> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Timetable

> **Layout status**: provisional. Awaiting client design photographs.

Screen 11 in the inventory (`02-information-architecture.md` §5). Route `/staff/timetable`.
Reached from the Dashboard tab. Drawn on the original navigation map as
`Dashboard → Timetable`.

---

## Purpose

Today's sessions, who is in them, where and when they are, and whether each athlete actually
turned up.

The schedule is the spine (`00-product-overview.md` design principle 4). Almost everything in
Fydr hangs off the session calendar and the MD-n position within a week. This screen is the
day-level face of that spine, and it is distinct from the Schedule tab in scope and in purpose:

| Screen | Scope | Purpose |
|---|---|---|
| Timetable (11) | One day, read-and-capture | "What is happening today and who is here?" |
| Schedule (15) | Day, week, month, planning | "What are we doing over the next three weeks?" |

Timetable does not create or edit sessions. It reads them and captures attendance against them.
A coach standing on a pitch with a phone needs to mark twenty athletes present in under a
minute; a coach at a desk planning a block needs a calendar. Building one screen for both
produces a screen that is bad at the pitch-side job, which is the one with the time pressure.

Four jobs:

1. Show today's sessions in time order, with times, locations, and MD-n labels.
2. Show who is expected at each session, resolved through groups and individual assignments.
3. Capture attendance quickly, including modified participation and its reason.
4. Warn when an athlete is assigned work their restrictions prohibit.

Job 4 is a hard rule from `03-flows.md` §6: the system warns when a coach assigns an athlete
work that their restrictions prohibit. It warns rather than blocks, and the override is logged.

---

## Roles and access

| Role | Access | Notes |
|---|---|---|
| Coach / S&C | Full: view, capture attendance, record modified reasons | Cannot change availability. Can record that an athlete trained modified. |
| Medical | Full, same as coach, plus availability editing from a participant row | Medical is the only role that can set availability. |
| Athlete | No access to this screen | Athletes see their own day on the Today tab (screen 1). |
| Admin | No access by default | `noPermission`. |

**Group filter**: applies to the participant lists inside each session, not to which sessions
appear. A session assigned to Backs still appears when the filter is Forwards, with its
participant list empty and a caption "No Forwards in this session." Hiding the session entirely
would make a coach believe the day is emptier than it is, and the group filter is a view filter,
not an access filter (`01-roles-and-permissions.md` §5).

**Clinical boundary**: participant rows show availability status, restrictions, and body area.
Never diagnosis, mechanism, or clinical notes. The restriction warning names the restriction
("no contact"), never the reason for it.

---

## Entry points

| From | Trigger | Context carried |
|---|---|---|
| Dashboard, "Today" block | Tap a session card | Date, session pre-expanded |
| Dashboard, "Next" card | Tap | Date, session pre-expanded |
| Staff sidebar or tab | Direct | Today, group filter |
| Schedule (15), day view | "Open timetable" | Selected date |
| Session detail (16) | Back | Date, session position |
| Deep link `/staff/timetable?date=2026-08-05` | Universal link | Date |
| Athlete profile, training tab | "See session" | Date, session pre-expanded |

---

## Layout

**Assumption, pending client design photographs.** The vertical time-ordered list with
expandable participant rosters is my recommendation. A timeline or agenda-grid rendering is the
obvious alternative and it wastes vertical space at four sessions a day, which is the realistic
number for this market. The attendance capture pattern (a three-state segmented control per
athlete plus a bulk "mark all present") is also an assumption and it is the part most worth
testing with a real coach on a real pitch.

### Mobile, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  Timetable      [All squad ▾]        ⚙︎     │ 56 sticky
├────────────────────────────────────────────────┤
│  ‹  Mon 4   [Tue 5]   Wed 6   Thu 7   ›       │ 56 CalendarStrip
│      -5       -4       -3      -2              │ MD-n row
├────────────────────────────────────────────────┤
│  Tue 5 Aug · MD-4 · 3 sessions                 │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 08:30-09:30   🏋 Gym: Upper A    MD-4  │  │
│  │ Gym                                      │  │
│  │ 16 expected · 16 marked                  │  │ 96 pt header
│  │ ● 14 full  ◑ 1 modified  ○ 1 absent      │  │
│  │                                     ⌄    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 10:00-11:30   🏃 Conditioning    MD-4  │  │
│  │ Training · Main pitch                    │  │
│  │ 31 expected · 0 marked          ● LIVE   │  │
│  │                                     ⌃    │  │
│  ├──────────────────────────────────────────┤  │
│  │  [ Mark all present ]        Sort: Name ▾│  │ 48 bulk action
│  ├──────────────────────────────────────────┤  │
│  │ ⚠ 2 athletes have restrictions that this │  │ warning banner
│  │   session may conflict with.      [See]  │  │
│  ├──────────────────────────────────────────┤  │
│  │ ● Adeyemi J   #5   ┌────┬────┬────┬────┐ │  │
│  │                    │Full│Mod │Abs │Exc │ │  │ 56 pt row
│  │                    └────┴────┴────┴────┘ │  │
│  ├──────────────────────────────────────────┤  │
│  │ ◑ Byrne A     #14  ┌────┬────┬────┬────┐ │  │
│  │   ⚠ No sprinting   │Full│[Mod]│Abs │Exc│ │  │
│  │   Reason: ______________________________ │  │
│  ├──────────────────────────────────────────┤  │
│  │ ○ Nowak M     #21  ┌────┬────┬────┬────┐ │  │
│  │   Unavailable      │Full│Mod │[Abs]│Exc│ │  │
│  ├──────────────────────────────────────────┤  │
│  │  ... 28 more                             │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 14:00-15:00   📋 Video review    MD-4  │  │
│  │ Meeting · Clubhouse                      │  │
│  │ 31 expected · not started           ⌄    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [ Open schedule ]                             │
└────────────────────────────────────────────────┘
```

Only one session is expanded at a time on mobile. Expanding a second collapses the first, so the
sticky bulk-action bar always belongs to the session on screen. The live session (start time
passed, end time not) is expanded by default on load, which is the right guess for a coach
opening the app pitch-side.

### Web, `xl` 1280 px

Sessions as columns of a day board, or as a list with the roster inline. The list is the
recommendation: at three or four sessions the column board wastes the horizontal space, and the
roster is the thing that needs width.

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │ [All squad ▾]                          Tue 5 Aug · MD-4          ⚙︎ │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │  Timetable    ‹ Tue 5 Aug ›     3 sessions      [ Open schedule ]    │
│ ▣ Dash │ ┌──────────────────────────────────────────────────────────────────┐ │
│  · Sqd │ │ 08:30  🏋 Gym: Upper A  · Gym · Weights room · MD-4    16/16  ⌄  │ │
│  · Flg │ ├──────────────────────────────────────────────────────────────────┤ │
│  · Tmt │ │ 10:00  🏃 Conditioning · Training · Main pitch · MD-4   0/31 ⌃   │ │
│  · Inj │ │  ⚠ 2 restriction conflicts   [Review]     [Mark all present]     │ │
│ ▤ Sched│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ ▧ Squad│ │ │ Athlete        Avail      Restrictions   Attendance   Reason │ │ │
│ ▨ Prog │ │ ├──────────────────────────────────────────────────────────────┤ │ │
│ ⋯ More │ │ │ ● Adeyemi J #5  Available, [Full|Mod|Abs|Exc]   │ │ │
│        │ │ │ ◑ Byrne A  #14  Modified   No sprint ⚠ [Full|Mod|Abs|Exc] ▁ │ │ │
│        │ │ │ ○ Nowak M  #21  Unavail.   No contact  [Full|Mod|Abs|Exc]   │ │ │
│        │ │ │ ...                                                          │ │ │
│        │ │ └──────────────────────────────────────────────────────────────┘ │ │
│        │ ├──────────────────────────────────────────────────────────────────┤ │
│        │ │ 14:00  📋 Video review · Meeting · Clubhouse · MD-4    -/31  ⌄   │ │
│        │ └──────────────────────────────────────────────────────────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

On web, multiple sessions may be expanded at once.

### Attendance control

Four states from `attendance_status` in `04-data-model.md` §4: `full`, `modified`, `absent`,
`excused`. Rendered as a four-segment control, 44 pt tall, each segment at least 64 pt wide,
which fits at `md` and scrolls the roster horizontally at `xs`.

Selecting `modified` reveals a `modified_reason` field inline. The reason is optional at the
database level and **required by this screen**, because "modified" without a reason is
unreadable a week later. The requirement is enforced client-side with a soft block: the row
stays highlighted and the session cannot be marked complete until reasons are supplied. It does
not prevent the write, because a coach mid-session must be able to record the fact and add the
reason afterwards.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Header. Filters rosters, not sessions. |
| `CalendarStrip` | §6.15 | Date navigation with `markers` for sessions and fixtures and `mdOffsets` |
| `SessionCard` | §6.14 | Session header. `squadCounts` populated from attendance. |
| `AthleteCard` | §6.1 | Participant rows, `trailing` carrying the attendance control |
| `AvailabilityPill` | §6.5 | Availability column, `size="sm"` |
| `EmptyState` | §6.16 | No sessions, no participants, filter excluded everyone |
| `ConfirmSheet` | §6.18 | Restriction override confirmation |
| `BottomSheet` | §6.19 | Modified reason picker, bulk actions |
| `AttendanceControl` | **New**, this screen | Four-segment attendance selector plus the reason field |
| `RestrictionWarning` | **New**, this screen | The `03-flows.md` §6 warn-not-block affordance |

### `AttendanceControl`

```ts
export type AttendanceControlProps = {
  athleteId: string;
  sessionId: string;
  value: AttendanceStatus | null;         // null = not yet marked
  modifiedReason: string | null;
  /** Drives the restriction warning and the pre-selection hint. */
  availability: { status: AvailabilityStatus; restrictions: string[] } | null;
  /** Restrictions the session's type or planned work appears to conflict with. */
  conflicts: string[];
  onChange: (status: AttendanceStatus, reason?: string) => void;
  /** Fires when a coach selects full despite a conflict. Writes the audit event. */
  onOverride: (reason: string) => void;
  disabled?: boolean;                      // offline
  pendingSync?: boolean;
};
```

Rules:

- `null` is a real state and renders as no segment selected, not as `full` preselected. A
  pre-ticked register produces a full register whether or not anyone was there.
- An athlete whose current availability is `unavailable` has `absent` **suggested** with a
  ghost highlight, not selected. A coach can still mark them full, which triggers the override
  path.
- Each segment is a separate press target. The control is exempt from the "whole row navigates"
  rule that applies elsewhere: on this screen the row's purpose is the control.

### `RestrictionWarning`

Implements the hard rule in `03-flows.md` §6.

```ts
export type RestrictionWarningProps = {
  athlete: { id: string; displayName: string };
  restrictions: string[];                  // e.g. ['no contact','no sprinting']
  /** The session attributes that appear to conflict. */
  conflicts: Array<{ restriction: string; sessionAttribute: string }>;
  onProceed: (reason: string) => void;
  onCancel: () => void;
};
```

**Conflict detection** is a table mapping restriction strings to session attributes. It is data,
not code, and it lives in `organisations.settings -> 'restriction_conflicts'` with a shipped
default:

| Restriction | Conflicts with |
|---|---|
| `no contact` | `session_type in ('match', 'training')`, session tagged `contact` |
| `no sprinting` | session tagged `speed`, `conditioning` with `planned_rpe >= 7` |
| `upper body only` | `session_type = 'training'`, session tagged `lower_body` |
| `no jumping` | session tagged `plyometric` |
| `no loading` | `session_type = 'gym'` |
| `modified volume` | never a hard conflict, informational only |

The tags come from a `sessions.tags text[]` column. **This column does not exist in
`04-data-model.md` §4 and is required by this screen.** It is added by this screen's migration
and the data model document must be updated in the same commit, per `CLAUDE.md` §5.

**Coach audit finding 8, corrected here.** `no contact` originally read as `session_type in
('match')` only, on the reasoning that a session tagged `contact` would catch contact training.
Without the tags column, that tag half of the OR can never evaluate true, which left the whole
`no contact` check firing on matches (roughly one session a week) and silent on training, where
most contact work in fact happens. `training` is now in scope directly, as the proxy for the
missing tag until `sessions.tags` ships. `gym`, `rehab`, `testing`, `meeting` and `recovery`
are deliberately still out of scope — none of them are contact work by the session type alone,
and flagging them would train coaches to dismiss the warning rather than read it.

The warning **warns, it never blocks**. Coaches overrule physios constantly and a hard block
gets the product uninstalled. Proceeding requires a typed or picked reason and writes an
audit event, per `09-security-and-compliance.md` §8.5 which lists "every restriction override by
a coach" as a mandatory audit event.

---

## Data requirements

### Field map

| Field | Source | Transformation |
|---|---|---|
| `session_id`, `title`, `session_type` | `sessions` | Type drives the glyph |
| `starts_at`, `duration_min` | `sessions` | Rendered 24-hour in org timezone: "10:00-11:30" |
| `location` | `sessions.location` | |
| `md_offset` | `sessions.md_offset` | "MD-4" chip. Stored, not recomputed (`04-data-model.md` §4). |
| `planned_rpe`, `planned_load` | `sessions` | Shown in the session detail row on web |
| `tags` | `sessions.tags` (new) | Conflict detection |
| `status` | `sessions.status` | `cancelled` renders struck through with a chip |
| `requires_wellness/rpe/nutrition` | `sessions` | Small chips on the session header, so a coach knows what athletes will be asked for |
| `expected_participants` | `session_participants` expanded through `group_memberships` | Distinct athletes |
| `attendance`, `modified_reason` | `session_attendance` | Null means not yet marked |
| `recorded_by`, `recorded_at` | `session_attendance` | Shown on long-press |
| `availability_status`, `restrictions` | `availability` latest open row | Participant row |
| `body_area` | `injuries.body_area` via `availability.injury_id` | Participant row, non-clinical |
| `fixture` | `fixtures` via `sessions.fixture_id` | Opponent and kickoff on a match session |

### Sessions and rosters query

```sql
create or replace function public.timetable_day(
  p_date      date,
  p_group_ids uuid[] default '{}'::uuid[]
)
returns table (
  session_id uuid, title text, session_type session_type,
  starts_at timestamptz, duration_min int, location text,
  md_offset int, planned_rpe numeric, tags text[],
  session_status session_status,
  requires_wellness boolean, requires_rpe boolean, requires_nutrition boolean,
  fixture_opponent text,
  athlete_id uuid, display_name text, squad_number int,
  availability_status availability_status, restrictions text[],
  body_area body_area,
  attendance attendance_status, modified_reason text,
  recorded_by_name text, recorded_at timestamptz,
  in_group_filter boolean
)
language sql security invoker stable
as $$
with day_sessions as (
  select s.*, f.opponent
  from sessions s
  left join fixtures f on f.id = s.fixture_id
  where s.org_id = auth_org_id()
    and s.deleted_at is null
    and s.starts_at >= (p_date::timestamptz at time zone org_timezone())
    and s.starts_at <  ((p_date + 1)::timestamptz at time zone org_timezone())
),
-- Resolve participants: individual assignments plus group expansion, deduplicated.
roster as (
  select distinct sp.session_id, x.athlete_id
  from session_participants sp
  join day_sessions ds on ds.id = sp.session_id
  cross join lateral (
    select sp.athlete_id as athlete_id
    where sp.athlete_id is not null
    union
    select gm.athlete_id
    from group_memberships gm
    where sp.group_id is not null
      and gm.group_id = sp.group_id
      and gm.removed_at is null
      and gm.added_at::date <= p_date
  ) x
  where sp.org_id = auth_org_id()
),
avail as (
  select distinct on (av.athlete_id)
         av.athlete_id, av.status, av.restrictions, av.injury_id
  from availability av
  where av.org_id = auth_org_id()
    and av.effective_from <= (p_date + 1)::timestamptz
    and (av.effective_to is null or av.effective_to > p_date::timestamptz)
  order by av.athlete_id, av.effective_from desc
)
select
  ds.id, ds.title, ds.session_type, ds.starts_at, ds.duration_min, ds.location,
  ds.md_offset, ds.planned_rpe, ds.tags, ds.status,
  ds.requires_wellness, ds.requires_rpe, ds.requires_nutrition,
  ds.opponent,
  a.id,
  left(a.first_name,1) || '. ' || a.last_name,
  a.squad_number,
  coalesce(av.status, 'available')::availability_status,
  av.restrictions,
  i.body_area,
  sa.attendance, sa.modified_reason,
  u.full_name, sa.recorded_at,
  (cardinality(p_group_ids) = 0 or exists (
     select 1 from group_memberships gm
     where gm.athlete_id = a.id and gm.group_id = any (p_group_ids)
       and gm.removed_at is null)) as in_group_filter
from day_sessions ds
left join roster r    on r.session_id = ds.id
left join athletes a  on a.id = r.athlete_id
                     and a.deleted_at is null
                     and a.status <> 'left_club'
left join avail av    on av.athlete_id = a.id
left join injuries i  on i.id = av.injury_id
left join session_attendance sa
       on sa.session_id = ds.id and sa.athlete_id = a.id
left join users u     on u.id = sa.recorded_by
order by ds.starts_at, a.last_name, a.first_name;
$$;
```

`in_group_filter` is returned rather than the filter being applied in the `where` clause,
deliberately. The client hides filtered-out participants and still knows the session's true
expected headcount, so a session assigned to Backs shows "31 expected, 0 in Forwards" rather
than appearing empty and unexplained.

`injury_clinical` is not referenced. `injuries` is joined only for `body_area`.

### Attendance write

```sql
create or replace function public.record_attendance(
  p_session_id      uuid,
  p_athlete_id      uuid,
  p_attendance      attendance_status,
  p_modified_reason text default null,
  p_override_reason text default null   -- set when proceeding past a restriction warning
)
returns session_attendance
language plpgsql security invoker
as $$
declare
  v_row session_attendance;
  v_org uuid := auth_org_id();
begin
  if p_attendance = 'modified' and coalesce(trim(p_modified_reason),'') = '' then
    -- Soft rule: allowed, but flagged for completion in the UI.
    null;
  end if;

  insert into session_attendance
    (org_id, session_id, athlete_id, attendance, modified_reason, recorded_by, recorded_at)
  values
    (v_org, p_session_id, p_athlete_id, p_attendance, p_modified_reason, auth_user_id(), now())
  on conflict (session_id, athlete_id) do update
    set attendance      = excluded.attendance,
        modified_reason = excluded.modified_reason,
        recorded_by     = excluded.recorded_by,
        recorded_at     = excluded.recorded_at
  returning * into v_row;

  if p_override_reason is not null then
    insert into audit_log (org_id, actor_id, actor_role, action,
                           entity_type, entity_id, athlete_id, metadata)
    values (v_org, auth_user_id(), (auth_roles())[1], 'restriction.override',
            'session_attendance', v_row.id, p_athlete_id,
            jsonb_build_object('session_id', p_session_id,
                               'reason', p_override_reason));
  end if;

  return v_row;
end;
$$;
```

`session_attendance` is the one athlete-related table on this screen that is legitimately
updatable. It is a staff observation being corrected, not an athlete's immutable self-report, so
the immutability rule in `CLAUDE.md` §2 rule 6 does not apply. The `unique (session_id,
athlete_id)` constraint already in the schema supports the upsert.

**Bulk write**:

```sql
create or replace function public.record_attendance_bulk(
  p_session_id uuid,
  p_athlete_ids uuid[],
  p_attendance attendance_status
) returns int language plpgsql security invoker as $$ ... $$;
```

Bulk only ever sets `full`, `absent`, or `excused`. It never sets `modified`, because modified
needs a per-athlete reason.

### Query keys

```ts
timetable: {
  all: (orgId: string) => [...qk.org(orgId), 'timetable'] as const,
  day: (orgId: string, date: string) => [...qk.timetable.all(orgId), 'day', date] as const,
},
```

The group filter is **not** in the key, because the query returns the full roster with
`in_group_filter` and the client filters. This is the one screen where excluding the filter from
the key is correct, and it is worth a comment in the factory so it does not look like an
oversight.

`staleTime` 5 min, matching the schedule row in `05-architecture.md` §9. Refetch on focus. No
realtime: attendance is written by the coach holding the phone, and a second coach writing
concurrently is handled by last-write-wins plus a visible "recorded by" attribution.

---

## States

### Default

Today. Sessions in time order. The live session expanded, or the next upcoming one if none is
live, or the last one if the day is over.

### Loading

Two skeleton session cards at 96 pt. The expanded roster renders eight skeleton participant rows
at 56 pt. Date strip renders immediately with skeleton markers.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| No sessions today | `noData` | "No sessions on Tue 5 Aug. MD-4." Action: "Open schedule". |
| Rest day per the week template | `noData` | "Rest day. MD+2." No action, and no suggestion to add a session: a rest day is a plan, not a gap. |
| Session with no participants assigned | `notStarted` | "No athletes assigned." Action: "Assign in schedule" (links to session detail). |
| Group filter excludes every participant | `noResults` | "No Forwards in this session. 31 athletes expected." Action: "Clear filter". States the true headcount, per the `in_group_filter` design. |
| No season configured | `notStarted` | "No season set up." Action: "Open settings" for admin, no action otherwise. |

### Error

| Failure | Behaviour |
|---|---|
| Day query | Block error, retry: "Could not load today's sessions. Check your connection and try again." |
| Attendance write | Optimistic update rolls back, the row shows an inline message "Not recorded. Try again." and a retry. The selection the coach made is preserved in the control so they do not have to re-tap it. |
| Partial roster | If availability fails but sessions load, participant rows render with "Status unavailable" and attendance capture still works. Attendance is the time-critical job and it must not be gated on a secondary query. |
| Conflict rules fail to load | Warnings are suppressed and a caption reads "Restriction checks unavailable." Silently omitting the warning without saying so would be worse than the failure. |

### Offline

This is the screen where the staff-writes-disabled rule
(`06-design-system.md` §11.4) is most painful, and it is worth stating plainly rather than
hiding: a coach on a pitch with no signal cannot take the register in v1.

- Sessions and rosters render from cache with "Last updated 09:12" and an offline chip.
- Attendance controls are **disabled** with the copy "You are offline. Attendance will be
  available when you reconnect."
- The session header shows the last synced attendance counts.

This is the strongest single argument for revisiting O-34, and O-401 raises it specifically for
this screen, because training grounds have bad signal by assumption
(`00-product-overview.md` design principle 3) and taking a register is exactly the pitch-side
task that principle was written about.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | As specified. |
| Medical | Participant rows gain an availability edit affordance opening the status editor inline. A restriction override by a coach appears in the medical view with the overriding coach's name and reason, because the physio needs to know their restriction was overruled. |
| Dual role | Union. |

---

## Interactions

| Action | Result |
|---|---|
| Tap a date on the strip | Loads that day. MD-n labels update. |
| Swipe the strip | Moves by week, snaps. |
| Tap a session header | Expands the roster. Mobile collapses any other expanded session. |
| Tap a session title | Navigate to `session-detail.md` (16) for full editing. |
| Tap an attendance segment | Optimistic write. Row shows a brief pending-sync dot until confirmed. |
| Select `modified` | Reveals the reason field inline, focuses it, and offers a picker of the club's recent reasons plus free text. |
| Tap "Mark all present" | Sets `full` for every **unmarked** athlete in the current group filter. It never overwrites an existing mark, and it never marks an athlete whose availability is `unavailable`. Behind a `ConfirmSheet` stating exactly how many will change: "Mark 27 athletes as full? 4 already marked and 2 unavailable will not change." |
| Mark `full` for an athlete with a conflicting restriction | `RestrictionWarning` opens: "A. Byrne is restricted from sprinting. This session is tagged speed." Buttons: "Record as modified" (default), "Record as full anyway" (requires a reason), "Cancel". Proceeding writes the audit event. |
| Tap an athlete's name | Navigate to `athlete-profile.md`, training tab, this date. Back returns here with the session still expanded. |
| Long-press a participant row | Sheet showing who recorded the attendance and when, the athlete's restrictions in full, and "Set availability" for medical. |
| Tap "Review" on the warning banner | Filters the roster to the conflicting athletes only, with a "Show all" control. |
| Change group filter | Rosters filter client-side, instantly, without a refetch. Session headers keep their true expected counts. |
| Tap a cancelled session | Opens read-only, strikethrough title, "Cancelled" chip and the cancellation note. Attendance is not capturable. The session is not hidden, because the reason still matters. |
| Pull to refresh | Invalidates `qk.timetable.day`. |

**Not available**: creating a session, editing times, or changing participants. All three live on
`schedule.md` and `session-detail.md`. A coach who taps the session title gets there in one step.

---

## Validation rules

| Rule | Enforcement |
|---|---|
| An attendance value is one of the four enum values | Enum at the database level. The control cannot produce anything else. |
| `modified` should carry a reason | Soft block: the session cannot be marked "attendance complete" while any `modified` row lacks a reason. The write itself succeeds. |
| An athlete not in the roster cannot be marked | `record_attendance` verifies the athlete resolves through `session_participants` for that session and rejects otherwise with `not_a_participant`. Otherwise a stale client could write attendance for anyone in the org. |
| Bulk marking never overwrites an existing mark | Enforced in `record_attendance_bulk` with a `where not exists` on `session_attendance`. |
| Bulk marking never sets `modified` | The RPC rejects `p_attendance = 'modified'`. |
| Attendance cannot be recorded for a future session | Rejected with `session_not_started` if `now() < starts_at - interval '30 minutes'`. The 30-minute grace exists because coaches take the register as athletes arrive. |
| Attendance on a cancelled session is rejected | `session_cancelled`. |
| A restriction override requires a reason | The RPC accepts `p_override_reason` as nullable, and the client requires it. The audit event is written only when it is present, and an override recorded without one is a UI bug that the audit log will make visible. |
| Attendance for an athlete who has left the club is rejected | `athlete_inactive`. |
| The date is resolved in organisation time | `org_timezone()`, never the device. A coach travelling with the squad sees the club's day. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Session spans midnight**, for example a late fixture. | Sessions are placed by `starts_at` date in organisation time. A session starting 23:30 appears on that day only. Its end time renders "00:45 (+1)". |
| **Two sessions overlap.** | Both render in start-time order. No conflict warning: overlapping sessions for different groups are normal. A same-athlete overlap is worth flagging and is raised as O-402. |
| **An athlete is in two groups both assigned to the session.** | Deduplicated by the `distinct` in the roster CTE. One row. |
| **An athlete is individually assigned and also in an assigned group.** | Same deduplication. One row. |
| **Group membership changed today.** | Roster resolves membership as at the session's date. An athlete added to Forwards this morning appears in this afternoon's Forwards session. |
| **An athlete becomes unavailable after the register was taken.** | The recorded attendance stands. The row shows the new availability with a caption "Availability changed at 11:40, after this session." History is not rewritten. |
| **A coach marks an unavailable athlete as full.** | Permitted, with the restriction warning if a restriction conflicts, and always with an audit event when overriding. If the athlete is `unavailable` with no specific restriction, the warning reads "M. Nowak is unavailable" and still allows the override. Physios need to know this happened and the medical view shows it. |
| **Session cancelled after some attendance was recorded.** | Existing rows are retained. The session renders cancelled and read-only. Compliance expectations for the session are waived with "Session cancelled". |
| **Session assigned to a group with no members.** | "No athletes assigned. The group Rehab A is empty." Distinct from no participants assigned at all. |
| **The whole squad is in one session and the phone is on 3G.** | 40 participant rows is a virtualised list. Attendance writes are individual mutations, batched at 400 ms so rapid tapping produces one request per athlete rather than a request per re-render. |
| **Coach taps rapidly through the register.** | Each tap is an optimistic local state change; the network writes are debounced and coalesced per athlete. The last value per athlete wins. A tap that lands during a failed request is not lost. |
| **Two coaches take the register simultaneously.** | Last write wins on the upsert. The row shows "Recorded by Jamie Ellis, 10:04" so the second coach can see the first's entry. No lock, no merge dialogue: for a register this is proportionate. |
| **A session has `requires_rpe` but no athlete logged RPE.** | Not this screen's problem. The chip on the session header shows what will be asked for, and compliance is `squad-status.md`'s job. |
| **No fixture in the season, so no MD-n.** | The MD chip is omitted. The day header reads "Tue 5 Aug · 3 sessions" without an MD label. |
| **Two fixtures this week.** | The MD chip shows both, "+1 / -3", per `03-flows.md` §8. |
| **Attendance recorded, then the session's participant list changes.** | Attendance rows for removed participants persist and render in a separate "No longer assigned" group at the bottom of the roster, with their recorded value. Deleting them would erase a fact. |

---

## Performance notes

| Concern | Approach |
|---|---|
| Query shape | One RPC per day returning sessions joined to rosters. At 4 sessions times 31 athletes this is about 124 rows. The join fan-out is the cost, and it is small enough that a single denormalised result beats four round trips. |
| Index | Served by `create index on sessions (org_id, starts_at)`, which exists. **Add** `create index on session_attendance (session_id)` and `create index on session_participants (session_id)`; neither is in `04-data-model.md` §15 and both are on the critical path. |
| Roster expansion | The lateral union over `group_memberships` uses `create index on group_memberships (group_id, athlete_id) where removed_at is null`, which exists. |
| Payload | About 40 KB for a full day at 31 athletes. Acceptable on 3G at the cost of roughly one second, which is why the day is fetched once and the group filter is client-side. |
| Attendance writes | Individual optimistic mutations, debounced 400 ms per athlete, coalesced. A full register of 31 athletes at one tap each is 31 small requests over a few seconds, which is fine, or one bulk request when "Mark all present" is used. |
| Bulk write | One RPC call, one transaction. |
| List rendering | Virtualised roster with a fixed `estimatedItemSize` of 56 pt. Rows memoised on `athlete_id + attendance + modified_reason`. |
| Prefetch | On mount, prefetch yesterday and tomorrow so the date strip feels instant in both directions. |
| Cache | 5 min `staleTime`, 24 h `gcTime`, persisted so the day is readable offline immediately after a cold start. |
| Budget | Day query 200 ms p95 server time. Attendance write 150 ms p95. Screen interactive 1.0 s p95, tighter than the dashboard because a coach opens this pitch-side and stands still while it loads. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Heading structure | `h1` "Timetable", `h2` per session with time and title, `h3` "Participants". |
| Session header label | "10:00 to 11:30. Conditioning. Training. Main pitch. MD minus 4. 31 expected, 0 marked. In progress." |
| Attendance control | `role="radiogroup"` with an accessible name naming the athlete: "Attendance for A. Byrne". Each segment is a radio with the value word. Arrow keys move within the group, tab moves between athletes. |
| State announcement | Selecting a value announces "A. Byrne marked full." A failed write announces "Not recorded for A. Byrne. Try again." through a live region. |
| Restriction warning | `role="alertdialog"`, focus moves to it, focus returns to the control on dismiss. Its text names the restriction and the conflicting session attribute in full. |
| Warning banner | `role="status"`, not `alert`, because it is present on load rather than interrupting. |
| Bulk action confirmation | States the exact count and exclusions in the accessible name, not only visually. |
| Touch targets | Attendance segments are 44 pt tall and at least 64 pt wide, exceeding the 48 pt floor in one dimension and meeting it in the other by padding. 8 pt separation between segments. |
| Dynamic type | At 150% the four segments wrap to two rows of two. At 200% the control becomes a full-width picker button opening a `BottomSheet` with four large options, because four segments at 200% cannot meet the target floor on a 390 pt screen. |
| Reduced motion | Expand and collapse become instant. The pending-sync dot does not pulse. |
| Colour independence | Attendance uses the selected segment's fill plus the word. Availability uses the glyph trio. Restriction conflicts use a warning glyph plus text, never colour alone. |
| Focus, web | Tab order: date, session headers, then within an expanded session the bulk action, then each participant row. `Escape` collapses the expanded session. |
| Keyboard, web | With a participant row focused, `f`, `m`, `a`, `e` set full, modified, absent, excused. This turns a 31-athlete register into 31 keystrokes for a coach at a laptop. |
| Screen reader roster | Announces position: "Participant 12 of 31." A coach using VoiceOver to take a register needs to know where they are. |

---

## Open questions

- **O-399**: Attendance capture pattern. A four-segment control per athlete is my
  recommendation. The alternatives are a tap-to-cycle single control (faster, more error-prone)
  and a swipe-to-mark list (fastest, least discoverable). This is worth testing with a real
  coach on a real pitch before build, because the register is a timed task and the difference
  between the patterns is real.
- **O-400**: Should attendance capture live here at all, or only on `session-detail.md`
  (screen 16)? I have put it here because pitch-side is where the register is taken and the
  timetable is the screen a coach already has open. If it lives in both, they must share one
  component and one mutation, not two implementations.
- **O-401**: Offline attendance. The v1 rule disables staff writes offline
  (`06-design-system.md` §11.4, O-34), which means no register on a pitch with no signal. This
  is the single strongest counter-example to that rule. Attendance is conflict-tolerant in a way
  a programme edit is not: last-write-wins on `(session_id, athlete_id)` is genuinely acceptable
  here. My recommendation is to make attendance the **one** staff write that queues offline, and
  I would like that decided before build rather than after a coach complains.
- **O-402**: Should the screen warn when one athlete is assigned to two overlapping sessions?
  It is a genuine planning error and it is also common and intentional (gym then pitch, back to
  back with a five-minute overlap in the calendar). I have not built the warning.
- **O-403**: The `sessions.tags text[]` column is new and required for restriction conflict
  detection. Confirm the tag vocabulary: I have assumed `contact`, `speed`, `lower_body`,
  `upper_body`, `plyometric`, `conditioning`. Without tags, conflict detection falls back to
  `session_type` alone, which is too coarse to be useful.

---

## Related documents

- Full session editing → `session-detail.md` (16), `schedule.md` (15)
- Why restrictions warn rather than block → `03-flows.md` §6
- MD-n and week templates → `03-flows.md` §8, `04-data-model.md` §4
- Compliance driven by these sessions → `squad-status.md`
- Attendance and participant schema → `04-data-model.md` §4
